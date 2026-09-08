/* ============================================================
   SHARED PROCEDURAL SPRITES: The Whale Lord (tuxedo, red pinstripes, gold chain, cigar) and the JEET fish.
   Flat cartoon vectors with thick outlines, rasterised at 2x by makeSprite(). Used by game.js and loading.js.
   ============================================================ */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
const OUT = '#161616';
function makeSprite(w, h, ox, oy, draw) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d'); g.scale(2, 2); g.translate(ox, oy); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g); c.w = w; c.h = h; c.ox = ox; c.oy = oy; return c;
}
function outline(g, lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* The Whale Lord, facing right, origin at body centre. open = mouth state, kick = -1..1 leg pose */
function drawWhale(g, open, kick) {
  const GREY = '#a7b4c1', GREY2 = '#8e9cab', WHITE = '#f1f5f8', TUX = '#141416', RED = '#b8222e', GOLD = '#e6bd3c';
  // back arm (behind the body)
  g.beginPath(); g.moveTo(-60, -22); g.lineTo(-128, -50); g.lineWidth = 26; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 18; g.strokeStyle = TUX; g.stroke();
  g.beginPath(); g.arc(-131, -52, 13, 0, TAU); g.fillStyle = GREY2; g.fill(); outline(g, 3.5);
  // legs + shoes (swimming kick)
  [[-95, 22, -150, 36 + kick * 14], [-90, 38, -140, 66 - kick * 12]].forEach(([x0, y0, x1, y1]) => {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 30; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 22; g.strokeStyle = TUX; g.stroke();
    g.save(); g.translate(x1 - 4, y1 + 2); g.rotate(Math.atan2(y1 - y0, x1 - x0));
    g.beginPath(); g.ellipse(-10, 0, 20, 10, 0, 0, TAU); g.fillStyle = '#0d0d0f'; g.fill(); outline(g, 3.5);
    g.beginPath(); g.ellipse(-16, -3, 6, 2.5, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    g.restore();
  });
  // tuxedo torso with red pinstripes
  const torso = new Path2D('M -120 -30 C -128 -50 -110 -58 -85 -58 L -5 -52 C 15 -50 20 -20 18 0 C 20 25 12 50 -10 52 L -95 46 C -122 44 -128 -10 -120 -30 Z');
  g.fillStyle = TUX; g.fill(torso);
  g.save(); g.clip(torso); g.strokeStyle = RED; g.lineWidth = 1.6; g.globalAlpha = 0.8;
  for (let x = -118; x < 24; x += 9) { g.beginPath(); g.moveTo(x, -62); g.lineTo(x - 6, 62); g.stroke(); }
  g.restore(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(torso);
  // shirt, lapels, tie, buttons
  g.beginPath(); g.moveTo(-40, -50); g.lineTo(-10, 6); g.lineTo(16, -48); g.closePath(); g.fillStyle = WHITE; g.fill();
  g.fillStyle = '#26262b';
  g.beginPath(); g.moveTo(-42, -52); g.lineTo(-16, -26); g.lineTo(-24, 8); g.lineTo(-48, -20); g.closePath(); g.fill(); outline(g, 3);
  g.beginPath(); g.moveTo(18, -50); g.lineTo(2, -26); g.lineTo(2, 8); g.lineTo(26, -14); g.closePath(); g.fill(); outline(g, 3);
  g.fillStyle = GOLD; g.beginPath(); g.moveTo(-14, -34); g.lineTo(-6, -34); g.lineTo(0, 0); g.lineTo(-10, 8); g.lineTo(-20, 0); g.closePath(); g.fill(); outline(g, 2.5);
  [[-60, -10], [-60, 12], [-38, -6], [-38, 16]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fillStyle = GOLD; g.fill(); outline(g, 2); });
  // gold chain + anchor pendant
  g.beginPath(); g.moveTo(-22, -36); g.quadraticCurveTo(-30, 34, 22, -36); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke();
  g.lineWidth = 4; g.strokeStyle = GOLD; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
  g.save(); g.translate(-8, 20); g.strokeStyle = OUT; g.lineWidth = 6.5; g.lineCap = 'round';
  const anchor = () => { g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 12); g.moveTo(-8, 0); g.lineTo(8, 0); g.moveTo(-10, 5); g.quadraticCurveTo(0, 18, 10, 5); g.stroke(); g.beginPath(); g.arc(0, -11, 3, 0, TAU); g.stroke(); };
  anchor(); g.strokeStyle = GOLD; g.lineWidth = 3.2; anchor(); g.restore();
  // head (grey top, white jaw). Two silhouettes: closed smirk vs dropped jaw
  const head = new Path2D(open
    ? 'M -40 -52 C 10 -70 90 -66 118 -30 C 132 -12 130 8 122 22 L 112 44 C 100 70 60 74 30 62 C 0 54 -30 30 -40 0 C -46 -20 -46 -40 -40 -52 Z'
    : 'M -40 -52 C 10 -70 90 -66 118 -30 C 132 -12 132 14 120 30 C 105 50 60 56 20 52 C -10 48 -30 30 -40 0 C -46 -20 -46 -40 -40 -52 Z');
  g.fillStyle = GREY; g.fill(head);
  g.save(); g.clip(head);
  g.fillStyle = WHITE; g.beginPath(); g.moveTo(-50, 36); g.quadraticCurveTo(40, 34, 122, 6); g.lineTo(150, 100); g.lineTo(-50, 100); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 2;
  [46, 56, 66].forEach(y => { g.beginPath(); g.moveTo(-30, y); g.quadraticCurveTo(40, y - 14, 118, y - 22); g.stroke(); });
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 7; g.beginPath(); g.moveTo(-10, -52); g.quadraticCurveTo(50, -66, 100, -46); g.stroke();
  g.restore(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(head);
  if (open) {
    g.fillStyle = '#5c1622'; g.beginPath(); g.moveTo(40, 22); g.quadraticCurveTo(90, 0, 124, 2); g.quadraticCurveTo(122, 40, 96, 56); g.quadraticCurveTo(60, 60, 40, 22); g.closePath(); g.fill(); outline(g, 3.5);
    g.fillStyle = WHITE;
    for (let i = 0; i < 6; i++) { const x = 52 + i * 12, dy = -i * 1.6; g.beginPath(); g.moveTo(x, 12 + dy); g.lineTo(x + 10, 10 + dy); g.lineTo(x + 5, 22 + dy); g.closePath(); g.fill(); }
    g.fillStyle = '#e2607e'; g.beginPath(); g.ellipse(82, 46, 22, 8, -0.25, 0, TAU); g.fill();
  } else {
    g.beginPath(); g.moveTo(-20, 33); g.quadraticCurveTo(50, 31, 118, 6); g.quadraticCurveTo(124, 4, 126, -4); g.lineWidth = 3.5; g.strokeStyle = OUT; g.stroke();
  }
  // eye with heavy smug lid + brow
  g.beginPath(); g.ellipse(74, -24, 15, 12, 0, 0, TAU); g.fillStyle = WHITE; g.fill(); outline(g, 3);
  g.beginPath(); g.arc(80, -22, 6, 0, TAU); g.fillStyle = '#111'; g.fill();
  g.beginPath(); g.arc(82, -24, 2, 0, TAU); g.fillStyle = '#fff'; g.fill();
  g.fillStyle = GREY; g.beginPath(); g.moveTo(56, -40); g.lineTo(92, -42); g.lineTo(92, -30); g.lineTo(58, -26); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(58, -28); g.lineTo(90, -32); g.lineWidth = 3.5; g.strokeStyle = OUT; g.stroke();
  g.beginPath(); g.moveTo(54, -46); g.quadraticCurveTo(76, -52, 94, -42); g.lineWidth = 5; g.stroke();
  // cigar (lit)
  g.save(); g.translate(100, 16); g.rotate(-0.25);
  g.fillStyle = '#7b4a24'; g.fillRect(0, -5, 40, 10); g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(0, -5, 40, 10);
  g.fillStyle = '#d9a660'; g.fillRect(10, -5, 5, 10);
  g.fillStyle = '#ff7a2f'; g.fillRect(40, -4, 7, 8); g.fillStyle = '#ffd36b'; g.fillRect(44, -2, 3, 4);
  g.restore();
  // front arm + fist (in front of everything)
  g.beginPath(); g.moveTo(-28, 18); g.quadraticCurveTo(10, 40, 52, 62); g.lineWidth = 28; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 20; g.strokeStyle = TUX; g.stroke();
  g.beginPath(); g.moveTo(44, 54); g.lineTo(54, 70); g.lineWidth = 9; g.strokeStyle = WHITE; g.stroke();
  g.beginPath(); g.ellipse(64, 66, 15, 12, 0.5, 0, TAU); g.fillStyle = GREY; g.fill(); outline(g, 3.5);
  g.beginPath(); g.moveTo(58, 62); g.lineTo(70, 60); g.moveTo(60, 69); g.lineTo(72, 67); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
}

/* Panicked JEET fish, facing left, origin at centre */
function drawFish(g, color, dark, frame) {
  const ty = frame ? -4 : 4;
  g.lineWidth = 2.5; g.strokeStyle = OUT;
  g.beginPath(); g.moveTo(14, 0); g.lineTo(27, -11 + ty); g.lineTo(27, 11 + ty); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
  g.beginPath(); g.ellipse(-2, 0, 20, 12, 0, 0, TAU); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.ellipse(-2, 0, 20, 12, 0, 0, TAU); g.clip(); g.fillStyle = dark; g.globalAlpha = 0.5;
  [4, 11].forEach(x => { g.beginPath(); g.moveTo(x, -14); g.lineTo(x + 5, -14); g.lineTo(x + 1, 14); g.lineTo(x - 4, 14); g.closePath(); g.fill(); });
  g.restore();
  g.fillStyle = color;
  g.beginPath(); g.moveTo(-8, -11); g.lineTo(2, -18); g.lineTo(8, -10); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-2, 11); g.lineTo(6, 16 - ty / 2); g.lineTo(10, 10); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(-12, -3, 6, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.stroke();
  g.beginPath(); g.arc(-13, -2, 2.6, 0, TAU); g.fillStyle = '#111'; g.fill();
  g.beginPath(); g.ellipse(-19, 5, 2.5, 3.5, 0, 0, TAU); g.fillStyle = '#5c1622'; g.fill(); g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.moveTo(-8, -16); g.quadraticCurveTo(-4, -22, -6, -25); g.quadraticCurveTo(-11, -20, -8, -16); g.fillStyle = '#9fe6ff'; g.fill();
  g.font = "900 8px 'Plus Jakarta Sans', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = OUT; g.fillText('JEET', -1, 1);
}

  window.WhaleSprite = { makeSprite, outline, rr, drawWhale, drawFish, OUT, TAU };
})();
