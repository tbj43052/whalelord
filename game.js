/* ============================================================
   THE WHALE LORD: FEEDING FRENZY   (vanilla Canvas, no deps)
   ------------------------------------------------------------
   All sprites are drawn procedurally (flat cartoon vectors) so
   the game runs with zero art files. To use real art, drop
   transparent PNGs at the paths listed in ASSETS: every file
   that loads replaces its procedural fallback automatically.
   ============================================================ */
'use strict';
const W = 960, H = 540;                        // logical canvas size (16:9); CSS scales it to fit
const TAU = Math.PI * 2;
const CFG = {
  lives: 3,
  eatsPerLevel: 40,                             // fish + paper eaten per level (spec example: 100)
  whale: { speed: 330, accel: 2600, drag: 6 },  // px/s, px/s², exponential drag
  chomp: { open: 0.36, cooldown: 0.1, holdMax: 0 }, // tap = mouth open 0.36 s; HOLD Space / left mouse = stays open; holdMax caps a hold in seconds (0 = unlimited)
  fish: { speed: [95, 150], shoal: [3, 7], interval: [1.3, 2.3] },
  paper: { speed: [55, 80], interval: [7, 12] },
  torpedo: { speed0: 200, speedPerLevel: 32, speedMax: 560, interval0: 2.6, intervalMin: 0.5, intervalDecay: 0.85 },
  score: { jeet: 100, paper: 1000, defuse: 50 },
  streakPerTier: 5, maxMult: 5, paperStreakBonus: 5,
  invuln: 1.6,                                  // seconds of blinking immunity after a hit
  flipOnLeft: false,                            // true = the whale turns around when swimming left
};
// Optional PNG overrides (transparent background). Whale faces RIGHT; fish / torpedo / paper face LEFT.
// Sizes are logical px at 1x; supply 2x images with the same aspect if you want them crisp on HiDPI.
const ASSETS = {
  whaleClosed: 'assets/game/whale-closed.png', // ~340x170, body centre at WHALE_ORIGIN, mouth closed (smirk + cigar)
  whaleOpen:   'assets/game/whale-open.png',   // same framing, mouth open
  jeetYellow:  'assets/game/jeet-yellow.png',  // ~60x44, centred
  jeetGreen:   'assets/game/jeet-green.png',
  paperHands:  'assets/game/paper-hands.png',  // ~60x52, centred
  torpedo:     'assets/game/fud-torpedo.png',  // ~150x50, centred, nose on the left
  bgFar: 'assets/game/bg-far.png', bgMid: 'assets/game/bg-mid.png', bgNear: 'assets/game/bg-near.png', // 1440x540 tiles, wrap horizontally
};
const WHALE_ORIGIN = { x: 192, y: 72 };        // where the whale's body centre sits inside its 340x170 sprite
const USE_PNG_ASSETS = false;                   // set true once the PNGs above exist (false = procedural art only, no 404 probes)
/* ---------- leaderboard backend (server/ folder: see server/README.md) ---------- */
const API_BASE = '';                            // '' = same origin (the Express server also serves this site), or e.g. 'https://api.whalelord.xyz'
const CLIENT_SALT = 'whalelord-frenzy-v1';      // must equal CLIENT_SALT on the server (obscurity only; the server-side checks do the real work)
const LB_PERIOD = 'week';                       // window shown in the panel: 'week' | 'all'
const IMG = {};                                 // loaded overrides keyed like ASSETS
function loadAssets() {
  if (!USE_PNG_ASSETS) return Promise.resolve();
  return Promise.all(Object.entries(ASSETS).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src;
  })));
}

/* ---------- utils ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const fmt = n => Math.round(n).toLocaleString('en-US');
const store = {
  get(k, d) { try { const v = localStorage.getItem('wl.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wl.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let dpr = 1;
function fitCanvas() { dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = W * dpr; canvas.height = H * dpr; }
fitCanvas();

/* ---------- synthesized sound (Web Audio, no files) ---------- */
const SFX = (() => {
  let ac = null, muted = store.get('mute', false);
  function ctxA() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function ok() { const c = ctxA(); return (c && !muted && c.state === 'running') ? c : null; }
  function tone(f0, f1, dur, o = {}) {
    const c = ok(); if (!c) return;
    const t = c.currentTime + (o.delay || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination); osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, o = {}) {
    const c = ok(); if (!c) return;
    const t = c.currentTime + (o.delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0 || 1200, t); f.frequency.exponentialRampToValueAtTime(o.f1 || 120, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(o.gain || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur);
  }
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  return {
    unlock: ctxA,
    get muted() { return muted; }, set muted(v) { muted = !!v; store.set('mute', muted); },
    chomp() { noise(0.12, { f0: 900, f1: 200, gain: 0.18 }); tone(140, 70, 0.12, { gain: 0.15 }); },
    eat(tier) { const f = notes[Math.min(tier, notes.length - 1)]; tone(f * 0.6, f, 0.14, { gain: 0.16 }); },
    paper() { tone(1318, 1318, 0.12, { gain: 0.14, type: 'triangle' }); tone(1760, 1760, 0.3, { gain: 0.14, type: 'triangle', delay: 0.09 }); noise(0.25, { f0: 6000, f1: 2000, gain: 0.06, delay: 0.09 }); },
    defuse() { tone(300, 900, 0.12, { type: 'square', gain: 0.06 }); noise(0.15, { f0: 2500, f1: 500, gain: 0.1 }); },
    miss() { tone(220, 110, 0.16, { type: 'triangle', gain: 0.12 }); },
    hit() { noise(0.4, { f0: 1500, f1: 80, gain: 0.35, q: 1.2 }); tone(90, 28, 0.4, { gain: 0.25 }); },
    levelup() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.18, { type: 'triangle', gain: 0.12, delay: i * 0.09 })); },
    over() { [392, 349.2, 311.1, 261.6].forEach((f, i) => tone(f, f * 0.98, 0.3, { type: 'triangle', gain: 0.12, delay: i * 0.22 })); },
  };
})();

