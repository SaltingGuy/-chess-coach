/*
 * Guided daily session (#/session): one tap builds today's training and runs it block after block.
 *
 * Planner: looks at what is due (your own-game puzzles and reviews, opening lines, trap drills, endgames),
 * your costliest weakness, Play/Study day and new chess.com games, and builds an ordered list of blocks —
 * each with a one-line reason. Order (from the learning research): easy warm-up → your own mistakes →
 * hardest work while fresh → openings → game or game review → endgame → finish on an easy win.
 *
 * Runner: the existing trainers run inside the app as usual; a session bar stays on top of every screen,
 * counts your progress in the current block (today's counters, measured from the moment the block started)
 * and offers "Next" as soon as the block is done. Skip and Swap are always there. The session is saved
 * after every move you make, so closing the app and coming back resumes where you were.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var LENGTHS = { short: { label: 'Short', mins: '15–20 min' }, normal: { label: 'Normal', mins: '45 min' }, long: { label: 'Long', mins: '60 min' } };
  var ticking = false;

  function Store() { return CT.Store; }
  function todayKey() { return Store().dayKey(Date.now()); }
  function state() { return Store().state.session || null; }
  function active() { var s = state(); return s && s.day === todayKey() && !s.finished ? s : null; }

  /** Today's counters a block can be measured with. */
  function counter(key) {
    var d = Store().today();
    if (key === 'openings') return (d.drills || 0) + Math.floor((d.quiz || 0) / 4) + (d.trapDrills || 0);
    return d[key] || 0;
  }

  /* ---------------- Planner ---------------- */
  function sizeOf(len) { return len === 'short' ? 0 : len === 'long' ? 2 : 1; }

  function plan(len, opts) {
    opts = opts || {};
    var C = CT.Coach, S = Store(), D = CT.Data, size = sizeOf(len);
    var type = C.dayType(), blocks = [];
    var resting = C.restingThemes(), recs = S.state.puzzles, now = Date.now();
    var dueReviews = D.puzzles.filter(function (p) { var r = recs[p.id]; return r && r.due <= now && r.box < 5 && !p.woodpecker && !resting[p.theme]; }).length;
    var ownFresh = D.puzzles.filter(function (p) { return p.source === 'game' && !recs[p.id]; }).length;
    var weak = C.weakestThemes().filter(function (w) { return w.theme !== 'game' && !w.mastered && (w.fromGames > 0 || (w.attempts >= 3 && w.accuracy != null && w.accuracy < 0.75)); })[0];
    var add = function (b) { b.target = Math.max(1, b.target); blocks.push(b); };

    add({ key: 'warmup', icon: '☀', title: 'Warm-up', href: '#/tactics/warmup', counter: 'warmup', target: [4, 6, 8][size], core: true,
      reason: 'Easy puzzles to get your eye in — start with a few wins.' });

    var mine = dueReviews + ownFresh;
    if (mine) add({ key: 'mine', icon: '↺', title: 'Your own mistakes', href: '#/tactics/mine', counter: 'puzzles', target: Math.min(mine, [4, 6, 8][size]), core: true,
      reason: (ownFresh ? ownFresh + ' position' + (ownFresh > 1 ? 's' : '') + ' from your own games' : '') + (ownFresh && dueReviews ? ' and ' : '') +
        (dueReviews ? dueReviews + ' review' + (dueReviews > 1 ? 's' : '') + ' due' : '') + ' — testing yourself on real mistakes, spaced out over days, is the most proven way to learn.' });

    // The Coach's Lab: today's dose of the training method being tested on your biggest leak.
    var lab = CT.Experiments ? CT.Experiments.sessionBlock(size) : null;
    if (lab) add(lab);

    add({ key: 'focus', icon: '⚔', title: 'Hard focus', href: '#/tactics/focus', counter: 'puzzles', target: [6, 10, 14][size], core: true,
      reason: 'Harder mixed puzzles while you are fresh, theme hidden like a real game' + (weak ? ' — leaning toward ' + weak.name + ', your costliest weakness.' : '.') + ' Do a safety check before every move.',
      alts: [
        { key: 'woodpecker', icon: '⟳', title: 'Woodpecker set', href: '#/tactics/woodpecker/go', counter: 'wp', target: [6, 10, 12][size], reason: 'Same puzzles in cycles, faster each time — builds instant pattern recognition.' },
        { key: 'threats', icon: '◈', title: 'Hidden-threat drill', href: '#/lab/threats', counter: 'lab', target: [1, 2, 3][size], reason: 'Find what your opponent is threatening, then defend — the habit that stops hung pieces.' },
        { key: 'danger', icon: '🛡', title: 'Back-rank danger', href: '#/tactics/danger', counter: 'lab', target: [3, 5, 6][size], reason: 'Spot which move loses to a back-rank mate before you play it.' }
      ] });

    var op = C.nextOpening(), trap = CT.TrapDrills ? CT.TrapDrills.next() : null;
    var opBlock = op ? { key: 'openings', icon: '♘', title: 'Openings', href: '#/openings/' + op.line.id + '/' + op.mode, counter: 'openings', target: 1,
      reason: (op.mode === 'drill' ? 'Your ' : 'Next new line: ') + op.line.name + (op.mode === 'drill' ? ' is due for review — recalling it beats re-reading it.' : ' — a little theory, then you play it.') } : null;
    var trapBlock = trap ? { key: 'traps', icon: '⚑', title: 'Trap drill', href: trap.href, counter: 'openings', target: 1, reason: trap.label + ' — a trap from your own repertoire, both sides.' } : null;
    var quizBlock = { key: 'quiz', icon: '?', title: 'Opening quiz', href: '#/openings/quiz/all', counter: 'openings', target: 1, reason: 'Find the move in positions from your repertoire.' };
    var first = opBlock || trapBlock || quizBlock;
    first.alts = [opBlock, trapBlock, quizBlock].filter(function (b) { return b && b !== first; });
    add(first);

    if (size > 0) {
      // Games not yet replayed with Think-First (newest chess.com games first).
      var thinkable = function (g) { return g.userColor && !(CT.Think && CT.Think.done(g.id)) && (!g.analysis || (CT.Think && CT.Think.moments(g).length)); };
      var pending = (CT.ChessCom ? CT.ChessCom.pending() : []).filter(thinkable);
      var unreviewed = pending.length ? pending : (CT.Games ? CT.Games.list().filter(thinkable) : []);
      var pick = C.practicePick ? C.practicePick() : null;
      var gameBlock = { key: 'game', icon: '♟', title: 'Serious game (15+10)', href: '#/practice', counter: 'games', target: 1,
        reason: 'One slow game' + (pick ? ' vs ' + CT.Opponent.STYLES[pick.style].name + ' (level ' + pick.level + ', chosen for your weak spots)' : '') + ' with Safety check on. Then review it.' };
      var reviewBlock = unreviewed.length ?
        { key: 'review', icon: '🧠', title: 'Think-First review', href: '#/analysis/think/' + unreviewed[0].id, counter: 'think', target: 1,
          reason: 'Your ' + (pending.length ? 'latest chess.com ' : '') + 'game vs ' + (opponentOf(unreviewed[0]) || 'your opponent') + ' — find the better moves at your turning points yourself, then see what the engine says.' } :
        { key: 'review', icon: '🧠', title: 'Think-First review', href: '#/analysis/games', counter: 'think', target: 1, reason: 'Replay the turning points of the game you just played — your mistakes become tomorrow\'s puzzles.' };
      if (type === 'play') { gameBlock.alts = unreviewed.length ? [reviewBlock] : []; add(gameBlock); add(Object.assign({}, reviewBlock, { key: 'review2', href: '#/analysis/games', reason: 'Review the game you just played — your mistakes become tomorrow\'s puzzles.', afterGame: true })); }
      else if (unreviewed.length) { reviewBlock.alts = [gameBlock]; add(reviewBlock); }
    }

    if (size > 0 && CT.Endgame) {
      var eg = CT.Endgame.next();
      add({ key: 'endgame', icon: '♚', title: 'Endgame technique', href: eg.href, counter: 'endgames', target: 1, reason: eg.label + ' — technique you need to turn a won position into a win.',
        alts: [{ key: 'convert', icon: '♚', title: 'Convert the Win', href: '#/endgames/convert', counter: 'endgames', target: 1, reason: 'You are ahead — bring it home without giving it back.' }] });
    }
    if (size === 2) {
      var nl = C.nextLab();
      add({ key: 'lab', icon: '◈', title: 'Deception Lab', href: nl.href, counter: 'lab', target: 1, reason: nl.label + ' — the hidden ideas behind your style.' });
    }
    add({ key: 'finish', icon: '★', title: 'Finish on a win', href: '#/tactics/warmup', counter: 'warmup', target: 1, reason: 'One easy puzzle to end on a success — you will want to come back tomorrow.' });
    return { type: type, blocks: blocks, weak: weak ? weak.name : null };
  }

  function opponentOf(g) {
    var h = g.headers || {};
    return g.userColor === 'w' ? h.Black : g.userColor === 'b' ? h.White : null;
  }

  /* ---------------- Session state ---------------- */
  function start(len) {
    var p = plan(len);
    var s = Store().state.session = { day: todayKey(), len: len, type: p.type, startedAt: Date.now(), idx: 0, blocks: p.blocks, finished: false };
    begin(s, 0);
    Store().save();
    return s;
  }
  function begin(s, i) {
    s.idx = i;
    var b = s.blocks[i];
    if (b) { b.base = counter(b.counter); b.startedAt = Date.now(); }
    // "Review the game you just played": open that game directly.
    if (b && b.afterGame && CT.Games) {
      var g = CT.Games.list().filter(function (x) { return x.userColor && !(CT.Think && CT.Think.done(x.id)); })[0];
      if (g) b.href = '#/analysis/think/' + g.id;
    }
  }
  function current() { var s = active(); return s ? s.blocks[s.idx] : null; }
  function progressOf(b) { return b ? Math.max(0, counter(b.counter) - (b.base || 0)) : 0; }

  function next(skip) {
    var s = active(); if (!s) return;
    var b = s.blocks[s.idx];
    if (b) { if (skip && !b.done) b.skipped = true; b.endedAt = Date.now(); }
    var i = s.idx + 1;
    while (s.blocks[i] && s.blocks[i].afterGame && !(s.blocks[i - 1] && s.blocks[i - 1].key === 'game' && s.blocks[i - 1].done)) { s.blocks[i].skipped = true; i++; } // no game → no review of it
    if (i >= s.blocks.length) { finish(); return; }
    begin(s, i);
    Store().save();
    root.location.hash = s.blocks[i].href;
    renderBar();
  }
  function swap(altIndex) {
    var s = active(); if (!s) return;
    var b = s.blocks[s.idx], alt = b && b.alts && b.alts[altIndex];
    if (!alt) return;
    var others = [Object.assign({}, b, { alts: undefined })].concat(b.alts.filter(function (x, k) { return k !== altIndex; }));
    var nb = Object.assign({}, alt, { core: b.core, alts: others });
    s.blocks[s.idx] = nb;
    begin(s, s.idx);
    Store().save();
    root.location.hash = nb.href;
    renderBar();
  }
  function finish() {
    var s = state(); if (!s) return;
    s.finished = true; s.endedAt = Date.now();
    Store().state.log.push({ t: Date.now(), kind: 'session', id: s.len, ok: coreDone(s) });
    Store().bumpDay('sessions');
    if (root.location.hash === '#/session') { if (CT.App) CT.App.rerender(); } else root.location.hash = '#/session';
    renderBar();
  }
  function end() { var s = active(); if (s) finish(); }
  function coreDone(s) { return s.blocks.filter(function (b) { return b.core; }).every(function (b) { return b.done; }); }

  /** Called after every save: has the current block reached its target? */
  function tick() {
    if (ticking) return;
    var s = active(); if (!s) return;
    var b = s.blocks[s.idx]; if (!b || b.done) return;
    if (progressOf(b) >= b.target) {
      ticking = true;
      try {
        b.done = true; b.endedAt = Date.now();
        Store().save();
        if (CT.Sound) CT.Sound.play('win');
        var n = s.blocks[s.idx + 1];
        if (CT.Voice) CT.Voice.say(b.title + ' done.' + (n ? ' Next: ' + n.title + '.' : ' Session complete.'));
      } finally { ticking = false; }
    }
    renderBar();
  }

  /* ---------------- Session bar (on every screen while a session runs) ---------------- */
  function onBlockRoute(b) {
    var h = root.location.hash || '#/';
    var base = b.href.split('/').slice(0, 3).join('/');
    return h === b.href || h.indexOf(base) === 0 || (b.key === 'game' && /^#\/practice/.test(h)) || (/^review/.test(b.key) && /^#\/analysis/.test(h));
  }
  var barNode = null;
  function barEl() {
    if (!barNode) { barNode = document.createElement('div'); barNode.id = 'session-bar'; barNode.className = 'session-bar'; barNode.hidden = true; bindBar(barNode); }
    return barNode;
  }
  function renderBar() {
    if (typeof document === 'undefined') return;
    var el = barEl();
    var s = active(), h = root.location.hash || '#/';
    if (!s || /^#\/session/.test(h)) { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('in-session'); return; }
    var b = s.blocks[s.idx], esc = CT.UI.esc, n = s.blocks[s.idx + 1];
    var prog = progressOf(b), dots = s.blocks.map(function (x, i) { return '<i class="' + (x.done ? 'd' : x.skipped ? 's' : i === s.idx ? 'c' : '') + '"></i>'; }).join('');
    var away = !onBlockRoute(b);
    el.hidden = false; document.body.classList.add('in-session');
    el.innerHTML = '<div class="sb-top"><span class="sb-dots">' + dots + '</span><strong class="sb-title">' + b.icon + ' ' + esc(b.title) + '</strong>' +
      '<span class="sb-prog">' + (b.done ? '✓' : Math.min(prog, b.target) + '/' + b.target) + '</span>' +
      '<button class="sb-more" data-sb="menu" aria-label="Session options">⋯</button></div>' +
      '<div class="sb-why small">' + esc(b.reason) + '</div>' +
      '<div class="sb-menu" hidden>' +
        (b.alts && b.alts.length ? b.alts.map(function (a, i) { return '<button class="btn small" data-sb="swap" data-i="' + i + '">Swap for: ' + a.icon + ' ' + esc(a.title) + '</button>'; }).join('') : '') +
        (!b.done ? '<button class="btn small" data-sb="skip">Skip this block</button>' : '') +
        '<a class="btn small" href="#/session">Session overview</a><button class="btn small" data-sb="end">End session</button></div>' +
      (b.done ? '<button class="btn primary sb-next" data-sb="next">' + (n ? 'Next: ' + n.icon + ' ' + esc(n.title) + ' ▶' : 'Finish session ▶') + '</button>' :
        away ? '<a class="btn primary sb-next" href="' + b.href + '">Back to ' + esc(b.title) + ' ▶</a>' : '');
  }
  function bindBar(el) {
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-sb]'); if (!t) return;
      var a = t.dataset.sb;
      if (a === 'menu') { var m = el.querySelector('.sb-menu'); m.hidden = !m.hidden; }
      if (a === 'next') next(false);
      if (a === 'skip') next(true);
      if (a === 'swap') swap(+t.dataset.i);
      if (a === 'end') end();
    });
  }

  /* ---------------- Session screen ---------------- */
  function view(v) {
    var S = Store(), esc = CT.UI.esc, s = state(), today = todayKey();
    var live = active();
    if (live) {
      // Resume.
      var b = live.blocks[live.idx];
      v.innerHTML = '<h1>Today\'s session</h1>' + overview(live) +
        '<div class="btn-row"><a class="btn primary big" href="' + b.href + '">Resume: ' + b.icon + ' ' + esc(b.title) + ' ▶</a><button class="btn" data-act="end">End session</button></div>';
      v.querySelector('[data-act="end"]').addEventListener('click', function () { end(); });
      return;
    }
    if (s && s.day === today && s.finished) return summary(v, s);
    // New session: choose a length, see the plan, start.
    var len = S.state.profile.sessionLen || (S.state.profile.sessionMinutes <= 20 ? 'short' : S.state.profile.sessionMinutes >= 60 ? 'long' : 'normal');
    function draw() {
      var p = plan(len);
      v.innerHTML = '<h1>Today\'s training</h1><p class="muted">Built for you right now — ' + (p.type === 'play' ? '♟ Play day' : '📘 Study day') + (p.weak ? ' · focus: ' + esc(p.weak) : '') + '. One tap, everything on one track.</p>' +
        '<div class="chips len-chips">' + Object.keys(LENGTHS).map(function (k) { return '<button class="chip' + (k === len ? ' on' : '') + '" data-len="' + k + '">' + LENGTHS[k].label + ' · ' + LENGTHS[k].mins + '</button>'; }).join('') + '</div>' +
        '<ol class="session-list">' + p.blocks.map(function (b) {
          return '<li><span class="plan-ico">' + b.icon + '</span><span><strong>' + esc(b.title) + '</strong>' + (b.core ? ' <span class="tag">core</span>' : '') + '<small>' + esc(b.reason) + '</small></span></li>';
        }).join('') + '</ol>' +
        '<p class="small muted">The three <span class="tag">core</span> blocks are the must-dos. A bar at the top follows you through every block; tap ⋯ there to skip or swap one.</p>' +
        '<div class="btn-row"><button class="btn primary big" data-act="start">Start ▶</button></div>';
      v.querySelectorAll('[data-len]').forEach(function (c) { c.addEventListener('click', function () { len = c.dataset.len; S.state.profile.sessionLen = len; S.save(); draw(); }); });
      v.querySelector('[data-act="start"]').addEventListener('click', function () {
        var ns = start(len);
        root.location.hash = ns.blocks[0].href;
      });
    }
    draw();
  }

  function overview(s) {
    var esc = CT.UI.esc;
    return '<ol class="session-list">' + s.blocks.map(function (b, i) {
      var cur = i === s.idx && !s.finished;
      var st = b.done ? '✓' : b.skipped ? '–' : cur ? '▶' : b.icon;
      return '<li class="' + (b.done ? 'done' : b.skipped || (s.finished && !b.done) ? 'skipped' : cur ? 'current' : '') + '"><span class="plan-ico">' + st + '</span><span><strong>' + esc(b.title) + '</strong>' +
        (cur && !b.done ? ' <span class="small muted">' + Math.min(progressOf(b), b.target) + '/' + b.target + '</span>' : '') + '<small>' + esc(b.reason) + '</small></span></li>';
    }).join('') + '</ol>';
  }

  function summary(v, s) {
    var S = Store(), C = CT.Coach, esc = CT.UI.esc;
    var done = s.blocks.filter(function (b) { return b.done; }).length, mins = Math.max(1, Math.round(((s.endedAt || Date.now()) - s.startedAt) / 60000));
    var log = S.state.log.filter(function (e) { return e.kind === 'puzzle' && e.t >= s.startedAt && e.t <= (s.endedAt || Date.now()); });
    var ok = log.filter(function (e) { return e.ok; }).length;
    var weak = C.weakestThemes().filter(function (w) { return w.theme !== 'game' && !w.mastered && w.attempts >= 3; })[0];
    v.innerHTML = '<h1>' + (coreDone(s) ? '✓ Session complete' : 'Session ended') + '</h1>' +
      '<section class="card"><div class="stat-row">' +
        '<div><strong>' + done + '/' + s.blocks.length + '</strong><small>blocks done</small></div>' +
        '<div><strong>' + (log.length ? ok + '/' + log.length : '—') + '</strong><small>puzzles right</small></div>' +
        '<div><strong>' + mins + ' min</strong><small>training</small></div>' +
        '<div><strong>' + S.streak() + '</strong><small>day streak</small></div></div>' +
        (coreDone(s) ? '<p class="good">All core blocks done — today counts.</p>' : '<p class="small muted">The core blocks were not all finished. Shorter is fine — try the Short session tomorrow.</p>') +
        (weak ? '<p>Tomorrow\'s focus: <strong>' + esc(weak.name) + '</strong> (' + Math.round((weak.accuracy || 0) * 100) + '% recently).</p>' : '') +
      '</section>' + overview(s) +
      '<div class="btn-row"><a class="btn primary" href="#/">Dashboard</a><button class="btn" data-act="again">Another session</button></div>';
    v.querySelector('[data-act="again"]').addEventListener('click', function () { S.state.session = null; S.save(); view(v); });
  }

  CT.Session = { plan: plan, start: start, active: active, current: current, progressOf: progressOf, next: next, swap: swap, end: end, tick: tick, renderBar: renderBar, barEl: barEl, counter: counter, LENGTHS: LENGTHS };
  CT.Views = CT.Views || {};
  CT.Views.session = view;
})(typeof window !== 'undefined' ? window : globalThis);
