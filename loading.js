/* ============================================================
   LOADING SCREEN (#loading-screen): the "The Whale Lord Loading Screen" component wired as a full-screen overlay.
   Counter rules:
     - requestAnimationFrame drives BOTH the bar width and the percentage text from 1% to 100% over 2800 ms.
       The value may advance at most one whole number per frame, so every integer 1..100 renders in order
       (on a slow frame the count simply takes a little longer; it never skips).
     - Assets fast (< 2.8 s): the full 1 → 100 run still plays out before the screen goes.
       Assets slow: the count crawls to 99% and holds there until done() is called, then steps to 100%.
     - At 100%: hold 200 ms, fade the overlay out over 0.5 s (CSS opacity), then display:none + remove from the DOM.
   API: WhaleLoader.start({ maxMs })  ·  WhaleLoader.done()  ·  WhaleLoader.set(p) (p >= 1 counts as done())
   ============================================================ */
(function () {
  'use strict';
  const DURATION = 2800, HOLD_MS = 200, FADE_MS = 500;
  const STARS = [[6, 14, .55, 1.4], [14, 62, .35, 1.2], [23, 31, .45, 1.1], [31, 84, .3, 1.3], [42, 12, .4, 1.2], [55, 91, .35, 1.2], [63, 24, .5, 1.4], [71, 68, .3, 1.1], [78, 9, .45, 1.3], [86, 47, .35, 1.2], [92, 82, .5, 1.4], [96, 21, .3, 1.1], [48, 58, .25, 1], [9, 90, .4, 1.2], [37, 47, .25, 1], [67, 42, .3, 1.1]];
  const HTML = '<div class="ls-glow" aria-hidden="true"></div><div class="ls-stars" aria-hidden="true"></div><div class="ls-vignette" aria-hidden="true"></div>' +
    '<div class="ls-inner"><div class="ls-title"><span class="ls-title-shadow" aria-hidden="true">THE WHALE LORD</span><span class="ls-title-gold">THE WHALE LORD</span></div>' +
    '<div class="ls-row"><div class="ls-bezel"><div class="ls-track"><div class="ls-lane"><div class="ls-fill" id="loading-fill"><div class="ls-gloss"></div><div class="ls-sheen"></div></div></div></div></div>' +
    '<div class="ls-pct"><span id="loading-pct">1</span><span>%</span></div></div>' +
    '<div class="ls-caption">LOADING THE DEEP...</div></div>' +
    '<div class="ls-anchor" aria-hidden="true"><svg viewBox="0 0 24 28" width="40" height="46"><circle cx="12" cy="4.5" r="2.5"></circle><line x1="12" y1="7" x2="12" y2="26"></line><line x1="7" y1="11" x2="17" y2="11"></line><path d="M3.5 17 a8.5 8.5 0 0 0 17 0"></path><line x1="3.5" y1="17" x2="1.5" y2="15.5"></line><line x1="3.5" y1="17" x2="5.7" y2="16"></line><line x1="20.5" y1="17" x2="22.5" y2="15.5"></line><line x1="20.5" y1="17" x2="18.3" y2="16"></line></svg></div>';

  let el = null, fill, pctEl, raf = 0, t0 = 0, val = 1, shownInt = 0, assetsDone = false, reachedAt = 0, closing = false, maxTimer = 0;

  function start(opts) {
    if (el) return;
    el = document.createElement('div'); el.id = 'loading-screen'; el.className = 'ls';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', 'Loading The Whale Lord');
    el.innerHTML = HTML;
    el.querySelector('.ls-stars').style.background = STARS.map(([x, y, a, r]) => 'radial-gradient(circle at ' + x + '% ' + y + '%, rgba(255,255,255,' + a + ') 0, transparent ' + r + 'px)').join(',');
    document.body.appendChild(el);
    fill = el.querySelector('#loading-fill'); pctEl = el.querySelector('#loading-pct');
    val = 1; shownInt = 0; t0 = 0; assetsDone = false; reachedAt = 0; closing = false; render();
    maxTimer = setTimeout(done, (opts && opts.maxMs) || 12000);       // never trap a visitor behind the loader
    raf = requestAnimationFrame(frame);
  }
  function done() { if (!el) return; assetsDone = true; clearTimeout(maxTimer); }
  function set(p) { if (p >= 1) done(); }

  function render() {
    fill.style.width = val.toFixed(2) + '%';
    const n = Math.floor(val + 1e-9);
    if (n !== shownInt) { shownInt = n; pctEl.textContent = String(n); }
  }
  function step(now) {                                                 // one animation frame; exposed for tests as _step
    if (!el || closing) return;
    if (!t0) t0 = now;
    const ramp = 1 + 99 * Math.min(1, (now - t0) / DURATION);         // linear 1 → 100 over DURATION
    const target = Math.min(ramp, assetsDone ? 100 : 99);              // without assets: crawl to 99 and hold
    val = Math.max(val, Math.min(target, val + 1));                    // at most one whole number per frame, never backwards
    render();
    if (val >= 100) { if (!reachedAt) reachedAt = now; if (now - reachedAt >= HOLD_MS) close(); }
  }
  function frame(now) { raf = requestAnimationFrame(frame); step(now); }
  function close() {
    closing = true; cancelAnimationFrame(raf); clearTimeout(maxTimer);
    el.classList.add('is-done');                                       // .ls.is-done → opacity 0 over .5 s
    setTimeout(() => { if (!el) return; el.style.display = 'none'; el.remove(); el = null; }, FADE_MS);
  }
  window.WhaleLoader = { start, done, set, _step: step, get active() { return !!el; }, get state() { return { val, shown: shownInt, assetsDone, closing }; } };
})();