/* ---------- input: keyboard (WASD / arrows / space) + pointer (drag to steer, tap to chomp) ---------- */
let bootT = 0; const booted = () => bootT > 0 && performance.now() - bootT > 400;   // ignore stray Enter/Space while the page is still loading
const keys = new Set();
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'chomp' };
const KEYMAP_KEY = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'chomp' }; // fallback when e.code is empty
const keyOf = e => KEYMAP[e.code] || KEYMAP_KEY[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key];
const isKey = (e, code, key) => e.code === code || (e.key && e.key.toLowerCase() === key);
let chompQueued = false;
const pointer = { active: false, x: 0, y: 0 };
function canvasPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
// Left mouse button / touch: press = bite + the whale swims toward the pointer; HOLD = mouth stays wide open while
// following, so you eat by sweeping over shoals (move-and-eat). Release closes the mouth.
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  SFX.unlock(); const p = canvasPos(e);
  Object.assign(pointer, { active: true, x: p.x, y: p.y });
  chompQueued = true;                                   // guarantees a bite even for a very quick click
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', e => { if (!pointer.active) return; const p = canvasPos(e); pointer.x = p.x; pointer.y = p.y; });
const pointerUp = () => { pointer.active = false; };
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (tag === 'BUTTON' && e.key === 'Enter')) return;
  SFX.unlock();
  const k = keyOf(e);
  if (k) { e.preventDefault(); keys.add(k); if (k === 'chomp' && !e.repeat) { chompQueued = true; if (game.state === 'title' && booted()) startGame(); } }
  if (e.key === 'Enter') { e.preventDefault(); if (booted()) onEnter(); }
  if (isKey(e, 'KeyP', 'p') || e.key === 'Escape') togglePause();
  if (isKey(e, 'KeyM', 'm')) setMute(!SFX.muted);
});
window.addEventListener('keyup', e => { const k = keyOf(e); if (k) keys.delete(k); });
const dropInput = () => { keys.clear(); pointer.active = false; };
window.addEventListener('blur', () => { dropInput(); if (game.state === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) dropInput(); });

/* ============================================================
   PROCEDURAL SPRITES: flat cartoon vectors with thick outlines
   (each is rasterised once at 2x into an offscreen canvas)
   ============================================================ */
