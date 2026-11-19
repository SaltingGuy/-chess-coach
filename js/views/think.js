/*
 * Think-First replay (#/analysis/think/:gameId) — before the engine shows anything.
 * For the 2–3 turning points of YOUR game (your biggest mistakes):
 *   1. Find a better move: play it on the board (one try). The engine's verdict is hidden.
 *   2. Say why you played the game move: tap a reason (self-explanation).
 *   3. Reveal: the engine's move (green), your game move (red), the punishment (orange), the explanation,
 *      and how good your new try was.
 * Each turning point with a clear motif schedules a "same idea, new position" puzzle 3 days later
 * (spaced, varied practice: the pattern, not just this one position). Your reasons are counted, so the
 * notebook can show WHY you go wrong most often.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var REASONS = [
    ['threat', 'I didn\'t see their threat'], ['tactic', 'I didn\'t see my tactic'], ['hope', 'I hoped they wouldn\'t notice'],
    ['misjudged', 'I thought my move was good'], ['rushed', 'I moved too fast'], ['unknown', 'Not sure']
  ];
  var TRANSFER_DAYS = 3;

  function S() { var s = CT.Store.state; s.think = s.think || { games: {}, reasons: {}, transfer: [] }; return s.think; }
  function themeFor(m) {
    var k = m.motif && m.motif.key;
    if (m.allowsMate || k === 'back-rank') return 'back-rank';
    var t = k && CT.Analysis.MOTIF_THEME[k];
    if (m.lessonKind === 'threat' && !t) return 'defence';
    return t && CT.Data.themes[t] ? t : null;
  }
  /** The turning points: your 3 costliest mistakes or blunders, in game order. */
  function moments(g) {
    var res = null;
    try { res = CT.Games.expand(g); } catch (e) { res = null; } // an incomplete analysis has no turning points
    if (!res || !g.userColor) return [];
    return res.moves.filter(function (m) { return m.color === g.userColor && (m.cls === 'blunder' || m.cls === 'mistake') && m.best && m.best !== m.san; })
      .sort(function (a, b) { return b.loss - a.loss; }).slice(0, 3).sort(function (a, b) { return a.ply - b.ply; });
  }
  function done(gid) { return !!S().games[gid]; }
  function pendingGames() {
    return CT.Games.list().filter(function (g) { return g.analysis && g.userColor && !done(g.id) && moments(g).length; });
  }

  /** "Same idea, new position" cards that are due. */
  function dueTransfer(now) { now = now || Date.now(); return S().transfer.filter(function (t) { return !t.done && t.due <= now; }); }
  function markTransfer(puzzleId) {
    var t = S().transfer.find(function (x) { return x.served === puzzleId && !x.done; });
    if (t) { t.done = true; t.doneAt = Date.now(); }
  }

  function finish(g, results) {
    var st = S(), now = Date.now();
    st.games[g.id] = { at: now, moments: results.map(function (r) { return { ply: r.m.ply, guess: r.guess, guessOk: r.guessOk, reason: r.reason }; }) };
    results.forEach(function (r) {
      if (r.reason) st.reasons[r.reason] = (st.reasons[r.reason] || 0) + 1;
      var th = themeFor(r.m);
      if (th) st.transfer.push({ id: g.id + ':' + r.m.ply, theme: th, due: now + TRANSFER_DAYS * 86400000, from: { game: g.id, moveNo: r.m.moveNo, san: r.m.san, opp: opp(g) } });
    });
    st.transfer = st.transfer.filter(function (t) { return !t.done || now - (t.doneAt || 0) < 60 * 86400000; }).slice(-120);
    CT.Store.bumpDay('think');
    CT.Store.state.log.push({ t: now, kind: 'think', id: g.id, ok: results.filter(function (r) { return r.guessOk; }).length >= Math.ceil(results.length / 2) });
    CT.Store.save();
  }
  function opp(g) { var h = g.headers || {}; return g.userColor === 'w' ? h.Black : h.White; }

  function reasonStats() {
    var r = S().reasons, total = Object.keys(r).reduce(function (a, k) { return a + r[k]; }, 0);
    return { total: total, list: REASONS.map(function (x) { return { key: x[0], label: x[1], n: r[x[0]] || 0, share: total ? (r[x[0]] || 0) / total : 0 }; }).sort(function (a, b) { return b.n - a.n; }) };
  }

  /* ---------------- The screen ---------------- */
  function view(v, gid) {
    var UI = CT.UI, esc = UI.esc, Chess = CT.Chess, g = CT.Games.get(gid);
    if (!g) { v.innerHTML = '<p>Game not found. <a href="#/analysis/games">My games</a></p>'; return; }
    v.innerHTML = '<a class="back" href="#/analysis/game/' + g.id + '">← Full review</a><h1 class="lesson-title">🧠 Think first</h1>' +
      '<p class="muted small">vs ' + esc(opp(g) || 'opponent') + ' — before the engine shows anything, look at your turning points again.</p>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = v.querySelector('.panel-body'), board, list = [], idx = 0, stage = 'idle', results = [], cur = null, cancelled = false;
    board = new CT.Board(v.querySelector('.board-host'), { canMove: function (c) { return stage === 'guess' && c === g.userColor; }, onMove: onMove });
    CT.Annotate.bind(panel, function () { return board; });

    function start() {
      if (!g.userColor) { panel.innerHTML = '<p>Tell the app which side you played first (in the full review).</p><a class="btn" href="#/analysis/game/' + g.id + '">Full review</a>'; return; }
      if (!g.analysis) return analyse();
      list = moments(g);
      if (!list.length) {
        if (!done(g.id)) finish(g, []);
        panel.innerHTML = '<h2>No big mistakes</h2><p>Stockfish found no mistakes or blunders by you in this game. Nice. 🎉</p><div class="btn-row"><a class="btn primary" href="#/analysis/game/' + g.id + '">Full review</a></div>';
        return;
      }
      idx = 0; results = []; show();
    }

    function analyse() {
      panel.innerHTML = '<h2>Analysing with the engine…</h2><p class="small muted">Its verdict stays hidden until you have had your say. About a minute.</p><div class="an-bar">' + UI.bar(0) + '</div>';
      CT.Analyzer.pick(true).then(function (an) {
        return CT.Analysis.analyseGame({ startFen: g.startFen, moves: g.moves, headers: g.headers }, { analyzer: an, depth: 14, onProgress: function (i, n) { var b = panel.querySelector('.an-bar'); if (b) b.innerHTML = UI.bar(i / n); } });
      }).then(function (res) {
        if (cancelled) return;
        CT.Games.saveAnalysis(g.id, res); g = CT.Games.get(gid); start();
      }).catch(function (e) { panel.innerHTML = '<p class="bad">The analysis did not finish: ' + esc(e && e.message || e) + '</p>'; });
    }

    function show() {
      cur = list[idx]; stage = 'guess';
      var game = new Chess(cur.fenBefore);
      board.setOrientation(g.userColor);
      board.setGame(game, { lastMove: null, sound: false });
      board.setArrows([]);
      panel.innerHTML = '<p class="small muted">Turning point ' + (idx + 1) + ' of ' + list.length + ' · move ' + cur.moveNo + '</p>' +
        '<h2>Your move. What is best here?</h2><p>This position comes from your game. Take your time — look at checks, captures and threats for <em>both</em> sides, then play your move on the board.</p>' +
        '<p class="small muted">The engine\'s answer is hidden until you have played.</p>';
      CT.Voice.say('Turning point ' + (idx + 1) + '. Move ' + cur.moveNo + '. Find the best move. Check your opponent\'s threats first.');
    }

    function onMove(from, to, promotion) {
      if (stage !== 'guess') return false;
      var game = new Chess(cur.fenBefore), mv = game.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
      stage = 'reason';
      var r = { m: cur, guess: mv.san, guessOk: mv.san === cur.best, guessLoss: mv.san === cur.best ? 0 : null, sameAsGame: mv.san === cur.san };
      results[idx] = r;
      // Score the new try quietly while the learner answers the "why".
      if (!r.guessOk && !r.sameAsGame) {
        CT.Analyzer.pick(true).then(function (an) { return an.evaluate(game.fen(), 12); }).then(function (ev) {
          var w = CT.Analysis.winPct(ev), mine = g.userColor === 'w' ? w : 100 - w;
          r.guessLoss = Math.max(0, cur.winBefore - mine); r.guessOk = r.guessLoss < 5;
        }).catch(function () { /* stays unknown */ });
      } else if (r.sameAsGame) { r.guessLoss = cur.loss; }
      panel.innerHTML = '<p>You chose <strong>' + esc(mv.san) + '</strong>' + (r.sameAsGame ? ' — the same move as in the game.' : '.') + '</p>' +
        '<h2>In the game you played ' + esc(cur.san) + '. Why?</h2><div class="reason-chips">' +
        REASONS.map(function (x) { return '<button class="chip" data-reason="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
        '<p class="small muted">Be honest — this is how the coach learns where your mistakes come from.</p>';
    }

    function reveal(reason) {
      var r = results[idx]; r.reason = reason; stage = 'reveal';
      var base = new Chess(cur.fenBefore), best = new Chess(cur.fenBefore).move(cur.best), played = new Chess(cur.fenBefore).move(cur.san);
      var arrows = [];
      if (played) arrows.push({ from: played.from, to: played.to, color: 'red' });
      if (best) arrows.push({ from: best.from, to: best.to, color: 'green' });
      var punish = null;
      if (cur.reply && played) { var aft = new Chess(cur.fenAfter); punish = aft.move(cur.reply); }
      board.setGame(base, { lastMove: null, sound: false });
      board.setArrows(arrows);
      var verdict = r.guess === cur.best ? '<p class="good">✓ You found the engine\'s move: ' + esc(cur.best) + '.</p>' :
        r.sameAsGame ? '<p class="bad">You chose the game move again — this is exactly the blind spot to train.</p>' :
        r.guessLoss == null ? '<p>Your try: ' + esc(r.guess) + '. The engine prefers ' + esc(cur.best) + '.</p>' :
        r.guessLoss < 5 ? '<p class="good">✓ ' + esc(r.guess) + ' is also good (the engine\'s first choice is ' + esc(cur.best) + ').</p>' :
        '<p class="bad">' + esc(r.guess) + ' is better than the game move but still not right — the engine plays ' + esc(cur.best) + '.</p>';
      var th = themeFor(cur);
      panel.innerHTML = verdict +
        '<div class="explain"><p><span class="arrow-key red"></span>Game: <strong>' + esc(cur.san) + '</strong> lost ' + Math.round(cur.loss) + '% winning chances (' + esc(cur.cls) + ').</p>' +
        '<p><span class="arrow-key green"></span>Best: <strong>' + esc(cur.best) + '</strong>' + (cur.bestPv && cur.bestPv.length > 1 ? ' <span class="small muted">(' + esc(cur.bestPv.slice(0, 4).join(' ')) + ')</span>' : '') + '</p>' +
        (punish ? '<p>After ' + esc(cur.san) + ', your opponent\'s best answer was <strong>' + esc(punish.san) + '</strong>' + (cur.lessonKind === 'threat' ? ' — that was the threat.' : '.') + ' <button class="btn small" data-act="punish">Show</button></p>' : '') +
        (cur.explanation ? '<p>' + CT.Annotate.annotate(cur.explanation, cur.fenBefore).html + '</p>' : '') +
        (th ? '<p class="small muted">In 3 days you will get a different position with the same idea (' + esc(CT.Data.themes[th].name) + ').</p>' : '') + '</div>' +
        '<div class="btn-row"><button class="btn primary" data-act="next">' + (idx + 1 < list.length ? 'Next turning point ▶' : 'Finish') + '</button></div>';
      CT.Voice.say('The engine plays ' + cur.best + '. ' + CT.Voice.brief(cur.explanation || '', 1));
      v._punish = punish;
    }

    function summary() {
      finish(g, results);
      stage = 'done';
      var found = results.filter(function (r) { return r.guessOk; }).length, rs = reasonStats();
      panel.innerHTML = '<h2>' + (found === results.length ? 'All found 🎉' : found + ' of ' + results.length + ' found') + '</h2>' +
        '<p>Thinking it through yourself before looking makes the lesson stick far better than reading the engine\'s verdict.</p>' +
        (rs.total >= 3 ? '<p class="small">Why your mistakes happen (all games so far): ' + rs.list.filter(function (x) { return x.n; }).slice(0, 3).map(function (x) { return esc(x.label.toLowerCase()) + ' ' + Math.round(x.share * 100) + '%'; }).join(' · ') + '</p>' : '') +
        '<div class="btn-row"><a class="btn primary" href="#/analysis/game/' + g.id + '">See the full review</a></div>';
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-reason],[data-act]');
      if (!b) return;
      if (b.dataset.reason && stage === 'reason') reveal(b.dataset.reason);
      if (b.dataset.act === 'next') { idx++; if (idx < list.length) show(); else summary(); }
      if (b.dataset.act === 'punish' && v._punish) {
        var aft = new Chess(cur.fenAfter); aft.move(v._punish.san);
        board.setGame(aft, { lastMove: { from: v._punish.from, to: v._punish.to } });
        board.setArrows([{ from: v._punish.from, to: v._punish.to, color: 'yellow' }]);
      }
    });
    start();
    return function () { cancelled = true; };
  }

  CT.Think = { REASONS: REASONS, moments: moments, done: done, pendingGames: pendingGames, dueTransfer: dueTransfer, markTransfer: markTransfer, finish: finish, reasonStats: reasonStats, themeFor: themeFor, state: S };
  CT.Views = CT.Views || {};
  CT.Views.think = view;
})(typeof window !== 'undefined' ? window : globalThis);
