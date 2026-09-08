param([int]$Port = 8765)
# Minimal static server on loopback. "/" serves the project folder; "/scratch/" serves the scratchpad.
# POST /upload?name=<file> writes the raw body to the scratchpad uploads folder.
# /api/* mirrors the Node leaderboard API in ..\server (same validation + integrity rules) so the game can be
# previewed without Node/MongoDB. Scores go to scores.json in the scratchpad. Preview only, not production.
$ProjectRoot = "C:\Users\sslur\Downloads\The Whale Lord landing page\design_handoff_whale_lord"
$ScratchRoot = "C:\Users\sslur\AppData\Local\Temp\claude\C--Users-sslur-Dddd\1458dc35-ce81-4f0d-953e-5d0fcb56b283\scratchpad"
$UploadRoot = "C:\Users\sslur\AppData\Local\Temp\claude\C--Users-sslur-Dddd\1458dc35-ce81-4f0d-953e-5d0fcb56b283\scratchpad\uploads"
$ScoreFile = Join-Path $ScratchRoot "scores.json"
$ServerSecret = "preview-only-secret"
$ClientSalt = "whalelord-frenzy-v1"     # must match CLIENT_SALT in game.js
$Mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8";
  ".mjs"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif";
  ".webp"="image/webp"; ".ico"="image/x-icon"; ".woff"="font/woff"; ".woff2"="font/woff2"; ".txt"="text/plain; charset=utf-8";
  ".md"="text/plain; charset=utf-8"; ".glb"="model/gltf-binary"; ".gltf"="model/gltf+json"; ".wasm"="application/wasm"
}

