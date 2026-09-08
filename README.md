# Handoff: The Whale Lord — landing page

## Overview
Single-screen, desktop-first landing page for the $WHALELORD web3 project. A full-bleed underwater illustration (The Whale Lord on his golden anchor throne) fills the viewport. Five floating glass "bubbles" around the mascot open a glassmorphism panel with a title, the bubble art, and a short description. A sticky bottom bar shows the contract address with a Copy CA button; the header holds the gold title and Telegram / X / $WHALELORD links.

## About the design files
Everything in this bundle is a **design reference built in HTML**, not production code to ship as-is.

- `index.html` + `assets/` — a self-contained vanilla HTML/CSS/JS version. Open it directly in a browser. This is the easiest reference to port: plain CSS classes, one `memories` array, no framework.
- `design_component/` — the original interactive design file (`The Whale Lord.dc.html`, needs `support.js` next to it). Same visuals and behaviour; kept for provenance.

Task for the implementer: recreate this in the target stack (Next.js + Tailwind + Framer Motion was the stated preference; plain HTML/CSS/JS is fine too) using its conventions. Keep the art, copy, colours, type, and interactions exactly as specified below.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy, and motion are final. Recreate pixel-accurately.

## Screen: Hero (the only screen)
Viewport-locked (`100vw × 100vh`, `overflow: hidden`, body scroll disabled). Layers, back to front:

1. **Scene** — a box with aspect-ratio 2048/1056 centred on the viewport, width `max(100vw, 100vh * 2048/1056)` (so it always covers). Background `assets/whale-lord-hd-stage-v3.png`, `background-size: cover; background-position: center`. Has a gentle idle loop: `mascotBob 6s ease-in-out infinite` (translateY 0 → −10px, rotate 0 → 0.5°, constant scale 1.02 to hide edges). Inside it (clipped): two blurred light rays (skewed gradient strips, opacity pulsing .25→.5 over 7s and 9s) and 22 randomly placed rising ambient bubbles (4–18px circles, `bubbleRise` 9–21s linear, negative random delays).
2. **Memory bubbles (5)** — absolutely positioned inside the scene using % of the scene box so they land on the painted bubble spots (values in the `memories` array). Each is a square wrapper (`aspect-ratio: 1`, `z-index: 20`) running `orbFloat` (translateY 0 → −6px) with its own duration/delay: 4s/0s, 5s/1s, 4.5s/0.5s, 5.5s/1.5s, 4.8s/0.8s. Inside: a circular `<button>` (`border-radius: 50%; overflow: hidden`) containing the bubble PNG at `transform: scale(1.07)` (trims a thin ring of water in the cut-outs so the glow hugs the bubble edge).
   - Hover: `transform: scale(1.08) translateY(-6px)`; `box-shadow: 0 0 35px rgba(212,175,55,.85), 0 0 0 2px rgba(243,217,122,.9)`; `transition: all .3s cubic-bezier(.34,1.56,.64,1)`; `cursor: pointer`.
   - Hover also plays a short synthesized "pop" (see Interactions).
3. **Header** — absolute top, full width, `padding: 18px 28px`, flex space-between, background `linear-gradient(180deg, rgba(5,11,20,.55), transparent)`.
   - Title (left): "THE WHALE LORD", Cinzel 900, `clamp(22px, 2.4vw, 36px)`, letter-spacing .08em, uppercase, metallic gold gradient text `linear-gradient(180deg, #fff2b0 0%, #d4af37 45%, #8a6a12 60%, #f3d97a 100%)` clipped to text, `filter: drop-shadow(0 3px 0 #3a2a05) drop-shadow(0 0 16px rgba(212,175,55,.6))`.
   - Links (right, gap 10px): Telegram icon box and X icon box — 40×40, white, `border: 2px solid #111`, hard shadow `3px 3px 0 #111`, icon colour #111. Then "$WHALELORD" box — 40px tall, padding 0 14px, background #f5d547, same border/shadow, Nunito 800 13px, letter-spacing .04em. Hover on all three: `translate(-1px,-1px)`, shadow `4px 4px 0 #111`. Each opens in a new tab: Telegram group (https://t.me/+jJeB92uynsYwNzcx), X profile (https://x.com/thewhalelordcom), token page (URL still a placeholder).