const { makeSprite, outline, rr, drawWhale, drawFish, OUT } = window.WhaleSprite;   // shared with loading.js, see whale-sprite.js
/* Crumpled PAPER HANDS note, origin at centre */
function drawPaper(g) {
  const pts = [[-24, -14], [-10, -24], [8, -20], [24, -12], [22, 6], [26, 18], [8, 24], [-8, 20], [-22, 22], [-26, 4]];
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  g.fillStyle = '#f4f1e8'; g.fill(); outline(g, 3);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
  [[-20, -10, -6, 6], [8, -18, 2, 0], [20, 10, 4, 8], [-16, 18, -4, 6]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.font = "900 9px 'Plus Jakarta Sans', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = OUT; g.fillText('PAPER', 0, -5); g.fillText('HANDS', 0, 6);
}

/* FUD torpedo, facing left, origin at centre. frame spins the propeller */
function drawTorpedo(g, frame) {
  const BODY = '#2f3b3c', DARK = '#1c2425';
  g.lineWidth = 3; g.strokeStyle = OUT; g.fillStyle = DARK;
  g.beginPath(); g.moveTo(40, -6); g.lineTo(60, -21); g.lineTo(62, -4); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(40, 6); g.lineTo(60, 21); g.lineTo(62, 4); g.closePath(); g.fill(); g.stroke();
  g.save(); g.translate(64, 0); g.rotate(frame ? 0.9 : 0); g.fillStyle = '#5b6a6b'; g.beginPath(); g.ellipse(0, 0, 4, 14, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
  g.beginPath(); g.moveTo(-40, -14); g.lineTo(50, -12); g.quadraticCurveTo(62, 0, 50, 12); g.lineTo(-40, 14); g.quadraticCurveTo(-72, 6, -72, 0); g.quadraticCurveTo(-72, -6, -40, -14); g.closePath();
  g.fillStyle = BODY; g.fill(); outline(g, 3.5);
  g.beginPath(); g.moveTo(-36, -9); g.lineTo(44, -8); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
  g.beginPath(); g.moveTo(-40, -14); g.quadraticCurveTo(-72, -6, -72, 0); g.quadraticCurveTo(-72, 6, -40, 14); g.closePath(); g.fillStyle = DARK; g.fill(); outline(g, 3);
  g.fillStyle = '#c0262d'; g.fillRect(-22, -9, 40, 18); g.lineWidth = 2.5; g.strokeStyle = OUT; g.strokeRect(-22, -9, 40, 18);
  g.font = "900 12px 'Plus Jakarta Sans', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('FUD', -2, 1);
  g.fillStyle = '#6b7a7b'; [-30, 26, 38].forEach(x => { g.beginPath(); g.arc(x, 0, 2, 0, TAU); g.fill(); });
}

const SPR = {};
function buildSprites() {
  SPR.whale = [0, 1].map(open => [-1, 1].map(kick => makeSprite(340, 170, WHALE_ORIGIN.x, WHALE_ORIGIN.y, g => drawWhale(g, !!open, kick))));
  SPR.fish = { y: [0, 1].map(f => makeSprite(60, 50, 30, 25, g => drawFish(g, '#f2c230', '#b87a10', f))), g: [0, 1].map(f => makeSprite(60, 50, 30, 25, g => drawFish(g, '#7cc243', '#3f7a1c', f))) };
  SPR.paper = makeSprite(60, 52, 30, 26, drawPaper);
  SPR.torp = [0, 1].map(f => makeSprite(150, 50, 76, 25, g => drawTorpedo(g, f)));
}

/* ============================================================
   BACKGROUND: three parallax tiles (1440x540) drawn once
   ============================================================ */
const TILE = 1440;
function makeLayer(seed, draw) { const c = document.createElement('canvas'); c.width = TILE; c.height = H; const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round'; draw(g, seeded(seed)); return c; }
function coral(g, r, x, y, len, ang, depth, color) {
  const segs = [];
  (function grow(x, y, len, ang, d) { if (d === 0 || len < 3) return; const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; segs.push([x, y, x2, y2, d]); grow(x2, y2, len * 0.7, ang - 0.45 - r() * 0.3, d - 1); grow(x2, y2, len * 0.7, ang + 0.45 + r() * 0.3, d - 1); })(x, y, len, ang, depth);
  [['#111', 5], [color, 0]].forEach(([c, extra]) => { g.strokeStyle = c; segs.forEach(([a, b, c2, d, dd]) => { g.lineWidth = dd * 2.4 + 2 + extra; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }); });
}
function fan(g, x, y, rad, color) {
  g.beginPath(); g.moveTo(x, y); g.arc(x, y, rad, Math.PI * 1.1, Math.PI * 1.9); g.closePath(); g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (let a = Math.PI * 1.16; a < Math.PI * 1.9; a += 0.16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * rad * 0.94, y + Math.sin(a) * rad * 0.94); g.stroke(); }
}
function tube(g, x, y, w, h, color) { rr(g, x - w / 2, y - h, w, h, w / 2); g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke(); g.beginPath(); g.ellipse(x, y - h + 3, w / 2 - 3, 4, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill(); }
function weed(g, r, x, y, h, color) { const sway = 10 + r() * 14; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sway, y - h * 0.5, x - sway * 0.4, y - h); g.lineWidth = 9; g.strokeStyle = '#111'; g.stroke(); g.lineWidth = 5; g.strokeStyle = color; g.stroke(); }
function star(g, x, y, rad, color) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rad * 0.45 : rad; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#111'; g.stroke(); }
function mound(g, x, y, w, h, color) { g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w / 4, y - h, x, y - h); g.quadraticCurveTo(x + w / 4, y - h, x + w / 2, y); g.closePath(); g.fillStyle = color; g.fill(); }
const BG = {};
function buildBackground() {
  BG.far = IMG.bgFar || makeLayer(11, (g, r) => {
    g.globalAlpha = 0.16; g.fillStyle = '#bfefff';
    [120, 420, 760, 1100].forEach((x, i) => { g.beginPath(); g.moveTo(x, -20); g.lineTo(x + 90 + i * 20, -20); g.lineTo(x - 140, H + 20); g.lineTo(x - 260, H + 20); g.closePath(); g.fill(); });
    g.globalAlpha = 1;
    for (let i = 0; i < 12; i++) mound(g, r() * TILE, H + 10, 200 + r() * 320, 90 + r() * 140, '#0a3555');
    g.fillStyle = '#0d4468';
    for (let i = 0; i < 14; i++) { const x = r() * TILE, y = 60 + r() * 300, s = 6 + r() * 8; g.beginPath(); g.ellipse(x, y, s, s * 0.5, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x + s, y); g.lineTo(x + s * 1.7, y - s * 0.5); g.lineTo(x + s * 1.7, y + s * 0.5); g.closePath(); g.fill(); }
  });
  BG.mid = IMG.bgMid || makeLayer(23, (g, r) => {
    for (let i = 0; i < 9; i++) mound(g, r() * TILE, H + 10, 160 + r() * 240, 60 + r() * 110, '#123a5a');
    // sunken ship silhouette
    g.fillStyle = '#0b2438'; g.strokeStyle = '#0b2438'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(560, 470); g.lineTo(600, 520); g.lineTo(900, 530); g.lineTo(960, 440); g.lineTo(900, 462); g.lineTo(600, 452); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(740, 455); g.lineTo(760, 300); g.moveTo(690, 340); g.lineTo(830, 322); g.stroke();
    g.beginPath(); g.moveTo(760, 300); g.lineTo(700, 400); g.lineTo(790, 386); g.closePath(); g.fill();
    // treasure chest + coins
    g.fillStyle = '#6b3f1e'; rr(g, 1180, 470, 70, 46, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke();
    g.fillStyle = '#e0b93c'; rr(g, 1176, 458, 78, 18, 6); g.fill(); g.stroke(); g.fillRect(1211, 470, 8, 20); g.strokeRect(1211, 470, 8, 20);
    [[1170, 512], [1262, 514], [1240, 500], [1160, 500]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 8, 4, 0, 0, TAU); g.fillStyle = '#ffd34e'; g.fill(); g.lineWidth = 2; g.stroke(); });
    const cols = ['#2f8f9a', '#8a5aa8', '#c4685a'];
    for (let i = 0; i < 8; i++) coral(g, r, r() * TILE, H + 4, 26 + r() * 22, -Math.PI / 2 + (r() - 0.5) * 0.6, 4, cols[i % 3]);
  });
  BG.near = IMG.bgNear || makeLayer(37, (g, r) => {
    for (let i = 0; i < 10; i++) mound(g, r() * TILE, H + 6, 120 + r() * 200, 30 + r() * 50, '#0e2a44');
    const cols = ['#ff6f9c', '#ff9b3d', '#ffd34e', '#b07cff', '#3fd6c4', '#ff4f6a'];
    for (let i = 0; i < 12; i++) weed(g, r, r() * TILE, H + 4, 60 + r() * 90, '#2f9a5a');
    for (let i = 0; i < 14; i++) coral(g, r, r() * TILE, H + 4, 22 + r() * 26, -Math.PI / 2 + (r() - 0.5) * 0.8, 4, cols[i % cols.length]);
    for (let i = 0; i < 6; i++) fan(g, r() * TILE, H + 2, 40 + r() * 40, cols[(i + 2) % cols.length]);
    for (let i = 0; i < 7; i++) { const x = r() * TILE; tube(g, x, H + 2, 16 + r() * 10, 40 + r() * 50, cols[(i + 4) % cols.length]); tube(g, x + 18, H + 2, 12 + r() * 8, 26 + r() * 30, cols[(i + 1) % cols.length]); }
    for (let i = 0; i < 5; i++) star(g, r() * TILE, H - 6 - r() * 10, 12 + r() * 6, cols[(i * 2) % cols.length]);
  });
  BG.bubbles = Array.from({ length: 28 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 5, s: 18 + Math.random() * 40, w: Math.random() * TAU }));
}

/* ============================================================
   GAME STATE & LOGIC
   ============================================================ */
const game = { state: 'title', t: 0, score: 0, best: store.get('best', 0), lives: CFG.lives, level: 1, eaten: 0, streak: 0, mult: 1, maxMult: 1, shake: 0, banner: null, scroll: 0, timers: { fish: 1, paper: 8, torp: 3 } };
const whale = { x: 240, y: 270, vx: 0, vy: 0, facing: 1, open: false, mouthT: 0, holdT: 0, tired: false, cd: 0, inv: 0, ate: false, kick: 0, tilt: 0 };
let fishes = [], torps = [], papers = [], parts = [], pops = [], warns = [];

