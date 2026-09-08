'use strict';
/* Integrity helpers: signed session tickets, plausibility rules, and the client signature check.
   See README "Integrity model" for what each layer does (and does not) protect against. */
const crypto = require('crypto');

const SERVER_SECRET = process.env.SERVER_SECRET || 'dev-only-secret-change-me';
const CLIENT_SALT = process.env.CLIENT_SALT || 'whalelord-frenzy-v1';   // must match CLIENT_SALT in ../game.js
const TICKET_TTL_MS = 2 * 60 * 60 * 1000;                                // a game session may last up to 2 h

// Plausibility ceilings derived from the game's tuning (CFG in game.js). Loosen them if you change the game.
const RULES = {
  usernameRe: /^[A-Za-z0-9_.-]{2,16}$/,
  maxScore: 10_000_000,
  minGameSec: 3,          // a non-zero score needs at least this much session time
  maxPointsPerSec: 4000,  // theoretical ceiling is ~3750/s (7 fish per ~0.8 s at 5X, plus paper hands)
  maxEatsPerSec: 8,
  maxPointsPerEat: 5000,  // PAPER HANDS at 5X
  maxDefusePerSec: 600,   // points possible without eating anything (torpedo defuses)
  durationSlackMs: 5000,  // reported play time may exceed the ticket age by at most this much
};

const hmac = s => crypto.createHmac('sha256', SERVER_SECRET).update(s).digest('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
function safeEq(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Ticket = "<id>.<startMs>.<hmac(id.startMs)>". The start time is inside the signature, so a client
   cannot back-date a session to make a fake score look plausible, and cannot mint tickets at all. */
function issueTicket() {
  const id = crypto.randomBytes(12).toString('hex'), start = Date.now();
  return `${id}.${start}.${hmac(`${id}.${start}`)}`;
}
function verifyTicket(ticket) {
  const m = /^([a-f0-9]{24})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(String(ticket || ''));
  if (!m) return null;
  const [, id, startStr, sig] = m;
  if (!safeEq(sig, hmac(`${id}.${startStr}`))) return null;
  const start = Number(startStr), elapsedMs = Date.now() - start;
  if (elapsedMs < 0 || elapsedMs > TICKET_TTL_MS) return null;
  return { id, start, elapsedMs };
}

/* The browser signs the exact tuple it submits (same formula in game.js → submitOnline). */
function expectedSignature({ ticket, username, score, eaten, level, durationMs }) {
  return sha256([ticket, username, score, eaten, level, durationMs, CLIENT_SALT].join('|'));
}

/* null when the numbers could come from a real run of that length, otherwise a reason string. */
function implausible({ score, eaten, durationMs }, t) {
  const sec = t.elapsedMs / 1000;
  if (score > 0 && sec < RULES.minGameSec) return 'session too short for a score';
  if (score > sec * RULES.maxPointsPerSec + 1000) return 'score too high for the session length';
  if (eaten > sec * RULES.maxEatsPerSec + 10) return 'too many eats for the session length';
  if (score > eaten * RULES.maxPointsPerEat + sec * RULES.maxDefusePerSec + 1000) return 'score too high for the number of eats';
  if (durationMs > t.elapsedMs + RULES.durationSlackMs) return 'reported duration exceeds the session';
  return null;
}

module.exports = { RULES, CLIENT_SALT, issueTicket, verifyTicket, expectedSignature, implausible, safeEq, sha256 };
