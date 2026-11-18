/*
 * Timed tests: one try per puzzle, no hints. Results count as real puzzle attempts (they feed spaced
 * repetition and the coach).
 *  • Milestone skill test (#/progress/test/:id): a pass is one of the requirements for the milestone.
 *  • Theme test-out (#/tactics/testout/:theme): 3 harder puzzles; pass all 3 and the theme only comes back
 *    as an occasional check-in.
 */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  function strip(s) { return String(s).replace(/[+#?!]/g, ''); }

  /**
   * cfg: { title, back: [href, label], rules: [html…], prev: html, secs, build(): puzzles[],
   *        finish(results, puzzles): { passed, html } }
   */
  function runTest(view, cfg) {
    var Chess = CT.Chess, Engine = CT.Engine, Store = CT.Store;
    var puzzles = [], idx = -1, results = [], game, board, ply, startAt, timerId = null, busy = false, done = false;

    view.innerHTML = '<a class="back" href="' + cfg.back[0] + '">← ' + esc(cfg.back[1]) + '</a>' +
      '<div class="row-between wrap"><h1 class="lesson-title">' + esc(cfg.title) + '</h1><span class="tag test-count"></span></div>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), {
      canMove: function (color) { return !busy && !done && idx >= 0 && game && color === game.turn() && results[idx] === undefined; },
      onMove: onUserMove
    });

    function intro() {
      board.setGame(new Chess(), { lastMove: null, sound: false });
      panel.innerHTML = '<h2>How the test works</h2><ul class="small">' + cfg.rules.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' +
        (cfg.prev || '') + '<div class="btn-row"><button class="btn primary big" data-act="begin">Start test</button></div>';
    }

    function next() {
      idx++;
      if (idx >= puzzles.length) return finish();
      var p = puzzles[idx];
      game = new Chess(p.fen); ply = 0; busy = false; startAt = Date.now();
      panel.dataset.pid = p.id;
      board.setOrientation(game.turn());
      board.setGame(game, { lastMove: p.pre ? { from: p.pre.from, to: p.pre.to } : null, sound: false });
      view.querySelector('.test-count').textContent = 'Puzzle ' + (idx + 1) + ' / ' + puzzles.length;
      draw();
      CT.Voice.say('Puzzle ' + (idx + 1) + '. ' + UI.sideName(game.turn()) + ' to move. ' + (p.goal === 'mate' ? 'Find the checkmate in ' + p.mateIn + '.' : 'Win material.'));
      clearInterval(timerId);
      timerId = setInterval(function () {
        var left = cfg.secs * 1000 - (Date.now() - startAt);
        var el = panel.querySelector('.tclock');
        if (el) { el.textContent = Math.max(0, Math.ceil(left / 1000)) + 's'; el.classList.toggle('low', left < 15000); }
        if (left <= 0) miss('time');
      }, 250);
    }

    function draw(msg) {
      var p = puzzles[idx];
      panel.innerHTML = '<div class="row-between"><strong>' + UI.sideName(game.turn()) + ' to move</strong><span class="tclock clock">' + cfg.secs + 's</span></div>' +
        '<p>' + esc(p.exact ? p.prompt : p.goal === 'mate' ? 'Find the checkmate (mate in ' + p.mateIn + ').' : 'Find the best move — win material.') + '</p>' + (msg || '') +
        '<p class="small muted">Score so far: ' + results.filter(Boolean).length + ' / ' + results.length + '</p>';
    }

    function onUserMove(from, to, promotion) {
      var p = puzzles[idx];
      var mv = game.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      var correct;
      if (p.exact) {
        correct = strip(mv.san) === strip(p.line[ply]) || game.isCheckmate();
      } else if (p.goal === 'mate') {
        game.undo();
        correct = Engine.sanForcesMate(game, mv.san, p.mateIn - Math.floor(ply / 2));
        game.move(mv.san);
      } else {
        correct = strip(mv.san) === strip(p.line[ply]) || (ply === 0 && (p.alsoAccept || []).some(function (a) { return strip(a) === strip(mv.san); }));
      }
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
      if (!correct) { miss('wrong', mv.san); return true; }
      var onLine = strip(mv.san) === strip(p.line[ply] || ''), alt = !onLine && p.goal !== 'mate';
      ply++;
      if (game.isCheckmate() || alt || (p.goal !== 'mate' && ply >= p.line.length)) { hit(); return true; }
      CT.Sound.play('good');
      busy = true;
      draw('<p class="good">✓ Correct so far — keep going.</p>');
      setTimeout(function () {
        if (results[idx] !== undefined) return;
        var reply = (onLine || p.exact) && p.line[ply] ? p.line[ply] : Engine.stubbornDefence(game, p.mateIn - Math.floor(ply / 2));
        var r = game.move(reply);
        ply++; busy = false;
        board.setGame(game, { lastMove: r ? { from: r.from, to: r.to } : null });
        draw('<p class="good">✓ Opponent replied ' + esc(r ? r.san : reply) + '. Your move.</p>');
      }, 550);
      return true;
    }

    function hit() {
      clearInterval(timerId);
      var p = puzzles[idx];
      results[idx] = true;
      Store.recordPuzzle(p, { ok: true, ms: Date.now() - startAt });
      CT.Sound.play('win');
      busy = true;
      draw('<p class="good">✓ Solved.</p>');
      CT.Voice.say('Solved.');
      setTimeout(next, 700);
    }

    function miss(kind, san) {
      if (results[idx] !== undefined) return;
      clearInterval(timerId);
      var p = puzzles[idx];
      results[idx] = false;
      Store.recordPuzzle(p, { ok: false, ms: Date.now() - startAt });
      CT.Sound.play('bad');
      busy = true;
      var sol = new Chess(p.fen).move(p.line[0]);
      if (sol) board.setArrows([{ from: sol.from, to: sol.to, color: 'green' }]);
      panel.innerHTML = '<p class="bad">' + (kind === 'time' ? '⏱ Time is up.' : '✗ ' + esc(san) + ' is not the solution.') + '</p>' +
        '<p>The solution starts with <strong>' + esc(p.line[0]) + '</strong> (green arrow). This puzzle goes back into your review queue.</p>' +
        '<div class="btn-row"><button class="btn primary" data-act="next">' + (idx + 1 < puzzles.length ? 'Next puzzle' : 'See result') + '</button></div>';
      CT.Voice.say((kind === 'time' ? 'Time is up. ' : 'Not the solution. ') + 'It starts with ' + p.line[0] + '.');
    }

    function finish() {
      done = true; clearInterval(timerId);
      var res = cfg.finish(results, puzzles), score = results.filter(Boolean).length / results.length;
      CT.Sound.play(res.passed ? 'win' : 'bad');
      view.querySelector('.test-count').textContent = 'Finished';
      CT.Voice.say((res.passed ? 'Passed! ' : 'Not yet. ') + 'You solved ' + results.filter(Boolean).length + ' of ' + results.length + '.');
      panel.innerHTML = '<div class="explain"><h2>' + (res.passed ? '✓ Passed' : 'Not yet') + ' — ' + Math.round(score * 100) + '%</h2>' + res.html + '</div>' +
        '<h3 class="mt">Puzzles</h3><ul class="plist small">' + puzzles.map(function (p, i) {
          return '<li>' + (results[i] ? '✓' : '✗') + ' <a href="#/tactics/p/' + p.id + '">' + esc(p.title) + '</a> <span class="muted">(' + esc(CT.Data.themes[p.theme].name) + (p.source === 'lichess' ? ', rated ' + p.rating : '') + ')</span></li>';
        }).join('') + '</ul><div class="btn-row"><a class="btn primary" href="' + cfg.back[0] + '">' + esc(cfg.back[1]) + '</a><button class="btn" data-act="begin">Retake</button></div>';
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'begin') { puzzles = cfg.build(); idx = -1; results = []; done = false; busy = false; board.setArrows([]); next(); }
      if (b.dataset.act === 'next') next();
    });
    intro();
    return function () { clearInterval(timerId); };
  }

  /* ---------------- Milestone skill test ---------------- */
  function skillTest(view, id) {
    var M = CT.Milestones, m = M.byId(id), Store = CT.Store;
    if (!m) { view.innerHTML = '<p>Unknown test. <a href="#/progress">Progress</a></p>'; return; }
    if (!M.testAvailable(m)) {
      view.innerHTML = '<a class="back" href="#/progress">← Progress</a><h1>' + m.rating + ' skill test</h1><div class="warnbox"><p>This test is not available yet: the puzzle library does not have enough verified puzzles at this level. It will open when harder puzzles are added.</p></div>';
      return;
    }
    var t = m.test, prev = (Store.state.tests || {})[m.id];
    return runTest(view, {
      title: m.rating + ' skill test — ' + m.title, back: ['#/progress', 'Back to milestones'], secs: t.secs,
      rules: [
        t.count + ' puzzles on: ' + esc(t.themes.map(function (k) { return CT.Data.themes[k].name; }).join(', ')) + '.',
        'One try per puzzle, no hints. A wrong move or running out of time (' + t.secs + ' seconds each) counts as a miss.',
        'You need ' + Math.round(t.pass * 100) + '% to pass. You can retake it any time; your best score is kept.',
        'Calculate before you move — the clock is generous on purpose.'
      ],
      prev: prev ? '<p class="small muted">Previous best: ' + Math.round(prev.best * 100) + '%' + (prev.passed ? ' — passed ✓' : '') + '</p>' : '',
      build: function () { return M.buildTest(m); },
      finish: function (results) {
        var score = results.filter(Boolean).length / results.length, passed = score >= t.pass;
        Store.recordTest(m.id, score, passed);
        var st = M.status(), reachedNow = st.list.find(function (s) { return s.m.id === m.id; });
        return { passed: passed, html: '<p>' + results.filter(Boolean).length + ' of ' + results.length + ' solved. ' + (passed ? 'The test requirement for ' + m.rating + ' is complete.' : 'You need ' + Math.round(t.pass * 100) + '%. Train the missed themes, then try again.') + '</p>' +
          (reachedNow && reachedNow.reached ? '<p class="good">🏁 Milestone ' + m.rating + ' reached!</p>' : '') };
      }
    });
  }

  /* ---------------- Theme test-out ---------------- */
  function testOut(view, theme) {
    var Coach = CT.Coach, Store = CT.Store, th = CT.Data.themes[theme], T = Coach.TESTOUT;
    if (!th) { view.innerHTML = '<p>Unknown theme. <a href="#/tactics">Tactical Academy</a></p>'; return; }
    var back = ['#/tactics/theme/' + theme, th.name];
    if (!Coach.testOutAvailable(theme)) {
      view.innerHTML = '<a class="back" href="' + back[0] + '">← ' + esc(th.name) + '</a><h1>Test out: ' + esc(th.name) + '</h1><div class="warnbox"><p>This theme does not have enough puzzles for a test yet.</p></div>';
      return;
    }
    var prev = (Store.state.testouts || {})[theme];
    return runTest(view, {
      title: 'Test out: ' + th.name, back: back, secs: T.secs,
      rules: [
        T.count + ' puzzles from this theme, chosen to be harder than usual: ones you have not seen, a bit above your puzzle rating (' + Store.puzzleRating() + ').',
        'One try each, no hints, ' + T.secs / 60 + ' minutes per puzzle.',
        'Solve all ' + T.count + ' and this theme stops appearing in your Daily Mix, except for a check-in about every ' + Math.round(Coach.CHECKIN_GAP / 86400000) + ' days. Miss a check-in and it comes back into normal training.',
        'If your own games show mistakes with this theme, you will still get it — your games matter more than a test.'
      ],
      prev: prev ? '<p class="small muted">Tried ' + prev.attempts + ' time' + (prev.attempts > 1 ? 's' : '') + (prev.passed ? ' — passed ✓' : '') + '.</p>' : '',
      build: function () { return Coach.buildTestOut(theme); },
      finish: function (results) {
        var ok = results.filter(Boolean).length, passed = ok >= Math.ceil(T.pass * results.length);
        Store.recordTestOut(theme, ok / results.length, passed);
        return { passed: passed, html: passed ?
          '<p>You tested out of <strong>' + esc(th.name) + '</strong>. It will only come back as an occasional check-in. You can undo this on the theme page.</p>' :
          '<p>' + ok + ' of ' + results.length + ' solved — you need all ' + results.length + '. The missed puzzles come back for review. Retaking gives you different puzzles.</p>' };
      }
    });
  }

  CT.Views = CT.Views || {};
  CT.Views.skillTest = skillTest;
  CT.Views.testOut = testOut;
})(typeof window !== 'undefined' ? window : globalThis);