function resetRun() {
  Object.assign(game, { t: 0, score: 0, lives: CFG.lives, level: 1, eaten: 0, streak: 0, mult: 1, maxMult: 1, shake: 0, banner: null, timers: { fish: 0.6, paper: rand(5, 8), torp: 2.4 } });
  Object.assign(whale, { x: 240, y: 270, vx: 0, vy: 0, facing: 1, open: false, mouthT: 0, holdT: 0, tired: false, cd: 0, inv: 0, ate: false });
  fishes = []; torps = []; papers = []; parts = []; pops = []; warns = []; chompQueued = false;
}
const torpSpeed = () => Math.min(CFG.torpedo.speedMax, CFG.torpedo.speed0 + CFG.torpedo.speedPerLevel * (game.level - 1));
const torpInterval = () => Math.max(CFG.torpedo.intervalMin, CFG.torpedo.interval0 * Math.pow(CFG.torpedo.intervalDecay, game.level - 1));

/* ---------- spawning ---------- */
function spawnShoal() {
  const n = randi(CFG.fish.shoal[0], CFG.fish.shoal[1]), baseY = rand(90, H - 100), speed = rand(CFG.fish.speed[0], CFG.fish.speed[1]) * (1 + game.level * 0.04);
  for (let i = 0; i < n; i++) fishes.push({ x: W + 60 + i * rand(24, 54) + rand(0, 30), y: clamp(baseY + rand(-50, 50), 70, H - 70), vx: -speed * rand(0.9, 1.1), r: 15, t: rand(0, 10), wob: rand(0, TAU), amp: rand(6, 16), color: Math.random() < 0.55 ? 'y' : 'g' });
}
function spawnPaper() { papers.push({ x: W + 50, y0: rand(110, H - 110), y: 0, vx: -rand(CFG.paper.speed[0], CFG.paper.speed[1]), r: 22, t: rand(0, 10), rot: rand(-0.3, 0.3) }); }
function spawnWave() {
  const L = game.level, speed = torpSpeed(), y = rand(80, H - 80);
  const forms = ['single']; if (L >= 2) forms.push('pair'); if (L >= 3) forms.push('wedge', 'fast'); if (L >= 4) forms.push('wall'); if (L >= 5) forms.push('sine');
  const add = (x, y, s, extra) => torps.push(Object.assign({ x, y, y0: y, vx: -s, t: 0, r: 14 }, extra || {}));
  switch (pick(forms)) {
    case 'single': add(W + 90, y, speed * rand(0.9, 1.15)); break;
    case 'pair': add(W + 90, clamp(y - 50, 60, H - 60), speed); add(W + 90, clamp(y + 50, 60, H - 60), speed); break;
    case 'wedge': add(W + 90, y, speed * 1.05); add(W + 160, clamp(y - 75, 50, H - 50), speed); add(W + 160, clamp(y + 75, 50, H - 50), speed); break;
    case 'fast': { const yy = rand(80, H - 80); warns.push({ y: yy, t: 0.75 }); add(W + 90 + speed * 1.6 * 0.75, yy, speed * 1.6, { fast: true }); break; }
    case 'wall': { const gap = rand(110, H - 110); for (let yy = 45; yy < H; yy += 72) if (Math.abs(yy - gap) > 80) add(W + 90, yy, speed * 0.85); break; }
    case 'sine': add(W + 90, clamp(y, 150, H - 150), speed * 0.9, { sine: true, amp: rand(50, 110), freq: rand(1.5, 2.5) }); add(W + 260, clamp(y, 150, H - 150), speed * 0.9, { sine: true, amp: rand(50, 110), freq: rand(1.5, 2.5), phase: Math.PI }); break;
  }
}

/* ---------- effects ---------- */
function burst(x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = kind === 'boom' ? rand(80, 260) : rand(20, 90);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'bubble' ? 40 : 0), t: 0, life: kind === 'boom' ? rand(0.4, 0.8) : rand(0.5, 1.1), r: kind === 'boom' ? rand(3, 9) : rand(2, 5), kind,
      color: kind === 'boom' ? pick(['#ff7a2f', '#ffd36b', '#c0262d', '#555', '#222']) : kind === 'spark' ? pick(['#ffe45c', '#fff', '#f3d97a']) : 'rgba(200,240,255,.8)' });
  }
}
function popup(x, y, text, color, size, life) { pops.push({ x, y, text, color: color || '#ffe45c', size: size || 18, t: 0, life: life || 0.9 }); }
function tier() { return Math.min(CFG.maxMult, 1 + Math.floor(game.streak / CFG.streakPerTier)); }

/* ---------- scoring events ---------- */
function eat(e, base, kind) {
  whale.ate = true; game.eaten++;
  game.streak += kind === 'paper' ? CFG.paperStreakBonus : 1;
  const before = game.mult; game.mult = tier(); game.maxMult = Math.max(game.maxMult, game.mult);
  const pts = base * game.mult; game.score += pts;
  popup(e.x, e.y - 22, '+' + fmt(pts), kind === 'paper' ? '#ffffff' : '#ffe45c', kind === 'paper' ? 28 : 18, kind === 'paper' ? 1.4 : 0.9);
  if (kind === 'paper') { popup(e.x, e.y - 52, 'PAPER HANDS!', '#7ee081', 16, 1.4); burst(e.x, e.y, 14, 'spark'); SFX.paper(); chatReact('paper'); }
  else SFX.eat(game.mult - 1);
  burst(e.x, e.y, 6, 'bubble');
  if (game.mult > before) { popup(whale.x + 60, whale.y - 80, game.mult + 'X FRENZY!', '#7ee081', 22, 1.2); if (game.mult === CFG.maxMult) chatReact('max'); }
  if (game.eaten % CFG.eatsPerLevel === 0) levelUp();
  if (game.score > game.best) { game.best = game.score; store.set('best', game.best); }
}
function miss() {
  if (game.streak > 0) popup(whale.x + 100, whale.y - 40, 'MISS! FRENZY LOST', '#ff5d5d', 16, 1);
  game.streak = 0; game.mult = 1; SFX.miss();
}
function defuse(tp) {
  whale.ate = true; const pts = CFG.score.defuse * game.mult; game.score += pts;
  popup(tp.x, tp.y - 26, 'FUD DEFUSED +' + pts, '#6fd8f0', 16, 1); burst(tp.x, tp.y, 10, 'boom'); SFX.defuse();
}
function damage(tp) {
  game.lives--; whale.inv = CFG.invuln; game.streak = 0; game.mult = 1; game.shake = 1;
  burst(tp.x, tp.y, 22, 'boom'); popup(whale.x, whale.y - 90, 'FUD HIT!', '#ff5d5d', 26, 1.2); SFX.hit();
  if (game.lives <= 0) gameOver(); else chatReact('hit');
}
function levelUp() {
  game.level++; game.banner = { text: 'LEVEL ' + game.level, sub: pick(['FUD INTENSIFIES!', 'MORE TORPEDOES INCOMING', 'THE MARKET TURNS', 'DIVE DEEPER']), t: 0, life: 2.2 };
  SFX.levelup(); chatReact('level');
}

