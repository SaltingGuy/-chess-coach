/* Opening tools: Explorer (browse your repertoire tree), Sparring (a simulated opponent picks
   different replies each time) and Quiz ("find the move" with spaced repetition). */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  function repById(id) { return CT.Data.repertoires.find(function (r) { return r.id === id; }); }
  function header(view, rep, active) {
    var tabs = [['explore', 'Explore'], ['spar', 'Spar'], ['quiz', 'Quiz']];
    if (!rep) return '<a class="back" href="#/openings">← Opening Academy</a><h1 class="lesson-title">Opening quiz: all repertoires</h1>';
    return '<a class="back" href="#/openings">← Opening Academy</a>' +
      '<div class="row-between wrap"><h1 class="lesson-title">' + esc(rep ? rep.name : 'All openings') + '</h1><div class="seg">' +
      tabs.map(function (t) { return '<a class="' + (t[0] === active ? 'on' : '') + '" href="#/openings/' + t[0] + '/' + (rep ? rep.id : 'all') + '">' + t[1] + '</a>'; }).join('') +
      '</div></div>';
  }
  function lastMoveOf(game) {
    var h = game.history({ verbose: true }), m = h[h.length - 1];
    return m ? { from: m.from, to: m.to } : null;
  }

  /* ---------------- Explorer ---------------- */
  function explorer(view, repId) {
    var rep = repById(repId);
    if (!rep) { view.innerHTML = '<p>Unknown repertoire. <a href="#/openings">Back</a></p>'; return; }
    var Chess = CT.Chess, tree = CT.OpeningTree.build(rep.id, { includeLessons: true });
    var path = [], game = new Chess(), board, note = '';

    view.innerHTML = header(view, rep, 'explore') +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div><div class="nav-row">' +
      '<button class="btn" data-act="start">⏮ Start</button><button class="btn" data-act="back">◀ Back</button><button class="btn" data-act="flip">⇅</button></div></div>' +
      '<aside class="panel"><div class="panel-body"></div><div class="movelist"></div></aside></div>';
    var panel = view.querySelector('.panel-body'), listEl = view.querySelector('.movelist');
    CT.Annotate.bind(panel, function () { return board; });
    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: rep.side,
      canMove: function () { return true; },
      onMove: function (from, to, promotion) {
        var mv = new Chess(game.fen()).move({ from: from, to: to, promotion: promotion });
        if (!mv) return false;
        var kids = CT.OpeningTree.childList(tree, path.join(' '));
        if (!kids.some(function (k) { return k.san === mv.san; })) {
          note = '<p class="bad">' + esc(mv.san) + ' is not in your prepared lines here.</p>';
          render(); return false;
        }
        go(mv.san); return true;
      }
    });

    function go(san) { path.push(san); note = ''; sync(); }
    function sync() {
      game = new Chess();
      path.forEach(function (m) { game.move(m); });
      board.setGame(game, { lastMove: lastMoveOf(game) });
      render();
    }
    function render() {
      var p = path.join(' '), kids = CT.OpeningTree.childList(tree, p);
      var parent = path.slice(0, -1).join(' ');
      var came = path.length ? tree.nodes[parent].children[path[path.length - 1]] : null;
      var yourTurn = game.turn() === rep.side;
      var html = note;
      if (came) {
        var ann = CT.Annotate.annotate(came.comment, game.fen(), { skip: came.san });
        html += '<p class="mvhead"><strong>' + moveLabel(path.length - 1, came.san) + '</strong>' + (came.mistake ? ' <span class="tag bad">opponent mistake</span>' : '') + '</p><p>' + ann.html + '</p>';
        var lm = lastMoveOf(game);
        if (lm) lm.color = (path.length - 1) % 2 === (rep.side === 'w' ? 0 : 1) ? 'green' : 'red';
        CT.Annotate.showOnBoard(board, ann, lm);
      } else html += '<p>' + esc(rep.description) + '</p><p class="small muted">Click a move below (or play it on the board) to walk through your repertoire tree.</p>';
      if (kids.length) {
        html += '<h3 class="mt">' + (yourTurn ? 'Your move' + (kids.length > 1 ? 's' : '') : 'Opponent replies you have prepared for') + '</h3><ul class="kids">' +
          kids.map(function (k) {
            var names = k.lines.map(function (id) { return CT.OpeningTree.lineById(id); });
            return '<li><button class="btn small kid" data-san="' + esc(k.san) + '">' + esc(k.san) + '</button>' + (k.mistake ? ' <span class="tag bad">mistake</span>' : '') +
              '<span class="small muted">' + esc(names.map(function (n) { return n.name; }).slice(0, 2).join(' · ')) + (names.length > 2 ? ' +' + (names.length - 2) : '') + '</span></li>';
          }).join('') + '</ul>';
      } else if (path.length) {
        var ended = came.lines.map(function (id) { return CT.OpeningTree.lineById(id); });
        html += '<div class="explain"><h3>End of prepared line</h3><p>' + esc(ended[0].summary) + '</p><div class="btn-row">' +
          (ended[0].lessonOnly ? '' : '<a class="btn small" href="#/openings/' + ended[0].id + '/drill">Drill this line</a>') +
          '<a class="btn small" href="#/openings/' + ended[0].id + '/learn">Lesson</a></div></div>';
      }
      panel.innerHTML = html;
      listEl.innerHTML = UI.moveListHtml(path, 'w', path.length - 1);
    }
    function moveLabel(i, san) { var n = Math.floor(i / 2) + 1; return (i % 2 === 0 ? n + '. ' : n + '… ') + san; }

    view.addEventListener('click', function (e) {
      var k = e.target.closest('.kid');
      if (k) { go(k.dataset.san); return; }
      var b = e.target.closest('[data-act]');
      if (b) {
        if (b.dataset.act === 'start') { path = []; note = ''; sync(); }
        if (b.dataset.act === 'back') { path.pop(); note = ''; sync(); }
        if (b.dataset.act === 'flip') board.flip();
      }
    });
    listEl.addEventListener('click', function (e) {
      var m = e.target.closest('.mv');
      if (m) { path = path.slice(0, +m.dataset.i + 1); note = ''; sync(); }
    });
    sync();
  }

  /* ---------------- Sparring ---------------- */
  function sparring(view, repId) {
    var rep = repById(repId);
    if (!rep) { view.innerHTML = '<p>Unknown repertoire. <a href="#/openings">Back</a></p>'; return; }
    var Chess = CT.Chess, Store = CT.Store, tree = CT.OpeningTree.build(rep.id);
    var game, path, errors, errorPlies, board, done, timer, wrongHere, rounds = 0, cleanRounds = 0;

    view.innerHTML = header(view, rep, 'spar') +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div><div class="nav-row">' +
      '<button class="btn" data-act="restart">New game</button><button class="btn" data-act="flip">⇅</button></div></div>' +
      '<aside class="panel"><div class="panel-body"></div><div class="movelist"></div></aside></div>';
    var panel = view.querySelector('.panel-body'), listEl = view.querySelector('.movelist');
    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: rep.side,
      canMove: function (color) { return !done && color === rep.side && game.turn() === rep.side; },
      onMove: onUserMove
    });

    function start() {
      game = new Chess(); path = []; errors = 0; errorPlies = []; done = false; wrongHere = 0;
      board.setGame(game, { lastMove: null });
      render('<p>The simulated opponent picks a different prepared reply each game — sometimes the main line, sometimes a common mistake you should punish. Play your repertoire moves.</p>');
      step();
    }

    // Opponent choice: favour lines you have practised least; mistakes appear sometimes.
    function pickOpponent(kids) {
      var weights = kids.map(function (k) {
        var drills = k.lines.reduce(function (s, id) { var r = Store.state.openings[id]; return s + (r ? r.drills : 0); }, 0) / k.lines.length;
        return (k.mistake ? 0.6 : 1) / (1 + drills);
      });
      var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total;
      for (var i = 0; i < kids.length; i++) { r -= weights[i]; if (r <= 0) return kids[i]; }
      return kids[kids.length - 1];
    }

    function step() {
      clearTimeout(timer);
      var kids = CT.OpeningTree.childList(tree, path.join(' '));
      if (!kids.length) return finish();
      if (game.turn() !== rep.side) {
        timer = setTimeout(function () {
          var k = pickOpponent(kids);
          var m = game.move(k.san);
          path.push(k.san);
          board.setGame(game, { lastMove: { from: m.from, to: m.to } });
          var next = CT.OpeningTree.childList(tree, path.join(' '));
          if (!next.length) return finish();
          render(k.mistake ? '<p class="prompt">Your opponent played ' + esc(k.san) + '. Is something wrong with that move? Punish it!</p>' : '<p class="prompt">Your move.</p>');
        }, 500);
      } else render('<p class="prompt">Your move.</p>');
    }

    function onUserMove(from, to, promotion) {
      var kids = CT.OpeningTree.childList(tree, path.join(' '));
      var expected = kids[0];
      var mv = new Chess(game.fen()).move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      if (mv.san === expected.san) {
        game.move(mv.san); path.push(mv.san); wrongHere = 0;
        board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
        CT.Sound.play('good');
        render('<p class="good">✓ ' + esc(mv.san) + '</p><p class="small">' + CT.Annotate.annotate(expected.comment, game.fen(), { skip: mv.san }).html + '</p>');
        step();
        return true;
      }
      CT.Sound.play('bad');
      wrongHere++;
      if (errorPlies.indexOf(path.length) < 0) { errors++; errorPlies.push(path.length); }
      var exp = new Chess(game.fen()).move(expected.san);
      if (wrongHere >= 2 && exp) board.setArrows([{ from: exp.from, to: exp.to, color: 'green' }]);
      render('<p class="bad">✗ ' + esc(mv.san) + ' is not your repertoire move.' + (wrongHere >= 2 ? ' The green arrow shows it.' : ' Try again.') + '</p>');
      return false;
    }

    function finish() {
      if (done) return;
      done = true; rounds++; if (!errors) cleanRounds++;
      CT.Sound.play(errors ? 'bad' : 'win');
      // Credit the line this game ended in, so spaced repetition knows you practised it.
      var parent = path.slice(0, -1).join(' '), last = tree.nodes[parent] && tree.nodes[parent].children[path[path.length - 1]];
      var line = last ? CT.OpeningTree.lineById(last.lines[0]) : null;
      if (line) Store.recordDrill(line, errorPlies);
      render('<div class="explain"><h3>' + (errors ? 'Game over — ' + errors + ' slip' + (errors > 1 ? 's' : '') : '✓ Perfect!') + '</h3>' +
        (line ? '<p>You reached the end of <strong>' + esc(line.name) + '</strong>.</p><p class="small">' + esc(line.summary) + '</p>' : '') +
        '<p class="small muted">This session: ' + cleanRounds + '/' + rounds + ' perfect games.</p></div>' +
        '<div class="btn-row"><button class="btn primary" data-act="restart">Next game</button>' + (line ? '<a class="btn" href="#/openings/' + line.id + '/learn">Review the lesson</a>' : '') + '</div>');
    }

    CT.Annotate.bind(panel, function () { return board; });
    function render(msg) {
      panel.innerHTML = '<p class="small muted">You play ' + UI.sideName(rep.side) + '. Mistakes so far: ' + errors + '</p>' + (msg || '');
      listEl.innerHTML = UI.moveListHtml(path, 'w', path.length - 1);
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'restart') start();
      if (b.dataset.act === 'flip') board.flip();
    });
    start();
    return function () { clearTimeout(timer); };
  }

  /* ---------------- Quiz ---------------- */
  function quiz(view, repId) {
    var rep = repId && repId !== 'all' ? repById(repId) : null;
    var Chess = CT.Chess, Store = CT.Store, Coach = CT.Coach;
    var all = CT.OpeningTree.quizItems().filter(function (q) { return !rep || CT.OpeningTree.lineById(q.lineId).repertoire === rep.id; });
    var item, game, board, answered, count = 0, right = 0, recent = [], includeNew = false;

    view.innerHTML = header(view, rep, 'quiz') +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    CT.Annotate.bind(panel, function () { return board; });
    board = new CT.Board(view.querySelector('.board-host'), {
      canMove: function (color) { return item && !answered && color === game.turn(); },
      onMove: onUserMove
    });

    function learned(q) { return Coach.openingStatus(CT.OpeningTree.lineById(q.lineId)).key !== 'new'; }

    function pick() {
      var now = Date.now(), recs = Store.state.quiz;
      var pool = all.filter(function (q) { return (includeNew || learned(q)) && recent.indexOf(q.key) < 0; });
      if (!pool.length) return null;
      var due = pool.filter(function (q) { return recs[q.key] && recs[q.key].due <= now; });
      if (due.length) return due[Math.floor(Math.random() * due.length)];
      var fresh = pool.filter(function (q) { return !recs[q.key]; });
      if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
      return null;
    }

    function next() {
      item = pick();
      answered = false;
      if (!item) {
        board.setGame(new Chess(), { lastMove: null });
        var learnedCount = all.filter(learned).length;
        panel.innerHTML = '<h2>' + (count ? 'Quiz complete' : 'Nothing to quiz yet') + '</h2>' +
          (count ? '<p>You answered <strong>' + right + '/' + count + '</strong> correctly. Missed questions come back soon; correct ones come back days later.</p>' : '') +
          (learnedCount ? '<p class="small muted">No more questions are due from the lines you have learned.</p>' : '<p>Quizzes use positions from lines you have studied. Learn a line first — or test yourself on everything.</p>') +
          '<div class="btn-row">' + (includeNew ? '' : '<button class="btn" data-act="all">Quiz me on all lines</button>') + '<a class="btn" href="#/openings">Opening Academy</a></div>';
        return;
      }
      var line = CT.OpeningTree.lineById(item.lineId);
      game = new Chess();
      line.moves.slice(0, item.ply).forEach(function (m) { game.move(m[0]); });
      board.setOrientation(line.side);
      board.setGame(game, { lastMove: lastMoveOf(game) });
      var last = line.moves[item.ply - 1];
      panel.innerHTML = '<p class="small muted">' + esc(line.name) + '</p>' +
        '<p class="tomove ' + line.side + '"><span class="swatch"></span>' + UI.sideName(line.side) + ' to move</p>' +
        (item.punish ? '<p class="prompt">Your opponent just played ' + esc(last[0]) + '. Find the punishment!</p>' : '<p class="prompt">What is your repertoire move here — and why?</p>') +
        '<p class="small">Opponent\'s last move: <strong>' + esc(last[0]) + '</strong></p>' +
        '<div class="btn-row"><button class="btn" data-act="reveal">I don\'t know — show me</button></div>' +
        '<p class="small muted">Question ' + (count + 1) + (right ? ' · ' + right + ' right so far' : '') + '</p>';
    }

    function answer(ok, playedSan) {
      answered = true; count++; if (ok) right++;
      CT.Sound.play(ok ? 'good' : 'bad');
      recent.push(item.key); if (recent.length > 6) recent.shift();
      Store.recordQuiz(item, ok);
      var exp = new Chess(game.fen()).move(item.move);
      if (!ok && exp) board.setArrows([{ from: exp.from, to: exp.to, color: 'green' }]);
      panel.innerHTML = (ok ? '<p class="good big">✓ ' + esc(item.move) + ' — correct!</p>' : '<p class="bad">' + (playedSan ? '✗ ' + esc(playedSan) + ' is not the move.' : 'The answer:') + ' Your repertoire plays <strong>' + esc(item.move) + '</strong>.</p>') +
        '<div class="explain"><p>' + CT.Annotate.annotate(item.comment, game.fen(), { skip: item.move }).html + '</p></div>' +
        '<div class="btn-row"><button class="btn primary" data-act="next">Next question</button><a class="btn" href="#/openings/' + item.lineId + '/learn">Open the lesson</a></div>';
    }

    function onUserMove(from, to, promotion) {
      var mv = new Chess(game.fen()).move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      var ok = mv.san === item.move;
      if (ok) { game.move(mv.san); board.setGame(game, { lastMove: { from: mv.from, to: mv.to } }); }
      answer(ok, mv.san);
      return ok;
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'next') next();
      if (b.dataset.act === 'reveal' && !answered) answer(false, null);
      if (b.dataset.act === 'all') { includeNew = true; next(); }
    });
    next();
  }

  CT.Views = CT.Views || {};
  CT.Views.openingExplorer = explorer;
  CT.Views.openingSpar = sparring;
  CT.Views.openingQuiz = quiz;
})(window);
