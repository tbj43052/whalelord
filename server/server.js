'use strict';
/* The Whale Lord — leaderboard API + static host.
   Serves the site one level up (index.html, game.html, assets/) and the REST API under /api. */
require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Score = require('./models/Score');
const { RULES, issueTicket, verifyTicket, expectedSignature, implausible, safeEq } = require('./integrity');

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/whalelord';
const SITE_DIR = path.join(__dirname, '..');

const app = express();
app.set('trust proxy', 1);                     // correct req.ip behind a reverse proxy / PaaS
app.disable('x-powered-by');
if (process.env.ALLOWED_ORIGIN) app.use(cors({ origin: process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '4kb' }));

/* ---- tiny in-memory rate limiter (per IP, per route) ---- */
const buckets = new Map();
function limit(name, max, windowMs = 10 * 60 * 1000) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`, now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
    if (++b.n > max) return res.status(429).json({ ok: false, error: 'too many requests, slow down' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60_000).unref();

const bad = (res, error, status = 400) => res.status(status).json({ ok: false, error });
const uint = v => (Number.isInteger(v) && v >= 0 ? v : null);

/* ---- best score per player (case-insensitive), highest first, optional 7-day window ---- */
async function leaderboard(period = 'week', limitN = 10) {
  const match = period === 'week' ? { timestamp: { $gte: new Date(Date.now() - 7 * 86_400_000) } } : {};
  return Score.aggregate([
    { $match: match },
    { $sort: { score: -1, timestamp: 1 } },
    { $group: { _id: { $toLower: '$username' }, username: { $first: '$username' }, score: { $first: '$score' }, timestamp: { $first: '$timestamp' } } },
    { $sort: { score: -1, timestamp: 1 } },
    { $limit: limitN },
    { $project: { _id: 0, username: 1, score: 1, timestamp: 1 } },
  ]);
}

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

/* ENDPOINT 0 — start of a run: a signed ticket that proves when the game began (needed by submit-score). */
app.post('/api/session', limit('session', 30), (req, res) => res.json({ ok: true, ticket: issueTicket() }));

/* ENDPOINT 2 — GET /api/leaderboard?period=week|all → [{ username, score, timestamp }, ...] (top 10) */
app.get('/api/leaderboard', limit('board', 120), async (req, res, next) => {
  try { res.json(await leaderboard(req.query.period === 'all' ? 'all' : 'week', 10)); } catch (e) { next(e); }
});

/* ENDPOINT 1 — POST /api/submit-score { username, score, ticket, sig, stats: { eaten, level, durationMs } } */
app.post('/api/submit-score', limit('submit', 20), async (req, res, next) => {
  try {
    const body = req.body || {}, stats = body.stats || {};
    // 1) shape validation
    const username = String(body.username || '').trim();
    if (!RULES.usernameRe.test(username)) return bad(res, 'username must be 2-16 letters, digits, _ . -');
    const score = body.score;
    if (!Number.isInteger(score) || score < 0 || score > RULES.maxScore) return bad(res, 'score must be a non-negative integer');
    const eaten = uint(stats.eaten), level = uint(stats.level), durationMs = uint(stats.durationMs);
    if (eaten === null || level === null || durationMs === null) return bad(res, 'stats.eaten, stats.level and stats.durationMs must be non-negative integers');
    // 2) the session ticket must be genuine, unexpired and (below) unused
    const t = verifyTicket(body.ticket);
    if (!t) return bad(res, 'missing, forged or expired session ticket', 401);
    // 3) the numbers must be achievable in a game that started when the ticket says
    const why = implausible({ score, eaten, durationMs }, t);
    if (why) return bad(res, why, 422);
    // 4) the client signature must match the submitted tuple
    if (!safeEq(body.sig, expectedSignature({ ticket: body.ticket, username, score, eaten, level, durationMs }))) return bad(res, 'bad signature', 401);
    // 5) save (the unique index on session rejects a second submission for the same run)
    let doc;
    try { doc = await Score.create({ username, score, session: t.id, level, eaten, durationMs, ip: req.ip }); }
    catch (e) { if (e && e.code === 11000) return bad(res, 'this game session was already submitted', 409); throw e; }
    const board = await leaderboard('week', 100);
    const rank = board.findIndex(r => r.username.toLowerCase() === username.toLowerCase()) + 1;
    res.status(201).json({ ok: true, id: doc._id, rank: rank || null });
  } catch (e) { next(e); }
});

app.all('/api/*', (req, res) => bad(res, 'not found', 404));
app.use(express.static(SITE_DIR, { extensions: ['html'] }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return bad(res, 'invalid JSON body');
  console.error(err);
  bad(res, 'server error', 500);
});

mongoose.connect(MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`Whale Lord server → http://localhost:${PORT}   (db: ${MONGODB_URI})`));
}).catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