/* ---------- collision helpers ---------- */
const hit = (c, e) => Math.hypot(c.x - e.x, c.y - e.y) < c.r + e.r;
function torpCircles(tp) { return [[-48, 0, 13], [-10, 0, 14], [30, 0, 13]].map(([dx, dy, r]) => ({ x: tp.x + dx, y: tp.y + dy, r })); }
function torpHit(tp, circles) { const tc = torpCircles(tp); return circles.some(c => tc.some(t => hit(c, t))); }
function mouthCircle() { return { x: whale.x + 100 * whale.facing, y: whale.y + 18, r: 32 }; }
function bodyCircles() { return [[65, -5, 50], [-55, 0, 44], [-125, 45, 26]].map(([dx, dy, r]) => ({ x: whale.x + dx * whale.facing, y: whale.y + dy, r })); }

/* ---------- per-frame update ---------- */
function update(dt) {
  game.t += dt; game.scroll += dt;
  // --- whale movement (tight: high accel, exponential drag, speed cap)
  let ax = 0, ay = 0;
  if (keys.has('left')) ax -= 1; if (keys.has('right')) ax += 1; if (keys.has('up')) ay -= 1; if (keys.has('down')) ay += 1;
  if (pointer.active) { const dx = pointer.x - whale.x, dy = pointer.y - whale.y, d = Math.hypot(dx, dy); if (d > 14) { ax += dx / d; ay += dy / d; } }
  const al = Math.hypot(ax, ay); if (al > 1) { ax /= al; ay /= al; }
  whale.vx += ax * CFG.whale.accel * dt; whale.vy += ay * CFG.whale.accel * dt;
  const drag = Math.exp(-CFG.whale.drag * dt); if (!ax) whale.vx *= drag; if (!ay) whale.vy *= drag;
  const sp = Math.hypot(whale.vx, whale.vy); if (sp > CFG.whale.speed) { whale.vx *= CFG.whale.speed / sp; whale.vy *= CFG.whale.speed / sp; }
  whale.x += whale.vx * dt; whale.y += whale.vy * dt;
  const nx = clamp(whale.x, 175, W - 160), ny = clamp(whale.y, 72, H - 96);
  if (nx !== whale.x) whale.vx = 0; if (ny !== whale.y) whale.vy = 0; whale.x = nx; whale.y = ny;
  if (CFG.flipOnLeft && Math.abs(ax) > 0.2) whale.facing = ax < 0 ? -1 : 1;
  whale.tilt = lerp(whale.tilt, clamp(whale.vy / CFG.whale.speed, -1, 1) * 0.22, 1 - Math.exp(-8 * dt));
  whale.kick = Math.sin(game.t * (6 + sp / 50));
  whale.inv = Math.max(0, whale.inv - dt); game.shake = Math.max(0, game.shake - dt * 2.5);
  // --- bite: a tap opens the mouth for CFG.chomp.open seconds; HOLDING Space or the left mouse button keeps it wide
  //     open until release (eat by moving over food). Closing with nothing eaten is a MISS. holdMax (if > 0) caps a hold.
  whale.cd = Math.max(0, whale.cd - dt);
  const holding = keys.has('chomp') || pointer.active;
  if (!holding) whale.tired = false;
  if (whale.open) {
    chompQueued = false; whale.mouthT -= dt; whale.holdT += dt;
    const capped = CFG.chomp.holdMax > 0 && whale.holdT >= CFG.chomp.holdMax;
    if ((whale.mouthT <= 0 && !holding) || capped) { whale.open = false; whale.cd = CFG.chomp.cooldown; whale.tired = capped; if (!whale.ate) miss(); }
  } else if (whale.cd <= 0 && (chompQueued || (holding && !whale.tired))) {
    whale.open = true; whale.mouthT = CFG.chomp.open; whale.holdT = 0; whale.ate = false; chompQueued = false; SFX.chomp();
  }
  // --- spawners
  const T = game.timers;
  T.fish -= dt; if (T.fish <= 0) { spawnShoal(); T.fish = rand(CFG.fish.interval[0], CFG.fish.interval[1]) * Math.max(0.6, 1 - game.level * 0.03); }
  T.paper -= dt; if (T.paper <= 0) { spawnPaper(); T.paper = rand(CFG.paper.interval[0], CFG.paper.interval[1]); }
  T.torp -= dt; if (T.torp <= 0) { spawnWave(); T.torp = torpInterval() * rand(0.8, 1.2); }
  // --- entities
  for (const f of fishes) { f.t += dt; f.x += f.vx * dt; f.y += Math.cos(f.t * 4 + f.wob) * f.amp * dt; f.frame = Math.floor(f.t * 10) % 2; }
  for (const p of papers) { p.t += dt; p.x += p.vx * dt; p.y = p.y0 + Math.sin(p.t * 2) * 12; }
  for (const tp of torps) {
    tp.t += dt; tp.x += tp.vx * dt; if (tp.sine) tp.y = tp.y0 + Math.sin(tp.t * tp.freq + (tp.phase || 0)) * tp.amp;
    if (Math.random() < dt * 22) parts.push({ x: tp.x + 70, y: tp.y + rand(-6, 6), vx: rand(20, 60), vy: rand(-30, -10), t: 0, life: rand(0.4, 0.9), r: rand(2, 4), kind: 'bubble', color: 'rgba(200,240,255,.7)' });
  }
  for (const w of warns) w.t -= dt;
  // --- collisions
  const body = bodyCircles();
  if (whale.open) {
    const m = mouthCircle();
    for (const f of fishes) if (!f.dead && hit(m, f)) { f.dead = true; eat(f, CFG.score.jeet, 'fish'); }
    for (const p of papers) if (!p.dead && hit(m, p)) { p.dead = true; eat(p, CFG.score.paper, 'paper'); }
    for (const tp of torps) if (!tp.dead && torpHit(tp, [m])) { tp.dead = true; defuse(tp); }
  }
  if (whale.inv <= 0 && game.state === 'playing') for (const tp of torps) if (!tp.dead && torpHit(tp, body)) { tp.dead = true; damage(tp); break; }
  fishes = fishes.filter(f => !f.dead && f.x > -70);
  papers = papers.filter(p => !p.dead && p.x > -70);
  torps = torps.filter(t => !t.dead && t.x > -130);
  warns = warns.filter(w => w.t > 0);
  fxUpdate(dt);
}
function fxUpdate(dt) {
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'bubble') p.vy -= 60 * dt; else if (p.kind === 'boom') { p.vx *= 0.96; p.vy *= 0.96; } else p.vy += 120 * dt; }
  parts = parts.filter(p => p.t < p.life);
  for (const p of pops) { p.t += dt; p.y -= 38 * dt; }
  pops = pops.filter(p => p.t < p.life);
  if (game.banner) { game.banner.t += dt; if (game.banner.t > game.banner.life) game.banner = null; }
  for (const b of BG.bubbles) { b.y -= b.s * dt; b.x += Math.sin(game.t * 1.5 + b.w) * 12 * dt; if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; } }
}

