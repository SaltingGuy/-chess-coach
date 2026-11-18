/* Endgame Academy views: overview, the five level-1 drills (played against the exact solver), and Convert the Win. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  CT.Views = CT.Views || {};
  function E() { return CT.Endgame; }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function stars(n) { return '<span class="stars">' + '★★★'.slice(0, n) + '<span class="muted">' + '★★★'.slice(0, 3 - n) + '</span></span>'; }

  function overview(view) {
    var c = E().convertStats(), nx = E().next();
    view.innerHTML = '<header class="page-head"><div><h1>Endgame Academy</h1><p class="muted">Most games at your level are decided by who can finish. Every drill is checked by an exact endgame solver, so the verdicts are never guesses.</p></div>' +
      '<a class="btn primary big" href="' + nx.href + '">' + esc(nx.label) + '</a></header>' +
      '<h2 class="tier-head">Level 1 · Essential technique</h2><section class="theme-grid">' + E().DRILLS.map(function (d) {
        var r = E().rec(d.id), due = r && r.passes && r.due <= Date.now();
        return '<a class="card theme-card" href="#/endgames/' + d.id + '"><div class="row-between"><h3>' + d.icon + ' ' + esc(d.name) + '</h3>' + (r && r.passes ? stars(r.bestStars || 1) : '<span class="tag">' + (r ? 'not passed yet' : 'new') + '</span>') + '</div>' +
          '<p class="small muted">' + esc(d.goal) + '</p>' +
          '<p class="small">' + (r ? r.passes + '/' + r.attempts + ' passed' + (d.timed && r.bestMs ? ' · best ' + fmt(r.bestMs) : '') + (due ? ' · <strong>review due</strong>' : '') : 'Not tried') + '</p></a>';
      }).join('') + '</section>' +
      '<h2 class="tier-head">Convert the Win</h2><section class="card"><p>You are a piece or more up in a position from a real game. Win it against a bot that defends stubbornly or hits back with tactics. ' +
      '<strong>Pass</strong> = win without letting your lead drop below +2. This trains the skill that turns good positions into points.</p>' +
      '<p class="small muted">' + E().convertStats().attempts + ' tried · ' + c.passes + ' converted.</p>' +
      '<div class="btn-row"><a class="btn primary" href="#/endgames/convert/go">Start a conversion game</a></div></section>';
  }

  /* ---------- Convert the Win: start a practice game from the position ---------- */
  function startConvert(view) {
    view.innerHTML = '<p class="muted">Finding a position…</p>';
    setTimeout(function () {
      var pos = E().pickConvert();
      if (!pos) { view.innerHTML = '<p>No conversion positions are available (the puzzle pack did not load).</p><p><a href="#/endgames">Back</a></p>'; return; }
      var n = E().convertStats().attempts, style = n % 2 ? 'tactical' : 'defensive';
      var S = CT.Store;
      S.state.practiceCurrent = {
        style: style, level: CT.Coach.suggestedLevel(style), color: pos.color, rep: null, clock: null,
        startFen: pos.fen, moves: [], notes: [], times: null, takebacks: 0, engines: {}, startedAt: Date.now(), bookExit: null,
        safetyMode: S.state.profile.safetyMode || 'auto', safety: { checks: 0, correct: 0, caught: 0, missed: 0, saves: 0 },
        convert: { id: pos.id, startLead: pos.lead, minLead: pos.lead, rating: pos.rating }, punish: true
      };
      S.save();
      location.hash = '#/practice/play';
    }, 30);
  }

  /* ---------- Drills ---------- */
  function drill(view, id) {
    var d = E().get(id);
    if (!d) { view.innerHTML = '<p>Unknown drill. <a href="#/endgames">Endgame Academy</a></p>'; return; }
    var Chess = CT.Chess, TB = CT.Tablebase, game, board, st, timer = null, seq = 0;
    view.innerHTML = '<a class="back" href="#/endgames">← Endgame Academy</a>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"><p class="muted">Preparing the endgame solver…</p></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: d.color,
      canMove: function (color) { return st && !st.done && !st.busy && color === d.color && game.turn() === d.color; },
      onMove: onUserMove
    });
    CT.Annotate.bind(panel, function () { return board; });

    function teachHtml() {
      return '<details class="teach"' + (E().rec(id) ? '' : ' open') + '><summary>How to do it</summary><ul>' + d.teach.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
    }

    function start() {
      var my = ++seq;
      panel.innerHTML = '<p class="muted">Preparing the endgame solver… (a second the first time)</p>';
      setTimeout(function () {
        if (my !== seq) return;
        st = { done: false, busy: false, mistakes: 0, hints: 0, userMoves: 0, startAt: Date.now(), quizIndex: 0, quizOk: 0, msg: '' };
        if (d.quiz) { st.quiz = []; for (var i = 0; i < d.quiz; i++) { var f = E().position(id); if (f) st.quiz.push(f); } return loadQuiz(); }
        var fen = E().position(id);
        if (!fen) { panel.innerHTML = '<p class="bad">Could not build a position. Try again.</p><button class="btn" data-act="new">Try again</button>'; return; }
        game = new Chess(fen);
        var p = TB.probe(fen);
        st.optimal = p && p.plies != null ? Math.ceil(p.plies / 2) : null;
        st.limit = d.slack && st.optimal ? st.optimal + d.slack : null;
        board.setGame(game, { lastMove: null });
        if (d.timed) { clearInterval(timer); timer = setInterval(tickClock, 500); }
        draw('');
        CT.Voice.say(d.goal);
        if (game.turn() !== d.color) reply();
      }, 30);
    }

    function tickClock() { var el = panel.querySelector('.clock'); if (el && st && !st.done) el.textContent = fmt(Date.now() - st.startAt); }

    function draw(msg) {
      var info = '';
      if (st.limit) info = '<p class="small">Moves: <strong>' + st.userMoves + '</strong> / ' + st.limit + ' allowed <span class="muted">(perfect play needs ' + st.optimal + ')</span></p>';
      if (d.kpk === 'draw') info = '<p class="small">Moves held: <strong>' + st.userMoves + '</strong> / 10</p>';
      panel.innerHTML = '<div class="row-between"><h2>' + d.icon + ' ' + esc(d.name) + '</h2>' + (d.timed ? '<span class="clock">' + fmt(Date.now() - st.startAt) + '</span>' : '') + '</div>' +
        '<p>' + esc(d.goal) + ' <span class="small muted">You play ' + UI.sideName(d.color) + '.</span></p>' + info + (msg || '') + teachHtml() +
        (st.done ? '<div class="btn-row"><button class="btn primary" data-act="new">New position</button><a class="btn" href="#/endgames">All drills</a></div>' :
          (st.quiz ? '' : '<div class="btn-row"><button class="btn" data-act="hint">Hint</button><button class="btn" data-act="new">New position</button></div>'));
    }

    function finish(pass, why) {
      st.done = true; clearInterval(timer);
      var ms = Date.now() - st.startAt, used = st.userMoves, stars3 = 1;
      if (pass && st.optimal != null) stars3 = used <= st.optimal + 2 ? 3 : used <= st.optimal + 6 ? 2 : 1;
      else if (pass) stars3 = st.mistakes === 0 ? 3 : 2;
      if (pass && st.hints) stars3 = 1;
      var r = E().record(id, { pass: pass, ms: ms, moves: used, stars: stars3 });
      CT.Sound.play(pass ? 'win' : 'bad');
      var extra = d.timed && pass ? '<p>Time: <strong>' + fmt(ms) + '</strong>' + (ms < 60000 ? ' — under a minute! ✓ milestone standard' : ' — milestone 1000 wants under 1:00') + (r.bestMs ? ' · best ' + fmt(r.bestMs) : '') + '</p>' : '';
      draw('<div class="explain result-' + (pass ? 'win' : 'loss') + '"><h3>' + (pass ? '✓ Passed ' + stars(stars3) : '✗ Not this time') + '</h3><p>' + why + '</p>' + extra + '</div>');
      CT.Voice.say((pass ? 'Passed. ' : 'Not this time. ') + why.replace(/<[^>]+>/g, ''));
    }

    function onUserMove(from, to, promotion) {
      var before = game.fen();
      var mv = game.move({ from: from, to: to, promotion: promotion || 'q' });
      if (!mv) return false;
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
      if (st.quiz) return quizAnswer(before, mv), true;
      st.userMoves++;
      var j = E().judge(id, before, mv.san) || { ok: false };
      if (game.isCheckmate()) return finish(true, 'Checkmate in ' + st.userMoves + ' moves.'), true;
      if (game.isStalemate()) return finish(false, '<strong>Stalemate.</strong> The king had no legal move and was not in check, so the game is a draw. ' + (j.keepers && j.keepers.length ? 'A move that kept the win: <strong>' + esc(j.keepers[0]) + '</strong>.' : '')), true;
      if (d.kpk === 'win' || d.kpk === 'draw') {
        if (!j.ok) {
          st.mistakes++;
          game.undo();
          board.setGame(game, { lastMove: null });
          CT.Sound.play('bad');
          board.setArrows([]);
          draw('<p class="bad">✗ <strong>' + esc(mv.san) + '</strong> ' + (d.kpk === 'win' ? 'throws away the win — the defender can now hold the draw.' : 'loses — the pawn now promotes by force.') +
            ' Think about the opposition and try again.' + (st.mistakes >= 2 ? ' <span class="muted">(Moves that work: ' + esc(j.keepers.join(', ')) + ')</span>' : '') + '</p>');
          st.userMoves--;
          return true;
        }
        if (d.kpk === 'win' && mv.promotion) return finish(st.mistakes === 0, st.mistakes === 0 ? 'The pawn promoted and the new queen is safe — you used the opposition perfectly.' : 'You promoted, but needed ' + st.mistakes + ' retr' + (st.mistakes > 1 ? 'ies' : 'y') + '. This drill comes back soon; aim for no mistakes.'), true;
        if (d.kpk === 'draw' && (!TB.probe(game.fen()) || st.userMoves >= 10)) return finish(st.mistakes === 0, (!TB.probe(game.fen()) ? 'You won the pawn — a dead draw.' : 'Ten moves held with perfect defence.') + (st.mistakes ? ' But it took ' + st.mistakes + ' retr' + (st.mistakes > 1 ? 'ies' : 'y') + ', so it comes back soon.' : '')), true;
      } else {
        if (!j.ok) return finish(false, 'That move lets the win slip (the ' + (d.type === 'Q' ? 'queen' : 'rook') + ' can be captured). Keep your piece protected or far away from the enemy king.'), true;
        if (st.limit && st.userMoves >= st.limit) return finish(false, 'Out of moves: ' + st.limit + ' moves without mate. Use the box method — the hint button shows the idea.'), true;
      }
      draw('');
      reply();
      return true;
    }

    function reply() {
      st.busy = true;
      var my = seq;
      setTimeout(function () {
        if (my !== seq || st.done) return;
        var m = d.kpk === 'draw' ? trickiest(game.fen()) : TB.defend(game.fen());
        if (!m) { st.busy = false; return; }
        var r = game.move(m.san);
        st.busy = false;
        board.setGame(game, { lastMove: r ? { from: r.from, to: r.to } : null });
        if (game.isStalemate()) return finish(d.kpk === 'draw', 'Stalemate — a draw.');
        if (d.kpk === 'draw' && game.isCheckmate()) return finish(false, 'Checkmated.');
        draw('');
      }, 450);
    }

    /** For the attacker in a drawn position: the drawing move that leaves the defender the fewest saving replies. */
    function trickiest(fen) {
      var ms = TB.moves(fen);
      if (!ms.length) return null;
      var best = ms.filter(function (m) { return m.result === ms[0].result; });
      var scored = best.map(function (m) {
        var g = new Chess(fen); g.move(m.san);
        var replies = TB.moves(g.fen()), saving = replies.filter(function (x) { return x.result === 'draw' || x.result === 'win'; }).length;
        return { m: m, s: saving + Math.random() * 0.5 };
      });
      scored.sort(function (a, b) { return a.s - b.s; });
      return scored[0].m;
    }

    function hint() {
      if (st.done || st.busy) return;
      st.hints++;
      var ms = TB.moves(game.fen()), b = ms[0];
      if (!b) return;
      board.setArrows([{ from: b.from, to: b.to, color: 'green' }]);
      var words = d.type === 'Q' ? 'Shrink the box with the queen (a knight\'s move from the king), and bring your king when the enemy king reaches the edge.' :
        d.type === 'R' ? 'Keep the box with the rook. Walk your king closer; check only when the kings face each other.' :
          d.kpk === 'win' ? 'Your king goes in front of the pawn and fights for the opposition.' : 'Stay in front of the pawn and face the enemy king.';
      draw('<p class="small">💡 ' + esc(words) + ' The arrow shows a strong move. <span class="muted">(Hints cap this attempt at one star.)</span></p>');
    }

    /* Stalemate quiz */
    function loadQuiz() {
      if (st.quizIndex >= st.quiz.length) {
        var pass = st.quizOk >= Math.ceil(st.quiz.length * 0.8);
        st.optimal = null; st.mistakes = st.quiz.length - st.quizOk;
        return finish(pass, st.quizOk + ' of ' + st.quiz.length + ' kept the win. ' + (pass ? 'Your stalemate radar works.' : 'Count the king\'s squares before each quiet queen move.'));
      }
      game = new Chess(st.quiz[st.quizIndex]);
      board.setArrows([]);
      board.setGame(game, { lastMove: null });
      st.answered = false;
      draw('<p class="small">Position ' + (st.quizIndex + 1) + ' of ' + st.quiz.length + '. White to move.</p>');
    }
    function quizAnswer(before, mv) {
      var j = E().judge(id, before, mv.san) || { ok: false, keepers: [] };
      st.busy = true;
      var ok = j.ok && !j.stalemate, mate = game.isCheckmate();
      if (ok) st.quizOk++;
      CT.Sound.play(ok ? 'good' : 'bad');
      var best = TB.moves(before)[0];
      if (!ok && best) board.setArrows([{ from: best.from, to: best.to, color: 'green' }]);
      draw((ok ? '<p class="good">✓ ' + esc(mv.san) + (mate ? ' is checkmate!' : ' keeps the win' + (j.best ? ' — and it is the fastest.' : '. (Fastest was ' + esc(best.san) + '.)')) + '</p>' :
        '<p class="bad">✗ ' + esc(mv.san) + (game.isStalemate() ? ' is <strong>stalemate</strong> — draw.' : ' gives away the win.') + ' ' + (best ? 'Better: <strong>' + esc(best.san) + '</strong>.' : '') + '</p>') +
        '<div class="btn-row"><button class="btn primary" data-act="quiz-next">Next</button></div>');
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'new') { board.setArrows([]); start(); }
      if (a === 'hint') hint();
      if (a === 'quiz-next') { st.busy = false; st.quizIndex++; loadQuiz(); }
    });
    view._drill = function () { return { fen: game ? game.fen() : null, done: st && st.done, busy: st && st.busy }; }; // used by the browser smoke test
    start();
    return function () { seq++; clearInterval(timer); };
  }

  CT.Views.endgames = overview;
  CT.Views.endgameDrill = drill;
  CT.Views.endgameConvert = startConvert;
})(typeof window !== 'undefined' ? window : globalThis);
