# Feeding Frenzy — leaderboard backend

Node.js + Express + MongoDB (Mongoose). Serves the site (one folder up) **and** the REST API, so the game can call the API on the same origin (`API_BASE = ''` in `game.js`).

## Run it

```bash
cd server
npm install
cp .env.example .env        # then edit: MONGODB_URI, SERVER_SECRET (long random string)
npm start                   # or: npm run dev  (auto-restart on change)
```

Open <http://localhost:3000/> (landing page) or <http://localhost:3000/game.html>. `GET /api/health` reports `{ ok, db }`.
MongoDB: a local `mongod`, or a free Atlas cluster (`mongodb+srv://...` in `MONGODB_URI`). Deploying elsewhere (Render, Railway, Fly, a VPS behind nginx): set the env vars, keep `trust proxy` on, and if the static site lives on another host set `ALLOWED_ORIGIN` and point `API_BASE` in `game.js` at the API.

## Data model — `models/Score.js`

| field | type | notes |
|---|---|---|
| `username` | String, required, indexed | 2–16 chars, `[A-Za-z0-9_.-]` |
| `score` | Number (integer), required, indexed | the "JEETS EATEN" points |
| `timestamp` | Date, default `Date.now`, indexed | when the run was submitted |
| `session` | String, unique | ticket id — one submission per game session |
| `level`, `eaten`, `durationMs`, `ip` | bookkeeping | used by the plausibility checks / abuse review |

Compound indexes: `{ score: -1, timestamp: 1 }` and `{ timestamp: -1, score: -1 }`.

## Endpoints

| method | path | body / query | response |
|---|---|---|---|
| POST | `/api/session` | – | `{ ok, ticket }` — call when a run starts |
| GET | `/api/leaderboard` | `?period=week` (default) or `all` | `[{ username, score, timestamp }, …]` top 10, **one entry per player (their best)**, `score` descending |
| POST | `/api/submit-score` | `{ username, score, ticket, sig, stats: { eaten, level, durationMs } }` | `201 { ok, id, rank }` or `4xx { ok:false, error }` |

The leaderboard is an aggregation: filter to the period → sort by score → `$group` by lower-cased username taking the first (best) → sort → limit 10. Rate limits per IP: 30 sessions, 20 submits, 120 board reads per 10 minutes (in-memory; swap for `express-rate-limit` + Redis if you run several instances).

## Frontend integration (already wired in `../game.js`)

1. **Page load** — `init()` calls `refreshLeaderboard()`, which does `fetch(API_BASE + '/api/leaderboard?period=week')`, maps `{ username, score }` rows into the panel and switches `net.online = true`. If the request fails or times out (6 s), the panel falls back to the browser-local leaderboard and the note under it says so.
2. **Run start** — `startGame()` reads the name from the title card (stored in `localStorage` as `wl.name`) and calls `openSession()` → `POST /api/session`, keeping the returned `ticket` for this run.
3. **Game over** — `gameOver()` → `finishSubmit(name)` → `submitOnline(name)` builds `{ username, score, ticket, stats }`, computes `sig = SHA-256(ticket|username|score|eaten|level|durationMs|CLIENT_SALT)` (Web Crypto, with a plain-JS fallback for http origins), `POST`s it, then re-fetches the board and shows "Saved! You are #N this week." or the server's rejection reason. If no name was entered on the title card, the game-over card asks for one first.

## Integrity model (what stops Postman)

1. **Shape validation** (server) — username regex, integer score within range, integer stats, JSON body ≤ 4 kB.
2. **Signed session ticket** — `POST /api/session` returns `id.startMs.HMAC(SERVER_SECRET, id.startMs)`. The secret never leaves the server, so clients cannot mint tickets or back-date the start time. Tickets expire after 2 h and the unique `session` index makes each ticket good for exactly one submission (a replay gets `409`).
3. **Plausibility** (`integrity.js → implausible`) — the score must be reachable in a game that started when the ticket says: ≤ 4000 points per second of session time, ≤ 8 eats per second, ≤ 5000 points per eat (+ a defuse allowance), a non-zero score needs ≥ 3 s, and the reported play time cannot exceed the ticket age. A forged "150 000 points" needs a ticket that is at least ~38 s old and a matching eat count.
4. **Client signature** — the browser signs the exact tuple it submits with `CLIENT_SALT`; the server recomputes and compares (constant-time). This stops casual tampering (editing the score in the request) and naive replays with edited fields.
5. **Rate limiting** per IP.

What it does **not** stop: someone who reads `game.js`, waits out the plausibility window and submits a signed, plausible fake. That is inherent to any browser game — the client is untrusted. If the titles ever carry real value, the next steps are server-authoritative event logs (send the eat/hit event stream, let the server replay the scoring), Turnstile/reCAPTCHA on submit, and account login. Also: rotate `SERVER_SECRET` if it leaks (all outstanding tickets become invalid, nothing stored is affected), and keep `CLIENT_SALT` identical in `.env` and `game.js`.

## Preview without Node

`../.claude/serve.ps1` (the PowerShell dev server used by the Browser pane) mirrors these three endpoints with the same rules, storing scores in a JSON file. It exists only so the page can be exercised end-to-end on a machine without Node; the real implementation is this folder.