/* ============================================================
   RENDER
   ============================================================ */
function drawLayer(g, layer, speed) { const off = -((game.scroll * speed) % TILE); g.drawImage(layer, off, 0); g.drawImage(layer, off + TILE, 0); }
let VIG = null;
function drawBackground(g) {
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#0f6a97'); grad.addColorStop(0.5, '#0a4470'); grad.addColorStop(1, '#041e33');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  drawLayer(g, BG.far, 18); drawLayer(g, BG.mid, 42); drawLayer(g, BG.near, 80);
  g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(0, 0, W, H);          // translucent black overlay = site-wide dark aesthetic
  g.strokeStyle = 'rgba(190,235,255,.55)'; g.lineWidth = 1.2;
  for (const b of BG.bubbles) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke(); }
}
function drawEntitySprite(g, im, spr, x, y, rot) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot);
  if (im) { const s = spr.w / im.naturalWidth, h = im.naturalHeight * s; g.drawImage(im, -spr.w / 2, -h / 2, spr.w, h); }
  else g.drawImage(spr, -spr.ox, -spr.oy, spr.w, spr.h);
  g.restore();
}
function drawWhaleE(g) {
  g.save(); g.translate(whale.x, whale.y + Math.sin(game.t * 2.5) * 3); g.rotate(whale.tilt); if (whale.facing < 0) g.scale(-1, 1);
  if (whale.inv > 0 && Math.floor(game.t * 14) % 2) g.globalAlpha = 0.35;
  if (IMG.whaleOpen && IMG.whaleClosed) g.drawImage(whale.open ? IMG.whaleOpen : IMG.whaleClosed, -WHALE_ORIGIN.x, -WHALE_ORIGIN.y, 340, 170);
  else { const spr = SPR.whale[whale.open ? 1 : 0][whale.kick > 0 ? 1 : 0]; g.drawImage(spr, -spr.ox, -spr.oy, spr.w, spr.h); }
  g.fillStyle = 'rgba(255,255,255,.4)';
  for (let i = 0; i < 3; i++) { const ph = (game.t * 0.7 + i / 3) % 1; g.globalAlpha = (1 - ph) * 0.35; g.beginPath(); g.arc(142 + ph * 14, 2 - ph * 30, 3 + ph * 6, 0, TAU); g.fill(); }
  g.restore();
}
function drawFishE(g, f) { drawEntitySprite(g, f.color === 'y' ? IMG.jeetYellow : IMG.jeetGreen, SPR.fish[f.color][f.frame || 0], f.x, f.y, Math.sin(f.t * 4 + f.wob) * 0.12); }
function drawPaperE(g, p) { drawEntitySprite(g, IMG.paperHands, SPR.paper, p.x, p.y, p.rot + Math.sin(p.t * 2) * 0.15); }
function drawTorpE(g, tp) {
  const rot = tp.sine ? Math.atan2(-(tp.amp * tp.freq * Math.cos(tp.t * tp.freq + (tp.phase || 0))), -tp.vx) : 0;
  drawEntitySprite(g, IMG.torpedo, SPR.torp[Math.floor(tp.t * 20) % 2], tp.x, tp.y, rot);
}
function drawFx(g) {
  for (const p of parts) {
    const k = 1 - p.t / p.life; g.globalAlpha = k;
    if (p.kind === 'bubble') { g.strokeStyle = p.color; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke(); }
    else { g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.r * (p.kind === 'spark' ? k : 1), 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const p of pops) {
    const k = p.t / p.life; g.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    g.font = "900 " + p.size + "px 'Outfit', 'Plus Jakarta Sans', sans-serif"; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(p.text, p.x, p.y); g.fillStyle = p.color; g.fillText(p.text, p.x, p.y);
  }
  g.globalAlpha = 1;
  for (const w of warns) {
    if (Math.floor(w.t * 10) % 2) continue;
    g.fillStyle = '#ff3b3b'; g.beginPath(); g.moveTo(W - 14, w.y); g.lineTo(W - 44, w.y - 18); g.lineTo(W - 44, w.y + 18); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
    g.fillStyle = '#fff'; g.font = "900 16px 'Outfit', sans-serif"; g.fillText('!', W - 36, w.y + 1);
  }
  if (game.banner) {
    const b = game.banner, k = b.t / b.life, s = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1, a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    g.save(); g.globalAlpha = a; g.translate(W / 2, H * 0.4); g.scale(s, s);
    g.font = "900 64px 'Outfit', sans-serif"; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(b.text, 0, 0); g.fillStyle = '#ffe45c'; g.fillText(b.text, 0, 0);
    g.font = "900 24px 'Outfit', sans-serif"; g.lineWidth = 5; g.strokeText(b.sub, 0, 52); g.fillStyle = '#7ee081'; g.fillText(b.sub, 0, 52);
    g.restore();
  }
}
function render() {
  const g = ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.save(); if (game.shake > 0) g.translate(rand(-1, 1) * game.shake * 10, rand(-1, 1) * game.shake * 10);
  drawBackground(g);
  for (const p of papers) drawPaperE(g, p);
  for (const f of fishes) drawFishE(g, f);
  for (const t of torps) drawTorpE(g, t);
  drawWhaleE(g);
  drawFx(g);
  if (!VIG) { VIG = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); VIG.addColorStop(0, 'rgba(0,0,0,0)'); VIG.addColorStop(1, 'rgba(0,0,0,.45)'); }
  g.fillStyle = VIG; g.fillRect(-20, -20, W + 40, H + 40);
  g.restore();
}

