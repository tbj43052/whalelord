/* ============================================================
   "DEEP DIVE" LOADING SCREEN: blurred ocean void, drifting sunbeams, a distant gold-trimmed wreck, the Whale Lord
   diving nose-first with a bubble + gold-glitter wake, and a gold-bezel progress bar whose fill pushes JEET fish along.
   Shared by index.html and game.html. Needs whale-sprite.js loaded first.
   API: WhaleLoader.start({ maxMs })  ·  WhaleLoader.set(0..1)  ·  WhaleLoader.done()  (fills to 100%, then fades out;
        the screen stays up at least 1.4 s so the animation reads even on a fast connection)
   ============================================================ */
(function () {
  'use strict';
  const TAU = Math.PI * 2, MIN_MS = 1400;
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let el = null, scene, ctx, fishCv, fishCtx, fill, dpr = 1, raf = 0, t0 = 0, last = 0, target = 0, shown = 0;
  let finished = false, closing = false, maxTimer = 0, whale, fishSpr, bubbles = [], glitter = [];

  function start(opts) {
    if (el || !window.WhaleSprite) return;
    const S = window.WhaleSprite;
    el = document.createElement('div'); el.className = 'deep-loader'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<canvas class="deep-scene" aria-hidden="true"></canvas><div class="deep-ui"><div class="deep-bar" aria-hidden="true"><div class="deep-fill"></div><canvas class="deep-fish"></canvas></div><div class="deep-title">ENTERING THE DEEP...</div><div class="deep-sub">Loading assets, please wait...</div></div>';
    document.body.appendChild(el);
    scene = el.querySelector('.deep-scene'); ctx = scene.getContext('2d');
    fishCv = el.querySelector('.deep-fish'); fishCtx = fishCv.getContext('2d'); fill = el.querySelector('.deep-fill');
    whale = S.makeSprite(340, 170, 192, 72, g => S.drawWhale(g, false, 0.4));
    fishSpr = [0, 1].map(f => S.makeSprite(60, 50, 30, 25, g => S.drawFish(g, '#f2c230', '#b87a10', f)));
    bubbles = []; glitter = []; target = 0.04; shown = 0; finished = closing = false;
    resize(); window.addEventListener('resize', resize);
    t0 = last = performance.now();
    maxTimer = setTimeout(done, (opts && opts.maxMs) || 12000);      // never trap a visitor behind the loader
    raf = requestAnimationFrame(frame);
  }
  function set(p) { if (el) target = Math.max(target, clamp(p, 0, 1)); }
  function done() {
    if (!el || finished) return; finished = true; target = 1; clearTimeout(maxTimer);
    // fallback for background tabs where animation frames barely run: force the fill and dismiss on a timer
    const wait = Math.max(0, MIN_MS - (performance.now() - t0)) + 900;
    setTimeout(() => { if (el && !closing) { shown = 1; fill.style.width = '100%'; close(); } }, wait);
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    scene.width = Math.round(innerWidth * dpr); scene.height = Math.round(innerHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = fishCv.getBoundingClientRect(); fishCv.width = Math.round(r.width * dpr); fishCv.height = Math.round(r.height * dpr); fishCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function close() {
    closing = true; el.classList.add('out');
    setTimeout(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); if (el) el.remove(); el = null; }, 480);
  }

  function beams(t, W, H) {
    for (let i = 0; i < 4; i++) {
      const x = W * (0.12 + i * 0.24) + (reduce ? 0 : Math.sin(t * 0.25 + i) * 40), w = 90 + i * 30;
      const a = reduce ? 0.12 : 0.09 + 0.05 * Math.sin(t * 0.7 + i * 1.7);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.9); g.addColorStop(0, 'rgba(190,235,255,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(190,235,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + w, -20); ctx.lineTo(x + w * 2.4 - 160, H); ctx.lineTo(x - 160, H); ctx.closePath(); ctx.fill();
    }
  }
  function wreck(t, W, H, sc) {
    ctx.save(); ctx.translate(W * 0.2, H * 0.9); ctx.scale(sc * 0.9, sc * 0.9); ctx.globalAlpha = 0.85; ctx.lineCap = 'round';
    ctx.fillStyle = '#0b2438'; ctx.beginPath(); ctx.moveTo(-160, -40); ctx.lineTo(-120, 30); ctx.lineTo(150, 40); ctx.lineTo(200, -60); ctx.lineTo(160, -38); ctx.lineTo(-120, -50); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#122f4a'; ctx.stroke();
    ctx.strokeStyle = '#0b2438'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(20, -45); ctx.lineTo(40, -230); ctx.moveTo(-70, -48); ctx.lineTo(-90, -150); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, -190); ctx.lineTo(110, -175); ctx.stroke();
    ctx.fillStyle = 'rgba(14,42,66,.95)'; ctx.beginPath(); ctx.moveTo(38, -220); ctx.lineTo(-10, -120); ctx.lineTo(70, -110); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-122, -48); ctx.lineTo(160, -37); ctx.stroke();          // gold gunwale
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-100, -18); ctx.lineTo(140, -10); ctx.stroke();                                              // gold trim line
    ctx.fillStyle = 'rgba(250,204,21,.85)'; ctx.beginPath(); ctx.moveTo(196, -62); ctx.lineTo(216, -80); ctx.lineTo(208, -50); ctx.closePath(); ctx.fill(); // figurehead glint
    for (let i = 0; i < 5; i++) {                                                                                                                 // portholes
      const a = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = 'rgba(253,230,138,' + (0.35 + 0.5 * a).toFixed(2) + ')'; ctx.shadowColor = 'rgba(250,204,21,.9)'; ctx.shadowBlur = 12 * a;
      ctx.beginPath(); ctx.arc(-80 + i * 50, -6, 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function sparkle(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }

  function frame(now) {
    if (!el) return;
    raf = requestAnimationFrame(frame);
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw), t = (now - t0) / 1000; last = now;
    shown += (target - shown) * (1 - Math.exp(-4 * Math.min(1, raw)));   // time-based, so throttled tabs still catch up
    if (finished && shown > 0.995) shown = 1;
    fill.style.width = (shown * 100).toFixed(1) + '%';
    const W = innerWidth, H = innerHeight, sc = clamp(Math.min(W / 900, H / 900), 0.5, 1);
    const cx = W / 2, cy = H * 0.38 + (reduce ? 0 : Math.sin(t * 1.6) * 6 * sc), rot = Math.PI / 2 + (reduce ? 0 : Math.sin(t * 1.1) * 0.06);
    ctx.clearRect(0, 0, W, H);
    beams(t, W, H); wreck(t, W, H, sc);
    if (!reduce) {                                                     // wake: the legs point up while he dives, so it trails upward
      if (Math.random() < dt * 18) bubbles.push({ x: cx + rand(-30, 30) * sc, y: cy - 115 * sc, vx: rand(-12, 12), vy: rand(-70, -30), r: rand(2, 6) * sc, t: 0, life: rand(1.2, 2.4) });
      if (Math.random() < dt * 22) glitter.push({ x: cx + rand(-45, 45) * sc, y: cy - rand(60, 135) * sc, vx: rand(-25, 25), vy: rand(-40, 10), r: rand(1.5, 3.5) * sc, t: 0, life: rand(0.6, 1.4), ph: rand(0, TAU) });
      for (const b of bubbles) { b.t += dt; b.x += (b.vx + Math.sin(b.t * 5) * 12) * dt; b.y += b.vy * dt; }
      for (const s of glitter) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      bubbles = bubbles.filter(b => b.t < b.life); glitter = glitter.filter(s => s.t < s.life);
      ctx.lineWidth = 1.5;
      for (const b of bubbles) { ctx.strokeStyle = 'rgba(190,235,255,' + (0.7 * (1 - b.t / b.life)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); }
      for (const s of glitter) { const k = 1 - s.t / s.life, tw = 0.5 + 0.5 * Math.sin(t * 12 + s.ph); ctx.fillStyle = 'rgba(250,204,21,' + (k * tw).toFixed(2) + ')'; sparkle(s.x, s.y, s.r * (0.6 + tw)); }
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.drawImage(whale, -whale.ox, -whale.oy, whale.w, whale.h); ctx.restore();
    // JEET fish shoved along by the leading edge of the gold fill
    const fw = fishCv.width / dpr, fh = fishCv.height / dpr; fishCtx.clearRect(0, 0, fw, fh);
    const edge = 3 + shown * (fw - 6);
    for (let i = 0; i < 3; i++) {
      const x = edge - 16 - i * 26; if (x < 18) continue;
      const spr = fishSpr[Math.floor(t * 10 + i) % 2], bob = reduce ? 0 : Math.sin(t * 7 + i * 1.3) * 3;
      fishCtx.save(); fishCtx.translate(x, fh / 2 + bob); fishCtx.scale(0.55, 0.55); fishCtx.shadowColor = 'rgba(250,204,21,.9)'; fishCtx.shadowBlur = 10;
      fishCtx.drawImage(spr, -spr.ox, -spr.oy, spr.w, spr.h); fishCtx.restore();
    }
    if (finished && shown >= 1 && !closing && now - t0 >= MIN_MS) close();
  }
  window.WhaleLoader = { start, set, done, get active() { return !!el; }, get state() { return { target, shown, finished, closing, elapsed: el ? Math.round(performance.now() - t0) : null }; } };
})();
