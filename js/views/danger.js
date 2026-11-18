/*
 * Back-rank danger (#/tactics/danger): the defending side of back-rank mates.
 * Each position comes from a real game (Lichess puzzle pack), one move before a back-rank mate.
 *   1. Two candidate moves are shown: the move actually played (it loses to a back-rank mate) and a safe one
 *      (checked when the data was built — see scripts/build-backrank-danger.js). Which is safe?
 *   2. Prove it: play your opponent's punishing move after the blunder, then watch the mate.
 * Missed positions come back after 10 minutes; solved ones after 1, 3, 7… days.
 */
(function (root) {
  'use strict';
  var CT = root.CT, D = CT.Data;
  if (!D || !D.backrankDanger || !CT.Pack) return;
  function strip(s) { return String(s).replace(/[+#?!]/g, ''); }

  var items = D.backrankDanger.split('\n').map(function (row) {
    var f = row.split('|');
    return { id: 'BR' + f[0], puzzleId: 'L' + f[0], safe: f[1], luft: f[2] === '1', why: f[3], safeWhy: f[4] };
  }).filter(function (x) { return CT.Pack.get(x.puzzleId); });
  items.sort(function (a, b) { return CT.Pack.get(a.puzzleId).rating - CT.Pack.get(b.puzzleId).rating; });

  function progress() {
    var recs = CT.Store.state.danger || {};
    return { ok: items.filter(function (x) { return recs[x.id] && recs[x.id].ok; }).length, seen: items.filter(function (x) { return recs[x.id]; }).length };
  }
  /** Due misses first, then new positions (easiest first), then due reviews. */
  function next(excludeId) {
    var recs = CT.Store.state.danger || {}, now = Date.now();
    var pool = items.filter(function (x) { return x.id !== excludeId; });
    var missed = pool.filter(function (x) { var r = recs[x.id]; return r && r.box === 0 && r.due <= now; });
    if (missed.length) return { item: missed[0], reason: 'Review: you missed this one before.' };
    var fresh = pool.filter(function (x) { return !recs[x.id]; });
    if (fresh.length) return { item: fresh[0], reason: 'New position.' };
    var due = pool.filter(function (x) { var r = recs[x.id]; return r && r.due <= now; }).sort(function (a, b) { return recs[a.id].due - recs[b.id].due; });
    if (due.length) return { item: due[0], reason: 'Spaced review — keeping it fresh.' };
    return null;
  }

  function view(viewEl) {
    var UI = CT.UI, esc = UI.esc, Chess = CT.Chess, Store = CT.Store, Engine = CT.Engine;
    var item, p, game, board, stage, you, them, cands, picked, lastId = null, reason = '', session = { n: 0, ok: 0 };

    viewEl.innerHTML = '<a class="back" href="#/tactics">← Tactical Academy</a><h1 class="lesson-title">🛡 Back-rank danger</h1>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = viewEl.querySelector('.panel-body');
    board = new CT.Board(viewEl.querySelector('.board-host'), {
      canMove: function (color) { return stage === 'prove' && color === them; },
      onMove: onMove
    });
    CT.Annotate.bind(panel, function () { return board; });

    function load() {
      var n = next(lastId);
      if (!n) return caughtUp();
      item = n.item; reason = n.reason;
      p = CT.Pack.materialize(CT.Pack.get(item.puzzleId));
      game = new Chess(p.rawFen);
      you = game.turn(); them = you === 'w' ? 'b' : 'w';
      var blunder = new Chess(p.rawFen).move(p.pre.san), safe = new Chess(p.rawFen).move(item.safe);
      cands = [{ san: blunder.san, from: blunder.from, to: blunder.to, safe: false }, { san: safe.san, from: safe.from, to: safe.to, safe: true }];
      if (Math.random() < 0.5) cands.reverse();
      cands[0].color = 'yellow'; cands[0].label = 'A'; cands[1].color = 'blue'; cands[1].label = 'B';
      stage = 'choose'; picked = null;
      board.setOrientation(you);
      board.setGame(game, { lastMove: null, sound: false });
      board.setArrows(cands.map(function (c) { return { from: c.from, to: c.to, color: c.color }; }));
      var pr = progress();
      panel.innerHTML = '<p class="small muted">' + esc(reason) + ' · ' + pr.ok + '/' + items.length + ' done</p>' +
        '<h2>Is your back rank safe?</h2>' +
        '<p class="tomove ' + you + '"><span class="swatch"></span><span>You are ' + UI.sideName(you) + '. You are thinking about two moves. <strong>One of them loses to a back-rank mate.</strong> Blunder-check both: which one is safe?</span></p>' +
        '<div class="btn-row">' + cands.map(function (c, i) { return '<button class="btn" data-act="pick" data-i="' + i + '">' + c.label + ' · ' + esc(c.san) + ' <span class="small muted">(' + c.color + ' arrow)</span></button>'; }).join('') + '</div>' +
        '<p class="small muted">Ask: after this move, can your opponent check on your back rank? Does your king have an escape square? Who still guards the back rank?</p>';
      CT.Voice.say('You are ' + UI.sideName(you) + '. One of these moves loses to a back-rank mate: ' + cands[0].san + ', or ' + cands[1].san + '. Which one is safe?');
    }

    function caughtUp() {
      stage = 'idle';
      board.setGame(new Chess(), { lastMove: null, sound: false }); board.setArrows([]);
      panel.innerHTML = '<h2>All caught up</h2><p>No positions are due right now. Missed ones come back after a short break, solved ones days later.</p>' +
        (session.n ? '<p>This session: <strong>' + session.ok + '/' + session.n + '</strong> right.</p>' : '') +
        '<div class="btn-row"><a class="btn" href="#/tactics/theme/back-rank">Back-rank mates</a><a class="btn" href="#/tactics">Tactical Academy</a></div>';
    }

    function pick(i) {
      if (stage !== 'choose') return;
      picked = cands[i];
      var ok = picked.safe, bad = cands.find(function (c) { return !c.safe; }), good = cands.find(function (c) { return c.safe; });
      Store.recordDanger(item.id, ok);
      session.n++; if (ok) session.ok++;
      CT.Sound.play(ok ? 'good' : 'bad');
      // Show the position after the blunder: now YOU play the opponent's punishment.
      stage = 'prove';
      game = new Chess(p.fen);
      board.setGame(game, { lastMove: { from: p.pre.from, to: p.pre.to }, sound: false });
      board.setArrows([{ from: p.pre.from, to: p.pre.to, color: 'red' }]);
      panel.innerHTML = (ok ? '<p class="good big">✓ Right — ' + esc(good.san) + ' is the safe one.</p>' : '<p class="bad">✗ ' + esc(picked.san) + ' is the move that loses.</p>') +
        '<p>' + (ok ? 'In the real game, ' : 'In the real game, too, ') + esc(UI.sideName(you)) + ' played <strong>' + esc(bad.san) + '</strong> (red arrow).</p>' +
        '<p class="prompt">Now prove it: you play ' + esc(UI.sideName(them)) + '. Find the move that punishes ' + esc(bad.san) + '.</p>' +
        '<div class="btn-row"><button class="btn" data-act="showme">Show me</button></div>';
      CT.Voice.say((ok ? 'Right. ' + good.san + ' is safe. ' : 'No. ' + picked.san + ' loses. ') + 'Now play your opponent\'s side: punish ' + bad.san + '.');
    }

    function onMove(from, to, promotion) {
      if (stage !== 'prove') return false;
      var before = new Chess(game.fen());
      var mv = game.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      var right = strip(mv.san) === strip(p.line[0]) || game.isCheckmate() || (p.mateIn <= 3 && Engine.sanForcesMate(before, mv.san, p.mateIn));
      if (!right) {
        game.undo();
        CT.Sound.play('bad');
        board.setGame(game, { lastMove: { from: p.pre.from, to: p.pre.to }, sound: false });
        panel.querySelector('.prompt').insertAdjacentHTML('afterend', '<p class="bad small">' + esc(mv.san) + ' is not it. Look for a check on the back rank — or a move that removes its last guard.</p>');
        return true;
      }
      finishLine(mv, strip(mv.san) === strip(p.line[0]));
      return true;
    }

    // Play the rest of the mating line (if the learner found a different mating move, the engine defends stubbornly).
    function finishLine(first, onLine) {
      stage = 'anim';
      board.setGame(game, { lastMove: { from: first.from, to: first.to } });
      board.setArrows([{ from: first.from, to: first.to, color: 'green' }]);
      CT.Sound.play('good');
      var i = 1;
      (function step() {
        if (game.isCheckmate() || (onLine && i >= p.line.length)) return done(true);
        var san = onLine ? p.line[i] : (game.turn() === you ? Engine.stubbornDefence(game, p.mateIn) : (Engine.matingMoves(game, p.mateIn)[0] || null));
        if (!san) return done(true);
        var m = game.move(san); i++;
        if (!m) return done(true);
        setTimeout(function () {
          board.setGame(game, { lastMove: { from: m.from, to: m.to } });
          board.setArrows([{ from: m.from, to: m.to, color: m.color === them ? 'green' : 'red' }]);
          setTimeout(step, 750);
        }, 150);
      })();
    }

    function showMe() {
      var m = game.move(p.line[0]);
      if (m) finishLine(m, true);
    }

    function done() {
      stage = 'done';
      panel.innerHTML = '<p class="good">' + (game.isCheckmate() ? '♚ Checkmate on the back rank.' : 'That is the punishment.') + '</p>' +
        '<div class="explain"><h3>Why the game move lost</h3><p>' + CT.Annotate.annotate(item.why, p.rawFen).html + '</p>' +
        '<h3>The safe move</h3><p>' + CT.Annotate.annotate(item.safeWhy, p.rawFen).html + '</p>' +
        (item.luft ? '' : '<p class="small muted">Making an escape square (moving the pawn in front of your king one step) is often the simplest cure — before the danger arrives.</p>') +
        '<p class="small muted">From a real game (Lichess puzzle ' + esc(p.lichessId) + '). The mate after the blunder is from Lichess\'s own engine check; the safe move was checked by the app\'s engines when this drill was built.</p></div>' +
        '<div class="btn-row"><button class="btn primary" data-act="next">Next position</button><button class="btn" data-act="safe">Show the safe move</button></div>' +
        '<p class="small muted">Session: ' + session.ok + '/' + session.n + ' right</p>';
      CT.Voice.say(CT.Voice.brief(item.why, 1) + ' ' + CT.Voice.brief(item.safeWhy, 1));
    }

    function showSafe() {
      var g = new Chess(p.rawFen), m = g.move(item.safe);
      board.setGame(g, { lastMove: m ? { from: m.from, to: m.to } : null, sound: false });
      if (m) board.setArrows([{ from: m.from, to: m.to, color: 'blue' }]);
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'pick') pick(+b.dataset.i);
      if (a === 'showme' && stage === 'prove') showMe();
      if (a === 'next') { lastId = item.id; load(); }
      if (a === 'safe') showSafe();
    });
    load();
  }

  CT.Danger = { items: items, count: items.length, progress: progress, next: next };
  CT.Views = CT.Views || {};
  CT.Views.danger = view;
})(typeof window !== 'undefined' ? window : globalThis);