/* ============================================================
   HUD, OVERLAYS, LEADERBOARD, CHAT
   ============================================================ */
const LIFE_SVG = '<svg viewBox="0 0 60 32" aria-hidden="true"><g fill="none" stroke="#f7f1d6" stroke-width="3" stroke-linecap="round"><path d="M10 16h32"/><path d="M18 8v16M27 7v18M36 8v16"/></g><path d="M42 16l14-9v18z" fill="#f7f1d6"/><path d="M12 16a8 8 0 1 1-1-3.5z" fill="#f7f1d6"/><circle cx="8" cy="14.5" r="1.7" fill="#000"/></svg>';
const hud = { score: $('score'), mult: $('mult'), active: $('active'), lives: $('lives'), level: $('level'), next: $('next'), best: $('best') };
const hudLast = {};
function setText(el, v) { if (hudLast[el.id] !== v) { hudLast[el.id] = v; el.textContent = v; } }
function updateHud() {
  setText(hud.score, fmt(game.score)); setText(hud.mult, game.mult + 'X');
  setText(hud.active, game.mult >= CFG.maxMult ? '(MAX!)' : game.mult > 1 ? '(ACTIVE!)' : '');
  setText(hud.level, String(game.level)); setText(hud.next, String(CFG.eatsPerLevel - (game.eaten % CFG.eatsPerLevel))); setText(hud.best, fmt(game.best));
  if (hudLast.lives !== game.lives) { hudLast.lives = game.lives; [...hud.lives.children].forEach((el, i) => el.classList.toggle('lost', i >= game.lives)); }
}
const overlay = $('overlay'), cards = { title: $('ov-title'), pause: $('ov-pause'), over: $('ov-over') };
function showCard(name) { overlay.hidden = !name; for (const k in cards) cards[k].hidden = k !== name; }
function startGame() {
  const nameEl = $('name-start'), nm = nameEl.value.trim();
  if (nm && !NAME_RE.test(nm)) { nameEl.classList.add('bad'); nameEl.focus(); return; }   // bad name: stay on the card
  nameEl.classList.remove('bad'); if (nm) store.set('name', nm);
  resetRun(); game.state = 'playing'; showCard(null); updateHud(); SFX.unlock(); openSession();
}
function togglePause() {
  if (game.state === 'playing') { game.state = 'paused'; showCard('pause'); }
  else if (game.state === 'paused') { game.state = 'playing'; showCard(null); }
}
function gameOver() {
  game.state = 'over'; SFX.over(); chatReact('over');
  $('o-score').textContent = fmt(game.score); $('o-level').textContent = game.level; $('o-eaten').textContent = game.eaten; $('o-mult').textContent = game.maxMult + 'X'; $('o-best').textContent = fmt(game.best);
  const name = store.get('name', '');
  $('name').value = name; $('name').classList.remove('bad'); $('submit-form').hidden = !!name; $('submit-status').hidden = true; showCard('over');
  if (name) finishSubmit(name); else setTimeout(() => $('name').focus(), 50);   // no name yet → ask for one, then submit
}
function onEnter() { if (game.state === 'title') startGame(); else if (game.state === 'paused') togglePause(); else if (game.state === 'over' && $('submit-form').hidden) startGame(); }
function setMute(v) { SFX.muted = v; $('mute').textContent = v ? '🔇' : '🔊'; $('mute').setAttribute('aria-pressed', String(!!v)); }

