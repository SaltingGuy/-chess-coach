/* Opening Academy: repertoire overview, Learn mode (guided walkthrough) and Drill mode (recall with spaced repetition). */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  var KIND = {
    main: ['main line', ''], 'gambit-accepted': ['gambit accepted', ''], declined: ['declined', ''],
    punish: ['punish the mistake', 'learning'], trap: ['trap', 'due'], 'trap-avoid': ['trap to avoid', 'bad']
  };

  function ecBadge(l) {
    var iss = CT.EngineCheck.issuesFor(l.id);
    if (!iss) return '';
    var real = iss.filter(function (i) { return !i.gambit; });
    return real.length ? '<span class="tag bad" title="Stockfish disagrees with this lesson">⚠ engine flag</span> ' : '<span class="tag ok" title="Every move checked by Stockfish">✓ Stockfish-checked</span> ';
  }

  function ecCard() {
    var r = CT.EngineCheck.results();
    var flagged = [];
    if (r) Object.keys(r.lines).forEach(function (id) {
      r.lines[id].issues.forEach(function (i) { var l = CT.Coach.lineById(id); if (l) flagged.push({ l: l, i: i }); });
    });
    return '<section class="card ec-card"><div class="row-between wrap"><h2>Stockfish verification</h2><div class="btn-row"><button class="btn small" data-act="ec-run">' + (r ? 'Run again' : 'Verify all lines with Stockfish') + '</button></div></div>' +
      '<div class="ec-status small">' + (r ? 'Last run: ' + new Date(r.at).toLocaleString() + ' · ' + esc(r.engine) + ' depth ' + r.depth + ' · ' + r.checked + '/' + r.total + ' of your moves checked' + (r.complete ? '' : ' (stopped early)') + '.' : (CT.Store.state.engineCheck ? '<strong>The check has been improved</strong> (it now compares moves from the same position and depth, which removes false alarms). Your old results were cleared — please run it again. ' : '') + 'Checks every one of your repertoire moves against Stockfish, running in your browser (takes a few minutes). A lesson move is flagged only if Stockfish finds it clearly worse (about 0.7 pawns or more) and a deeper search agrees — never silently changed. Small differences between good moves are normal in openings and are not flagged.') + '</div>' +
      (flagged.length ? '<ul class="plist small">' + flagged.map(function (f) {
        var n = Math.floor(f.i.ply / 2) + 1;
        return '<li><a href="#/openings/' + f.l.id + '/learn">' + esc(f.l.name) + '</a> — move ' + n + (f.i.ply % 2 ? '…' : '.') + ' ' + esc(f.i.move) + ': Stockfish prefers <strong>' + esc(f.i.best) + '</strong>' + (f.i.moveEval ? ' (' + esc(f.i.bestEval) + ' vs ' + esc(f.i.moveEval) + ' for the lesson move, about ' + f.i.diff + '% winning chances)' : ' (' + f.i.diff + '% winning chances)') + (f.i.gambit ? ' <span class="tag">deliberate gambit</span>' : '') + '</li>';
      }).join('') + '</ul>' : (r ? '<p class="good small">No disagreements found.</p>' : '')) + '</section>';
  }

  function overview(view) {
    var D = CT.Data, Coach = CT.Coach;
    var reps = D.repertoires.map(function (r) {
      var lines = r.lines.map(function (id) { return Coach.lineById(id); });
      var learnable = lines.filter(function (l) { return !l.lessonOnly; });
      var learnedN = learnable.filter(function (l) { return Coach.openingStatus(l).key !== 'new'; }).length;
      return '<section class="card rep"><div class="row-between wrap"><div><h2>' + esc(r.name) + '</h2><p class="small muted">' + esc(r.role) + ' · you play ' + UI.sideName(r.side) + ' · ' + learnedN + '/' + learnable.length + ' lines learned</p></div>' +
        '<div class="line-actions"><a class="btn small" href="#/openings/explore/' + r.id + '">Explore</a><a class="btn small" href="#/openings/spar/' + r.id + '">Spar</a><a class="btn small" href="#/openings/quiz/' + r.id + '">Quiz</a></div></div>' +
        '<p>' + esc(r.description) + '</p>' +
        (r.plans ? '<details class="tool plans"><summary>Plans &amp; key ideas</summary>' + r.plans.map(function (pl) { return '<h3>' + esc(pl[0]) + '</h3><p>' + esc(pl[1]) + '</p>'; }).join('') + '</details>' : '') +
        '<ul class="lines">' + lines.map(function (l) {
          var st = Coach.openingStatus(l), rec = CT.Store.state.openings[l.id], k = KIND[l.kind] || [l.kind, ''];
          return '<li><div><a href="#/openings/' + l.id + '/learn"><strong>' + esc(l.name) + '</strong></a>' +
            '<p class="small muted"><span class="tag ' + k[1] + '">' + esc(k[0]) + (l.soundness ? ': ' + esc(l.soundness) : '') + '</span> ' + ecBadge(l) + l.moves.length + ' half-moves' + (rec && rec.drills ? ' · ' + rec.clean + '/' + rec.drills + ' clean drills' : '') + '</p></div>' +
            '<div class="line-actions"><span class="tag ' + st.key + '">' + st.label + '</span>' +
            '<a class="btn small" href="#/openings/' + l.id + '/learn">Learn</a>' +
            (l.lessonOnly ? '' : '<a class="btn small' + (st.key === 'due' ? ' primary' : '') + '" href="#/openings/' + l.id + '/drill">Drill</a>') + '</div></li>';
        }).join('') + '</ul></section>';
    }).join('');
    view.innerHTML = '<header class="page-head"><div><h1>Opening Academy</h1><p class="muted">Learn each line move by move, drill it from memory, quiz yourself on key positions, and spar against a simulated opponent who varies the replies.</p></div>' +
      '<a class="btn primary big" href="#/openings/quiz/all">Quiz me</a></header>' +
      '<p class="infobox">Labels: <strong>trap (sound)</strong> = costs you nothing if the opponent sees it; <strong>trap (conditional)</strong> = only works if the opponent errs, with a known correct defence; <strong>punish</strong> = a common opponent mistake and how to exploit it. Every move is rule-checked, every one of your moves passes a shallow engine blunder-check, and every trap and punishment is engine-verified. Use the Stockfish verification below for a deep check on your device.</p>' +
      ecCard() +
      reps +
      '<section class="card"><h2>Still to come</h2><ul class="soon">' + D.openingsComingSoon.map(function (c) {
        return '<li>' + esc(c.name) + '</li>';
      }).join('') + '</ul></section>';
    bindEcRun(view);
  }

  function bindEcRun(view) {
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act=ec-run]');
      if (!b) return;
      var st = view.querySelector('.ec-status');
      if (CT.EngineCheck.isRunning()) { CT.EngineCheck.stop(); b.textContent = 'Stopping…'; return; }
      b.textContent = 'Stop';
      st.innerHTML = 'Loading Stockfish…' + UI.bar(0);
      CT.EngineCheck.run(12, function (i, n, name) {
        st.innerHTML = 'Checking ' + i + '/' + n + ' — ' + esc(name) + UI.bar(i / n);
      }).then(function () { CT.App.rerender(); }, function (err) { b.textContent = 'Verify all lines with Stockfish'; st.innerHTML = '<span class="bad">' + esc(err.message) + '</span>'; });
    });
  }

  function lesson(view, lineId, mode) {
    var Chess = CT.Chess, Store = CT.Store, Coach = CT.Coach;
    var line = Coach.lineById(lineId);
    if (!line) { view.innerHTML = '<p>Line not found. <a href="#/openings">Back</a></p>'; return; }
    if (line.lessonOnly) mode = 'learn';
    var game = new Chess(), ply = 0, board, mistakes = [], wrongAt = {}, finished = false, timer;
    var youAre = line.side;

    var backHref = line.library ? '#/lab' : '#/openings', backName = line.library ? 'Deception Lab' : 'Opening Academy';
    var SOUND = { sound: 'Sound', conditional: 'Conditional', unsound: 'Unsound' };
    function badge() { return line.soundness ? '<span class="tag sound-' + line.soundness + '">' + SOUND[line.soundness] + ' trap</span> ' : ''; }
    view.innerHTML = '<a class="back" href="' + backHref + '">← ' + backName + '</a>' +
      '<div class="row-between wrap"><h1 class="lesson-title">' + esc(line.name) + '</h1>' +
      '<div class="seg">' + '<a class="' + (mode === 'learn' ? 'on' : '') + '" href="#/openings/' + line.id + '/learn">Learn</a>' +
      (line.lessonOnly ? '' : '<a class="' + (mode === 'drill' ? 'on' : '') + '" href="#/openings/' + line.id + '/drill">Drill</a>') + '</div></div>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div><div class="nav-row">' +
      (mode === 'learn' ? '<button class="btn" data-act="start" aria-label="Start">⏮</button><button class="btn" data-act="back" aria-label="Back">◀</button><button class="btn primary" data-act="fwd">Next ▶</button>' : '<button class="btn" data-act="restart">Restart drill</button>') +
      '<button class="btn" data-act="flip" aria-label="Flip board">⇅</button></div></div>' +
      '<aside class="panel"><div class="panel-body"></div><div class="movelist"></div></aside></div>';

    var panel = view.querySelector('.panel-body'), listEl = view.querySelector('.movelist');
    CT.Annotate.bind(panel, function () { return board; });
    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: youAre,
      canMove: function (color) { return !finished && ply < line.moves.length && color === youAre && game.turn() === youAre; },
      onMove: onUserMove
    });

    function isYours(i) { return (i % 2 === 0 ? 'w' : 'b') === youAre; }

    function goTo(n) {
      game = new Chess();
      for (var i = 0; i < n; i++) game.move(line.moves[i][0]);
      ply = n;
      var last = n ? game.history({ verbose: true })[n - 1] : null;
      board.setGame(game, { lastMove: last ? { from: last.from, to: last.to } : null });
      render();
    }

    function annotateText(t) { return CT.Annotate.annotate(t, null).html; }
    function render(extra, keepArrows) {
      var html = '';
      if (mode === 'learn') {
        if (ply === 0) {
          html += '<p>' + badge() + annotateText(line.summary) + '</p>';
          if (line.stockfish) { var sf = line.stockfish, pe = function (cp) { return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1); }; html += '<p class="small muted">✔ Checked with Stockfish (' + esc(sf.source) + ', depth ' + sf.depth + '): the mistake moves the evaluation from ' + pe(sf.mistake[0]) + ' to ' + pe(sf.mistake[1]) + '; the punishment keeps ' + pe(sf.punish[0]) + ' (next best move ' + pe(sf.punish[1]) + '). Positive = good for ' + UI.sideName(line.side) + '.</p>'; }
          if (line.library) html += '<div class="explain"><h3>How it works</h3><p>' + annotateText(line.mechanism) + '</p></div>';
          html += '<p class="small muted">' + (line.library ? 'Shown from ' + UI.sideName(youAre) + '\'s side. ' : 'You play ' + UI.sideName(youAre) + '. ') + 'Press <strong>Next</strong> to step through' + (line.lessonOnly && !line.mistakePly ? '.' : ', or play the move on the board yourself when it is your turn.') + ' Arrows show each move; blue arrows and circles show ideas mentioned in the text — tap any highlighted move or square to see it.</p>';
          if (!keepArrows) { board.setArrows([]); board.setMarks({}); }
        } else {
          var mvSan = line.moves[ply - 1][0], ann = CT.Annotate.annotate(line.moves[ply - 1][1], game.fen(), { skip: mvSan });
          html += '<p class="mvhead"><strong>' + moveLabel(ply - 1) + '</strong>' + (line.mistakePly === ply - 1 ? ' <span class="tag bad">mistake</span>' : '') + '</p><p>' + ann.html + '</p>';
          var ecIssue = CT.EngineCheck.issueAt(line.id, ply - 1);
          if (ecIssue) html += '<p class="warnbox small">⚠ Stockfish check: here Stockfish prefers <strong>' + esc(ecIssue.best) + '</strong> (' + esc(ecIssue.bestEval) + (ecIssue.moveEval ? ' vs ' + esc(ecIssue.moveEval) + ' for the lesson move' : '') + ') — the lesson move costs about ' + ecIssue.diff + '% winning chances' + (ecIssue.gambit ? ' (this is the deliberate gambit pawn, so some cost is expected)' : '. Treat this part of the lesson with caution until it is reviewed') + '.</p>';
          if (!keepArrows) {
            var h = game.history({ verbose: true }), lm = h[h.length - 1];
            CT.Annotate.showOnBoard(board, ann, lm ? { from: lm.from, to: lm.to, color: isYours(ply - 1) ? 'green' : 'red' } : null);
          }
        }
        var promptHere = ply < line.moves.length && isYours(ply) && (!line.lessonOnly || line.mistakePly === ply - 1);
        if (promptHere) html += line.mistakePly === ply - 1 ?
          '<p class="prompt">⚠ ' + (line.lessonOnly && youAre !== line.setter && line.setter ? 'Your opponent just made a mistake. ' : 'Your opponent just made a mistake. ') + 'Can you find the punishment? Try it on the board, or press Next.</p>' :
          '<p class="prompt">Your move: what does ' + UI.sideName(youAre) + ' play here? Try it on the board, or press Next.</p>';
        if (ply >= line.moves.length) {
          html += '<div class="explain"><h3>End of line</h3><p>' + annotateText(line.summary) + '</p>' +
            (line.library ? '<h3>How to avoid it</h3><p>' + annotateText(line.avoid) + '</p><h3>If the opponent does not fall for it</h3><p>' + annotateText(line.ifNot) + '</p><h3>The pattern to remember</h3><p>' + annotateText(line.pattern) + '</p>' : '') + '</div>' +
            (line.lessonOnly ? '<div class="btn-row"><a class="btn" href="' + backHref + '">Back to ' + backName + '</a></div>' : '<div class="btn-row"><a class="btn primary" href="#/openings/' + line.id + '/drill">Drill it from memory</a></div>');
          Store.markLearned(line.id);
        }
      } else {
        if (finished) {
          var clean = mistakes.length === 0;
          html += '<div class="explain"><h3>' + (clean ? '✓ Perfect drill!' : 'Drill complete') + '</h3>' +
            (clean ? '<p>You played every move correctly. This line will come back in a few days to keep it fresh.</p>' :
              '<p>' + mistakes.length + ' mistake' + (mistakes.length > 1 ? 's' : '') + ' — this line will come back soon. Review:</p><ul>' + mistakes.map(function (i) {
                return '<li><strong>' + moveLabel(i) + '</strong> — ' + esc(line.moves[i][1]) + '</li>';
              }).join('') + '</ul>') + '</div>' +
            '<div class="btn-row"><button class="btn primary" data-act="restart">Drill again</button><a class="btn" href="#/openings">All openings</a></div>';
        } else {
          html += '<p>Play ' + UI.sideName(youAre) + '\'s moves from memory. The opponent\'s moves are played for you.</p>';
          if (ply < line.moves.length && isYours(ply)) html += '<p class="prompt">' + (line.mistakePly === ply - 1 ? 'Your opponent made a mistake — punish it! ' : 'Your move ') + '(' + moveLabel(ply).replace(/\s.*$/, '') + ')</p>';
          if (wrongAt[ply]) html += '<button class="btn small" data-act="reveal">Show me the move</button>';
        }
      }
      if (extra) html = extra + html;
      panel.innerHTML = html;
      if (!keepArrows) speakLesson(extra);
      listEl.innerHTML = UI.moveListHtml(line.moves.slice(0, ply).map(function (m) { return m[0]; }), 'w', ply - 1);
    }

    // Voice coach: read the current step aloud (learn mode), or the result (drill mode).
    function speakLesson(extra) {
      var V = CT.Voice, t = '';
      if (mode === 'learn') {
        if (ply === 0) t = line.name + '. ' + V.brief(line.summary, 2);
        else {
          var i = ply - 1, who = (i % 2 === 0 ? 'White' : 'Black');
          t = who + ' plays ' + line.moves[i][0] + '. ' + line.moves[i][1];
          if (line.mistakePly === i) t += ' That was a mistake.';
        }
        if (ply < line.moves.length && isYours(ply) && (!line.lessonOnly || line.mistakePly === ply - 1)) t += line.mistakePly === ply - 1 ? ' Can you find the punishment?' : ' Your move.';
        if (ply >= line.moves.length) t += ' End of line.';
        if (extra && /class="good"/.test(extra)) t = 'Correct! ' + t;
      } else if (finished) t = mistakes.length ? 'Drill complete, with ' + mistakes.length + ' mistake' + (mistakes.length > 1 ? 's' : '') + '.' : 'Perfect drill!';
      if (t) V.say(t);
    }

    function moveLabel(i) {
      var n = Math.floor(i / 2) + 1;
      return (i % 2 === 0 ? n + '. ' : n + '… ') + line.moves[i][0];
    }

    function autoOpponent() {
      clearTimeout(timer);
      if (ply < line.moves.length && !isYours(ply)) {
        timer = setTimeout(function () {
          var m = game.move(line.moves[ply][0]);
          ply++;
          board.setGame(game, { lastMove: { from: m.from, to: m.to } });
          if (mode === 'drill' && ply >= line.moves.length) return finishDrill();
          render();
        }, mode === 'drill' ? 450 : 0);
      } else if (mode === 'drill' && ply >= line.moves.length) finishDrill();
    }

    function finishDrill() {
      if (finished) return;
      finished = true;
      Store.recordDrill(line, mistakes);
      CT.Sound.play(mistakes.length ? 'bad' : 'win');
      render();
    }

    function onUserMove(from, to, promotion) {
      var expected = line.moves[ply][0];
      var test = new Chess(game.fen());
      var mv = test.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      if (mv.san === expected) {
        game.move(mv.san);
        ply++;
        board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
        CT.Sound.play('good');
        if (mode === 'learn') render('<p class="good">✓ Correct!</p>');
        else { render('<p class="good">✓ ' + esc(mv.san) + '</p>'); if (ply >= line.moves.length) finishDrill(); else autoOpponent(); }
        return true;
      }
      CT.Sound.play('bad');
      // Wrong move: show what was played versus the repertoire move.
      if (mode === 'drill' && mistakes.indexOf(ply) < 0) mistakes.push(ply);
      wrongAt[ply] = (wrongAt[ply] || 0) + 1;
      var note = '<p class="bad">✗ ' + esc(mv.san) + ' is not the repertoire move.' + (mode === 'drill' ? '' : ' Try again — or press Next to see it.') + '</p>';
      if (wrongAt[ply] >= 2 || mode === 'learn') {
        var exp = new Chess(game.fen()).move(expected);
        if (exp) board.setArrows([{ from: exp.from, to: exp.to, color: 'green' }]);
        if (mode === 'drill') note += '<p class="small">The green arrow shows the move. Play it to continue.</p>';
      }
      render(note, true);
      CT.Voice.say(mv.san + ' is not the repertoire move.' + (mode === 'learn' ? ' The green arrow shows it.' : wrongAt[ply] >= 2 ? ' Play the green arrow move.' : ' Try again.'));
      return false;
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'flip') board.flip();
      if (a === 'start') goTo(0);
      if (a === 'back') goTo(Math.max(0, ply - 1));
      if (a === 'fwd' && ply < line.moves.length) goTo(ply + 1);
      if (a === 'restart') { mistakes = []; wrongAt = {}; finished = false; goTo(0); autoOpponent(); }
      if (a === 'reveal') {
        var exp = new Chess(game.fen()).move(line.moves[ply][0]);
        if (exp) board.setArrows([{ from: exp.from, to: exp.to, color: 'green' }]);
      }
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.mv');
      if (b && mode === 'learn') goTo(+b.dataset.i + 1);
    });

    goTo(0);
    if (mode === 'drill') autoOpponent();
    return function () { clearTimeout(timer); };
  }

  CT.Views = CT.Views || {};
  CT.Views.openings = overview;
  CT.Views.openingLesson = lesson;
})(window);