4. **Bottom bar** — absolute bottom, full width, `padding: 12px 28px`, grid `1fr auto 1fr`, background `rgba(5,11,20,.85)`, `backdrop-filter: blur(12px)`, `border-top: 1px solid rgba(212,175,55,.35)`.
   - Left and right: "OFFICIAL WEBSITE | DIVE INTO DOMINANCE", Nunito 800 12px, letter-spacing .14em, white; the "|" is gold with 6px side margins.
   - Centre: contract pill — "CONTRACT:" (Nunito 800, gold) + `0xWh4leL0rd2026c0ntrActAddr3ss456` in ui-monospace 700 13px; padding 11px 18px; radius 999px; background `rgba(255,255,255,.06)`; border `1px solid rgba(212,175,55,.5)`. Next to it the **Copy CA** gold button (see Design tokens → gold button). On click: copy the address to the clipboard and show a "Copied!" toast (gold pill, Nunito 800 13px, centred 12px above the pill, `toast` animation 1.8s then removed).
5. **Panel (modal)** — opens on bubble click. Backdrop: fixed, `rgba(5,11,20,.6)`, `backdrop-filter: blur(16px)`, fade-in .25s; click outside closes. Dialog: `width: min(880px, 100%)`, radius 20px, border `1.5px solid rgba(212,175,55,.6)`, background `linear-gradient(180deg, rgba(14,50,80,.75), rgba(11,25,46,.85))`, `backdrop-filter: blur(20px)`, shadow `0 0 0 1px rgba(255,255,255,.06) inset, 0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(212,175,55,.15)`, enter animation .35s `cubic-bezier(.2,.8,.2,1)` (opacity 0→1, translateY 24px→0, scale .96→1).
   - Head (padding 22px 28px, bottom border `1px solid rgba(212,175,55,.25)`): title in Cinzel 700 `clamp(18px, 2.2vw, 28px)` gold gradient text; right side prev/next round buttons (34px, 1.5px gold border, hover `rgba(212,175,55,.15)`) with a "n / 5" counter (Nunito 700 13px, gold, 80% opacity). Keyboard: Esc closes, ←/→ step.
   - Body (grid `minmax(0,1.5fr) minmax(0,1fr)`, gap 24px, padding 24px 28px): left a 16:9 area with the bubble PNG centred at full height (`object-fit: contain`, `drop-shadow(0 16px 36px rgba(0,0,0,.6))`) — no frame or background; right an "ABOUT" eyebrow (Nunito 800 11px, letter-spacing .2em, uppercase, #6fd8f0) and the description in Manrope 400 16px/1.7, #eaf3f8.
   - Foot (padding 16px 28px 24px, top border as head): right-aligned **Close** gold button (14px, padding 12px 28px).

## Content (exact copy) — the `memories` array
Order also sets the panel counter (1–5) and the hover note.

1. **Feasting on the Competition** — `assets/feasting-clear.png` — "Fine dining. The paper hands are delicious tonight. $WHALELORD" — left 15.8%, top 17.8%, size 14.8%
2. **The Vault** — `assets/the-vault.png` — "Collecting memes like they’re infinity stones. We know exactly which bags to hold. Yours should be $WHALELORD." — left 67.3%, top 10.2%, size 15.8%
3. **Here to Stay** — `assets/here-to-stay-v2.png` — "This isn't a leash. It's the anchor holding down the entire market cap. Feel the weight of $WHALELORD." — left 13.3%, top 59.5%, size 16.8%
4. **Nonstop** — `assets/nonstop.png` — "The market never sleeps, and neither do I. While the world dreams, I build the floors they will eventually stand on. Trust the process, trust the chart. $WHALELORD" — left 80%, top 34.8%, size 15.8%
5. **Whale Watch** — `assets/whale-watch-v5.png` — "Just spotted another school of jeets trying to swim against the current. Watching them panic sell is better than Netflix. $WHALELORD." — left 70.2%, top 62.3%, size 16.8%

Other copy: header title "THE WHALE LORD"; link box "$WHALELORD"; bottom bar "OFFICIAL WEBSITE | DIVE INTO DOMINANCE" (twice), "CONTRACT:", "Copy CA", "Copied!"; panel eyebrow "About"; "Close".

## Interactions & behaviour
- Bubble hover: pop transform + gold glow (above) and a synthesized note via Web Audio — sine oscillator, frequency 0.6f → 1.5f (30ms) → f (110ms), gain 0.0001 → 0.22 (12ms) → 0.0001 (140ms), stop at 160ms. Notes per bubble (order above): C5 523.25, D5 587.33, E5 659.25, G5 783.99, A5 880 Hz — sweeping across them plays a pentatonic jingle. Browsers keep the AudioContext suspended until the first pointerdown/keydown; create/resume it there and skip playback while suspended. Expose a single flag to disable the sound.
- Bubble click → open panel for that index. Prev/next wrap around. Esc / ←/→ keyboard. Click backdrop or Close to dismiss.
- Copy CA → `navigator.clipboard.writeText(address)` + toast for 1.8s (re-trigger resets the timer).
- Motion: `mascotBob` 6s, `orbFloat` per-bubble durations/delays, rays 7s/9s, ambient bubbles 9–21s, panel in .35s, backdrop .25s, toast 1.8s. Respect `prefers-reduced-motion` if the codebase does.
- Responsive: desktop-first. The scene keeps its aspect ratio and crops horizontally on narrower screens; bubble 4 (right edge) can clip slightly on 16:9 — acceptable per client. Under 720px: stack the panel body to one column, collapse the footer to a single centred column. Header links stay in one row.

## State
- `open: number | null` — index of the open panel.
- `toast: boolean/timestamp` — toast visibility.
- `hoverSound: boolean` (default true).
- Config: `contract` string, `telegramUrl`, `xUrl`, `tokenUrl`.
No data fetching.

## Design tokens
Colours: abyss `#050b14`, deep `#0b192e`, gold `#d4af37`, gold-light `#f3d97a`, gold-pale `#fff2b0`, gold-dark `#8a6a12`, gold-deep `#b08d24`, gold shadow `#3a2a05`, button text `#1a1200`, ink `#e6f1f7`, panel text `#eaf3f8`, aqua eyebrow `#6fd8f0`, yellow box `#f5d547`, outline `#111`.
Gold gradient text: `linear-gradient(180deg, #fff2b0 0%, #d4af37 45%, #8a6a12 60%, #f3d97a 100%)`.
Gold button: background `linear-gradient(180deg, #f3d97a, #d4af37 55%, #b08d24)`, colour #1a1200, radius 999px, shadow `0 2px 0 #6b520f, 0 0 16px rgba(212,175,55,.35)`, Nunito 800 13px letter-spacing .06em, padding 11px 18px; hover `brightness(1.1)` + translateY(-1px); active translateY(1px), shadow removed.
Type: Cinzel (700/900) for titles; Nunito (500/700/800) for UI; Manrope (400/500) for panel body text; ui-monospace for the address. Google Fonts.
Radii: 999px pills, 50% bubbles, 20px panel. Spacing: 28px page gutter, 18px header vertical, 12px footer vertical, 24px panel body gap.

## Assets (in `assets/`)
- `whale-lord-hd-stage-v3.png` — 2048×1056 full-bleed scene (mascot on anchor; original bubbles blended out; gold brightened; whale grey lightened).
- `feasting-clear.png`, `the-vault.png`, `here-to-stay-v2.png`, `nonstop.png`, `whale-watch-v5.png` — circular bubble PNGs (art + glass rim), used for both the floating bubbles and the panel image.
Telegram and X icons are inline SVG paths in `index.html`.

## Files
- `index.html` — vanilla reference implementation (start here).
- `design_component/The Whale Lord.dc.html` + `support.js` — original design file.

---

## Page 2: Feeding Frenzy (`game.html` + `game.js`)

A 2D side-scrolling arcade mini-game, reachable from the "PLAY" box in the landing-page header. Vanilla Canvas, no framework, no build step.

**Layout** — gold-framed 16:9 canvas (960x540 logical, CSS-scaled) with HUD bands: top-left `JEETS EATEN` (score) + fish-skeleton lives, top-right `FRENZY MULTIPLIER nX (ACTIVE!)`, bottom band level / next-level countdown / best. Right column: `GLOBAL LEADERBOARD (WEEKLY)` (ranks 1-10, top 3 get a crown + gold `REAL WHALE` prefix) and a scrolling `COMMUNITY CHAT` with an input. Same fonts/tokens as the landing page plus Lilita One for the chunky HUD type.

**Controls** — WASD / arrows swim (8-directional). SPACE or the left mouse button bites (mouth opens for 0.36 s). **Hold** either one and the mouth stays wide open until you release, so you eat by moving over food; holding the left button also makes the whale follow the cursor, which is the move-and-eat mechanic (hold and sweep through shoals). Releasing with nothing eaten counts as a MISS. `CFG.chomp.holdMax` caps a hold in seconds (0 = unlimited). P pauses, M mutes, ENTER starts/resumes. Touch: drag = swim and eat.

**Rules** — JEET fish +100, PAPER HANDS +1000 (and +5 streak). Frenzy multiplier = 1 + floor(streak / 5), capped at 5X, applied to every point. Streak resets on an empty bite (a "MISS") or a FUD hit. Biting a torpedo with the open mouth defuses it (+50). 3 lives; a torpedo on the body costs one. Level up every 40 eats (`CFG.eatsPerLevel`): torpedoes get faster (+32 px/s per level, cap 560) and more frequent (interval x0.85 per level, floor 0.5 s), and new formations unlock: pair (L2), wedge + fast-with-warning (L3), wall-with-gap (L4), sine weavers (L5).

**Tuning** — everything lives in the `CFG` block at the top of `game.js`. `flipOnLeft` makes the whale turn around when swimming left (off by default so his mouth always faces the incoming shoals).

**Art / asset loading** — all sprites (whale with tuxedo, red pinstripes, gold chain, cigar, open/closed mouth; JEET fish; PAPER HANDS; FUD torpedo; three parallax reef layers) are drawn procedurally into offscreen canvases at start, so the game runs with zero image files. To use finished art: set `USE_PNG_ASSETS = true` in `game.js` and drop transparent PNGs at the paths in the `ASSETS` map (`assets/game/whale-closed.png`, `whale-open.png`, `jeet-yellow.png`, `jeet-green.png`, `paper-hands.png`, `fud-torpedo.png`, `bg-far.png`, `bg-mid.png`, `bg-near.png`). Each file that loads replaces its procedural fallback; missing ones keep the fallback. Whale faces right (340x170 frame, body centre at 192,72); fish / torpedo / paper face left and are centred; background tiles are 1440x540 and wrap horizontally. Supply 2x images with the same aspect for HiDPI.

**Sound** — synthesized with Web Audio (chomp, eat note that rises with the multiplier, paper-hands cha-ching, defuse, miss, hit, level-up, game over). Unlocked on first key/pointer input; M or the speaker button mutes (remembered).

**Persistence** — best score, leaderboard entries, player name and mute flag live in `localStorage` (`wl.*` keys). The leaderboard is seeded with placeholder names; the header says GLOBAL (WEEKLY) as designed, but scores are local until a backend exists (the small note under the board says so). The community chat is a simulated feed (message pool + reactions to level-ups, hits, paper hands and game over) plus the player's own local messages.

**Debug hooks** — `window.__game` exposes `game`, `whale`, `CFG`, `keys`, `step(dt)`, `start()`, `chomp()` and the entity arrays for console tuning and tests.

**Leaderboard backend** — `server/` holds the Node.js + Express + MongoDB API (`POST /api/session`, `POST /api/submit-score`, `GET /api/leaderboard`) that the game page talks to, plus the integrity checks (signed session tickets, plausibility rules, client signature, rate limits). Setup, endpoint reference, frontend wiring and the threat model are in `server/README.md`. When the API is unreachable the panel falls back to the browser-local board.

**Community chat (shared)** — `chat.js` (simulated feed: message pool, REAL WHALE lines, reactions to game events; `WhaleChat.mount({ log, form, input, name })`) and `chat.css` (message list + input styles) are used by both pages. On the landing page the header's aqua CHAT button (styled like PLAY) toggles a floating chat panel that can be dragged by its header anywhere on the screen (position remembered in `localStorage` as `wl.chatPos`; Esc or × closes it). On the game page the same feed fills the right-hand panel. To go live, replace the tick/add functions in `chat.js` with a WebSocket or polling client.

**Live site** — https://thewhalelord.com (GitHub Pages from the `main` branch of https://github.com/tbj43052/whalelord, DNS on Cloudflare). The `CNAME` file in the repo root binds the domain, keep it. To publish a change: commit on `main` and `git push origin main`. GitHub rebuilds in about 30 s and Cloudflare's edge cache refreshes within about 10 minutes (Cloudflare → Caching → Purge Everything to force it). The hosted copy has no backend, so the leaderboard runs in browser-only mode until the Node server is deployed and `API_BASE` in `game.js` points at it. Cloudflare and browsers cache the CSS/JS for 10 minutes, so when you change any of them bump the `?v=` number on their links in index.html and game.html (currently v=2) to force a fresh copy for everyone.

**UI kit (`ui.css`, shared by both pages)** — type system: Cinzel stays for the wordmark, Outfit 900 for buttons, nav, headers and HUD, Plus Jakarta Sans for UI and body text, JetBrains Mono for the contract address. Header is one translucent bar (`rgba(8,15,30,.75)` + 12px blur, gold hairline). `.nav-btn` = dark glass pill (Telegram, X, PLAY, CHAT, HOME); `.gold-btn` = primary arcade button ($WHALELORD, DIVE IN, SUBMIT, SEND, Copy CA). Both share the tactile states: 4px `#B45309` bottom edge at rest, gold glow and 1px lift on hover, 3px press on click. The contract pill is a terminal block with a blinking cursor; Copy CA flips to a green "COPIED!" for 1.6 s.

**Loading screen** — `loading.js` + `loading.css` mount the "The Whale Lord Loading Screen" component (navy starfield, gold-beveled title, gold-bezel bar with sheen, Cinzel percentage, "LOADING THE DEEP..." caption, anchor mark) as the full-screen overlay `#loading-screen`. Rules: `requestAnimationFrame` drives the bar width and the percentage from 1% to 100% over 2.8 s, advancing at most one whole number per frame so every integer renders in order; if assets finish early the full run still plays; if they are slow the count holds at 99% until `WhaleLoader.done()`, then steps to 100%; at 100% it holds 200 ms, fades over 0.5 s, then is removed. The landing page calls `done()` when its six images are in; the game page after fonts, sprites and reef are built. A 12 s safety timer always releases it. `whale-sprite.js` holds the shared Whale Lord and JEET fish drawings used by the game.
