/* ============================================================
   COMMUNITY CHAT: shared feed for the landing page (floating panel) and game.html (side panel).
   Simulated for now: a message pool, REAL WHALE lines and reactions to game events.
   To go live, swap tick()/add() for a WebSocket or polling client; the DOM contract stays the same:
     WhaleChat.mount({ log, form, input, name, seed, live }) → { add(user, text, cls), react(kind, vars), stop() }
   ============================================================ */
(function () {
  'use strict';
  const USERS = ['userdami33', 'boarchow', 'sotalpreops', 'papersakoe', 'krillionaire', 'deepbagz', 'orcaOG', 'modiy'];
  const POOL = ['FUD', 'JEET', "don't know", 'wen moon', 'paper hands getting eaten lol', 'the whale lord feasts again', 'dive into dominance', 'anchor holding', 'who got 5X frenzy?', 'bags packed, diving deeper', 'jeets swimming against the current again', 'HODL the anchor', 'torpedoes everywhere on level 4 fr', 'gm reef', 'my best is 8k beat that', 'chart looks like a whale tail', 'not selling. ever.', "FUD can't sink the lord", 'ate 3 paper hands in one chomp', 'is this the bottom?', 'lmao the cigar', 'watching jeets panic > netflix', 'wen level 10', 'we stay', 'the vault is filling', 'oldy tnk!', 'Now donks'];
  const WHALE = ['Chat, you even dodge, my brother?', 'Fine dining tonight. The paper hands are delicious.', 'The market never sleeps, and neither do I.', 'Feel the weight of the anchor.', 'Watching them panic sell is better than Netflix.', 'Trust the process. Trust the chart.', 'You think you can meet your paper shame?'];
  const REACT = {
    level: ['level {L} already??', 'FUD INTENSIFIES', 'torpedoes go brrr', 'level {L} lets gooo'],
    hit: ['oof', 'F', 'that torpedo had your name on it', 'dodge bro'],
    paper: ['PAPER HANDS EATEN', 'delicious', 'chomp'],
    max: ['5X FRENZY LETS GO', 'MAX MULTIPLIER', 'he is feasting'],
    over: ['rekt by FUD lol', 'gg', 'F in the chat', 'run it back'],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function mount(o) {
    const log = o.log, name = o.name || (() => ''), max = o.max || 60;
    let timer = null;
    function add(user, text, cls) {
      const d = document.createElement('div'); d.className = 'msg' + (cls ? ' ' + cls : '');
      d.innerHTML = '<span class="u">' + esc(user) + ':</span> ' + esc(text);
      log.appendChild(d); while (log.children.length > max) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
    }
    function react(kind, vars) {
      const lines = REACT[kind]; if (!lines || Math.random() < 0.35) return;
      setTimeout(() => add(pick(USERS), pick(lines).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null) ? vars[k] : m)), rand(300, 1200));
    }
    function tick() { timer = setTimeout(() => { if (Math.random() < 0.2) add('REAL WHALE', pick(WHALE), 'whale'); else add(pick(USERS), pick(POOL)); tick(); }, rand(2500, 6500)); }
    const seed = o.seed == null ? 7 : o.seed;
    for (let i = 0; i < seed; i++) (i % 3 === 2) ? add('REAL WHALE', pick(WHALE), 'whale') : add(pick(USERS), pick(POOL));
    if (o.live !== false) tick();
    if (o.form && o.input) o.form.addEventListener('submit', e => { e.preventDefault(); const t = o.input.value.trim(); if (!t) return; add(name() || 'you', t.slice(0, 140), 'me'); o.input.value = ''; });
    return { add, react, stop: () => clearTimeout(timer) };
  }
  window.WhaleChat = { mount };
})();