const SEED_LB = [['RealWhale', 12400], ['sotalpreops', 9800], ['papersakoe', 8600], ['modiy', 7100], ['unmish', 6400], ['suhuse', 5200], ['deepbagz', 4700], ['krillionaire', 3900], ['orcaOG', 3100], ['plankton_pete', 2200]];
function getLB() { let lb = store.get('lb', null); if (!Array.isArray(lb) || !lb.length) { lb = SEED_LB.map(([name, score]) => ({ name, score })); store.set('lb', lb); } return lb; }
const CROWNS = ['#ffd23f', '#dfe6ee', '#e0863a'];
const crown = c => `<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M2 15h20l-2-11-5 4-3-6-3 6-5-4z" fill="${c}" stroke="#3a2a05" stroke-width="1.2"/><rect x="2" y="15" width="20" height="3.5" fill="${c}" stroke="#3a2a05" stroke-width="1.2"/></svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderLB() {
  const me = store.get('name', '').toLowerCase();
  const lb = net.online ? net.board : getLB().slice().sort((a, b) => b.score - a.score).slice(0, 10);
  $('lb').innerHTML = lb.length
    ? lb.map((e, i) => `<li class="${i < 3 ? 'top' : ''}${me && e.name.toLowerCase() === me ? ' me' : ''}"><span class="rank">${i + 1}</span><span class="crown">${i < 3 ? crown(CROWNS[i]) : ''}</span><span class="name">${i < 3 ? '<span class="tag">REAL WHALE</span>' : ''}${esc(e.name)}</span><span class="pts">${fmt(e.score)}</span></li>`).join('')
    : '<li class="empty">No scores yet this week. Be the first REAL WHALE.</li>';
  $('lb-note').textContent = net.online ? 'Live scores. Best run per player. Resets weekly.' : 'Offline mode active. Scores stay local until the server connects.';
}
function submitScore(name, score) { const lb = getLB(); lb.push({ name, score }); lb.sort((a, b) => b.score - a.score); lb.splice(10); store.set('lb', lb); store.set('name', name); renderLB(); }

/* ============================================================
   ONLINE LEADERBOARD (server/ API). Falls back to the local board above when the API is unreachable.
   Flow: page load → GET /api/leaderboard · run starts → POST /api/session (signed ticket) ·
         game over → POST /api/submit-score { username, score, ticket, sig, stats }
   ============================================================ */
const NAME_RE = /^[A-Za-z0-9_.-]{2,16}$/;
const net = { online: false, ticket: null, board: [] };
async function apiFetch(path, opts = {}, timeoutMs = 6000) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(API_BASE + path, Object.assign({ signal: ac.signal, headers: { 'Content-Type': 'application/json' } }, opts));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  } finally { clearTimeout(timer); }
}
async function refreshLeaderboard() {
  try {
    const rows = await apiFetch('/api/leaderboard?period=' + LB_PERIOD);
    if (!Array.isArray(rows)) throw new Error('bad payload');
    net.online = true; net.board = rows.map(r => ({ name: String(r.username), score: Number(r.score) || 0 }));
  } catch (e) { net.online = false; net.board = []; }
  renderLB();
}
async function openSession() {                 // called when a run starts; the ticket proves to the server when the game began
  net.ticket = null; if (!net.online) return;
  try { net.ticket = (await apiFetch('/api/session', { method: 'POST', body: '{}' })).ticket || null; } catch (e) { net.ticket = null; }
}
async function sha256Hex(str) {
  if (window.crypto && crypto.subtle) {        // secure contexts (https / localhost)
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(str);
}
async function submitOnline(name) {
  const stats = { eaten: game.eaten, level: game.level, durationMs: Math.round(game.t * 1000) };
  const payload = { username: name, score: game.score, ticket: net.ticket, stats };
  payload.sig = await sha256Hex([net.ticket, name, game.score, stats.eaten, stats.level, stats.durationMs, CLIENT_SALT].join('|'));
  const d = await apiFetch('/api/submit-score', { method: 'POST', body: JSON.stringify(payload) });
  net.ticket = null; await refreshLeaderboard(); return d;
}
async function finishSubmit(name) {
  const st = $('submit-status'); st.hidden = false; $('submit-form').hidden = true;
  if (game.score <= 0) { st.textContent = 'No points this run. Nothing to submit.'; return; }
  if (!net.online) { submitScore(name, game.score); st.textContent = 'Leaderboard offline. Score saved locally.'; return; }
  if (!net.ticket) { st.textContent = 'This run cannot be ranked. Start a new game to compete.'; return; }
  st.textContent = 'Submitting score';
  try { const d = await submitOnline(name); st.textContent = d.rank ? 'Saved. You are #' + d.rank + ' this week.' : 'Score saved.'; }
  catch (e) { st.textContent = 'Score rejected: ' + e.message; }
}
/* Plain-JS SHA-256 for non-secure (http) origins where crypto.subtle is unavailable. */
function sha256Fallback(str) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const bytes = new TextEncoder().encode(str), l = bytes.length, padLen = Math.ceil((l + 9) / 64) * 64;
  const buf = new Uint8Array(padLen); buf.set(bytes); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(padLen - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(padLen - 4, (l * 8) >>> 0);
  const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10)); }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}

/* community chat: the feed lives in chat.js (shared with the landing page's floating panel) */
let chat = null;
function chatReact(kind) { if (chat) chat.react(kind, { L: game.level }); }

/* ============================================================
   LOOP & INIT
   ============================================================ */
function tick(dt) {
  if (game.state === 'playing') update(dt);
  else if (game.state !== 'paused') { game.t += dt; game.scroll += dt * 0.5; whale.kick = Math.sin(game.t * 5); fxUpdate(dt); }
  render(); updateHud();
}
async function init() {
  WhaleLoader.start();                                   // "Deep Dive" screen until fonts, sprites and the reef are built
  hud.lives.innerHTML = LIFE_SVG.repeat(CFG.lives);
  setMute(SFX.muted); renderLB(); refreshLeaderboard(); $('name-start').value = store.get('name', '');
  chat = WhaleChat.mount({ log: $('chat-log'), form: $('chat-form'), input: $('chat-input'), name: () => store.get('name', '') });
  $('start').onclick = startGame; $('again').onclick = startGame; $('resume').onclick = togglePause; $('mute').onclick = () => setMute(!SFX.muted);
  overlay.addEventListener('click', e => { if (game.state === 'title' && e.target === overlay) startGame(); });
  $('name-start').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); startGame(); } });
  $('name-start').addEventListener('input', () => $('name-start').classList.remove('bad'));
  $('submit-form').addEventListener('submit', e => {
    e.preventDefault(); const name = $('name').value.trim();
    if (!NAME_RE.test(name)) { $('name').classList.add('bad'); return; }
    store.set('name', name); $('name-start').value = name; finishSubmit(name);
  });
  const fonts = Promise.race([Promise.all([document.fonts.load("800 12px 'Plus Jakarta Sans'"), document.fonts.load("900 16px 'Outfit'")]), new Promise(r => setTimeout(r, 2500))]);
  await Promise.all([loadAssets(), fonts]); WhaleLoader.set(0.5);
  buildSprites(); WhaleLoader.set(0.75); buildBackground(); WhaleLoader.set(0.95);
  $('best-title').textContent = fmt(game.best); WhaleLoader.done(); showCard('title'); updateHud();
  // debug / test hooks (also handy for tuning from the console)
  window.__game = { game, whale, CFG, keys, pointer, step: tick, start: startGame, chomp: () => { chompQueued = true; }, get fishes() { return fishes; }, get torps() { return torps; }, get papers() { return papers; } };
  bootT = performance.now();
  let last = performance.now();
  requestAnimationFrame(function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt); requestAnimationFrame(frame); });
}
init();