# ---------- leaderboard API mirror ----------
function HmacB64Url([string]$s) {
  $h = New-Object System.Security.Cryptography.HMACSHA256 (,[Text.Encoding]::UTF8.GetBytes($ServerSecret))
  $b = $h.ComputeHash([Text.Encoding]::UTF8.GetBytes($s))
  return [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
function Sha256Hex([string]$s) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)) | ForEach-Object { $_.ToString("x2") }) -join "")
}
function NowMs { return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function IsUInt($v) { return ($null -ne $v) -and ($v -is [ValueType]) -and ($v -isnot [bool]) -and ([double]$v -ge 0) -and ([double]$v -eq [math]::Floor([double]$v)) }
function LoadScores {
  if (-not (Test-Path $ScoreFile)) { return @() }
  $raw = [IO.File]::ReadAllText($ScoreFile)
  if (-not $raw.Trim()) { return @() }
  return @(ConvertFrom-Json $raw)
}
function SaveScores($arr) {
  $items = @($arr | ForEach-Object { '{"username":"' + $_.username + '","score":' + [int]$_.score + ',"timestamp":' + [long]$_.timestamp + ',"session":"' + $_.session + '","level":' + [int]$_.level + ',"eaten":' + [int]$_.eaten + ',"durationMs":' + [int]$_.durationMs + '}' })
  [IO.File]::WriteAllText($ScoreFile, "[" + ($items -join ",") + "]")
}
function Board([string]$period) {
  $since = 0; if ($period -ne "all") { $since = (NowMs) - 7 * 86400000 }
  $best = @{}
  foreach ($s in (LoadScores)) {
    if ([long]$s.timestamp -lt $since) { continue }
    $k = ([string]$s.username).ToLower()
    if (-not $best.ContainsKey($k) -or [int]$s.score -gt [int]$best[$k].score) { $best[$k] = $s }
  }
  return @($best.Values | Sort-Object -Property @{Expression={[int]$_.score};Descending=$true}, @{Expression={[long]$_.timestamp};Descending=$false})
}
function BoardJson($rows, [int]$n) {
  $items = @($rows | Select-Object -First $n | ForEach-Object { '{"username":"' + $_.username + '","score":' + [int]$_.score + ',"timestamp":' + [long]$_.timestamp + '}' })
  return "[" + ($items -join ",") + "]"
}
function ApiError([int]$code, [string]$msg) { return @($code, ('{"ok":false,"error":"' + $msg + '"}')) }
function Handle-Api([string]$method, [string]$path, [string]$query, [byte[]]$body) {
  if ($method -eq "POST" -and $path -eq "/api/session") {
    $id = -join ((1..24) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
    $start = NowMs
    $ticket = "$id.$start." + (HmacB64Url "$id.$start")
    return @(200, ('{"ok":true,"ticket":"' + $ticket + '"}'))
  }
  if ($method -eq "GET" -and $path -eq "/api/leaderboard") {
    $period = "week"; if ($query -match "period=all") { $period = "all" }
    return @(200, (BoardJson (Board $period) 10))
  }
  if ($method -eq "POST" -and $path -eq "/api/submit-score") {
    try { $b = ConvertFrom-Json ([Text.Encoding]::UTF8.GetString($body)) } catch { return ApiError 400 "invalid JSON body" }
    $username = ([string]$b.username).Trim()
    if ($username -notmatch '^[A-Za-z0-9_.-]{2,16}$') { return ApiError 400 "username must be 2-16 letters, digits, _ . -" }
    if (-not (IsUInt $b.score) -or [double]$b.score -gt 10000000) { return ApiError 400 "score must be a non-negative integer" }
    $st = $b.stats
    if (-not (IsUInt $st.eaten) -or -not (IsUInt $st.level) -or -not (IsUInt $st.durationMs)) { return ApiError 400 "stats.eaten, stats.level and stats.durationMs must be non-negative integers" }
    $ticket = [string]$b.ticket
    $m = [regex]::Match($ticket, '^([a-f0-9]{24})\.(\d{13})\.([A-Za-z0-9_-]{43})$')
    if (-not $m.Success) { return ApiError 401 "missing, forged or expired session ticket" }
    $id = $m.Groups[1].Value; $start = [long]$m.Groups[2].Value; $tsig = $m.Groups[3].Value
    if ($tsig -cne (HmacB64Url "$id.$start")) { return ApiError 401 "missing, forged or expired session ticket" }
    $elapsed = (NowMs) - $start
    if ($elapsed -lt 0 -or $elapsed -gt 7200000) { return ApiError 401 "missing, forged or expired session ticket" }
    $sec = $elapsed / 1000.0
    $score = [int]$b.score; $eaten = [int]$st.eaten; $level = [int]$st.level; $dur = [int]$st.durationMs
    if ($score -gt 0 -and $sec -lt 3) { return ApiError 422 "session too short for a score" }
    if ($score -gt $sec * 4000 + 1000) { return ApiError 422 "score too high for the session length" }
    if ($eaten -gt $sec * 8 + 10) { return ApiError 422 "too many eats for the session length" }
    if ($score -gt $eaten * 5000 + $sec * 600 + 1000) { return ApiError 422 "score too high for the number of eats" }
    if ($dur -gt $elapsed + 5000) { return ApiError 422 "reported duration exceeds the session" }
    $expected = Sha256Hex "$ticket|$username|$score|$eaten|$level|$dur|$ClientSalt"
    if (([string]$b.sig) -cne $expected) { return ApiError 401 "bad signature" }
    $scores = LoadScores
    if (@($scores | Where-Object { $_.session -eq $id }).Count -gt 0) { return ApiError 409 "this game session was already submitted" }
    $scores = @($scores) + @([pscustomobject]@{ username = $username; score = $score; timestamp = (NowMs); session = $id; level = $level; eaten = $eaten; durationMs = $dur })
    SaveScores $scores
    $rows = @(Board "week"); $rank = 0     # @() keeps a single row an array (PowerShell unwraps 1-element returns)
    for ($i = 0; $i -lt $rows.Count; $i++) { if (([string]$rows[$i].username).ToLower() -eq $username.ToLower()) { $rank = $i + 1; break } }
    $rankJson = "null"; if ($rank -gt 0) { $rankJson = "$rank" }
    return @(201, ('{"ok":true,"id":"' + $id + '","rank":' + $rankJson + '}'))
  }
  return ApiError 404 "not found"
}
$StatusText = @{ 200 = "200 OK"; 201 = "201 Created"; 400 = "400 Bad Request"; 401 = "401 Unauthorized"; 404 = "404 Not Found"; 409 = "409 Conflict"; 422 = "422 Unprocessable Entity" }

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "static server listening on http://localhost:$Port/"
function Send-Response($stream, [string]$status, [string]$ct, [byte[]]$bytes) {
  $head = "HTTP/1.1 $status`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush()
}
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $stream.ReadTimeout = 15000
    $ms = New-Object System.IO.MemoryStream
    $buf = New-Object byte[] 65536
    $headerEnd = -1; $contentLength = 0; $headerText = ""
    while ($true) {
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      $ms.Write($buf, 0, $n)
      if ($headerEnd -lt 0) {
        $sofar = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
        $idx = $sofar.IndexOf("`r`n`r`n")
        if ($idx -ge 0) {
          $headerEnd = $idx
          $headerText = $sofar.Substring(0, $idx)
          $m = [regex]::Match($headerText, "(?im)^Content-Length:\s*(\d+)")
          if ($m.Success) { $contentLength = [int]$m.Groups[1].Value }
        }
      }
      if ($headerEnd -ge 0 -and $ms.Length -ge ($headerEnd + 4 + $contentLength)) { break }
    }
    $all = $ms.ToArray()
    $reqLine = ($headerText -split "`r`n")[0]
    $parts = $reqLine -split " "
    $method = "GET"; $path = "/"
    if ($parts.Length -ge 2) { $method = $parts[0]; $path = $parts[1] }
    $query = ""
    if ($path.Contains("?")) { $query = $path.Substring($path.IndexOf("?") + 1); $path = $path.Substring(0, $path.IndexOf("?")) }
    $path = [System.Uri]::UnescapeDataString($path)
    if ($path.StartsWith("/api/")) {
      $body = New-Object byte[] $contentLength
      if ($contentLength -gt 0) { [Array]::Copy($all, $headerEnd + 4, $body, 0, $contentLength) }
      $r = Handle-Api $method $path $query $body
      $code = [int]$r[0]; $statusLine = $StatusText[$code]; if (-not $statusLine) { $statusLine = "$code" }
      Send-Response $stream $statusLine "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes([string]$r[1]))
      Write-Host "$code $method $path"
    } elseif ($method -eq "POST" -and $path -eq "/upload") {
      $name = "upload.bin"
      $qm = [regex]::Match($query, "name=([^&]+)")
      if ($qm.Success) { $name = [System.Uri]::UnescapeDataString($qm.Groups[1].Value) -replace "[^A-Za-z0-9._-]", "_" }
      $body = New-Object byte[] $contentLength
      [Array]::Copy($all, $headerEnd + 4, $body, 0, $contentLength)
      New-Item -ItemType Directory -Force $UploadRoot | Out-Null
      $target = Join-Path $UploadRoot $name
      [System.IO.File]::WriteAllBytes($target, $body)
      Send-Response $stream "200 OK" "application/json" ([System.Text.Encoding]::UTF8.GetBytes("{`"ok`":true,`"file`":`"$name`",`"bytes`":$contentLength}"))
      Write-Host "POST /upload -> $target ($contentLength bytes)"
    } else {
      $root = $ProjectRoot
      if ($path.StartsWith("/scratch/")) { $root = $ScratchRoot; $path = $path.Substring(8) }
      $rel = $path.TrimStart("/") -replace "/", "\"
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $file.StartsWith($root)) { $file = "" }
      if ($file -and (Test-Path $file -PathType Container)) { $file = Join-Path $file "index.html" }
      if ($file -and (Test-Path $file -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ct = "application/octet-stream"; if ($Mime.ContainsKey($ext)) { $ct = $Mime[$ext] }
        Send-Response $stream "200 OK" $ct $bytes
        Write-Host "200 $path"
      } else {
        Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("404: $path"))
        Write-Host "404 $path"
      }
    }
  } catch {
    Write-Host "error: $($_.Exception.Message)"
  } finally {
    $client.Close()
  }
}
