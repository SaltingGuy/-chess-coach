/* Trap Drills — traps inside YOUR repertoire, trained from both sides, with spaced repetition.
 *
 *   Punish it  You are the trap-setter. The opponent has just made the natural mistake: find the punishment
 *              and play the line out (the opponent's replies come from the verified line).
 *   Avoid it   You are the one being trapped. The position is one move before the mistake: find the safe move.
 *
 * Every drill comes from lines already in the app (opening lines with a marked mistake, and the trap library),
 * whose moves were engine-checked when they were added. Safe moves are taken from the line's own notes and are
 * checked here to be legal. Nothing new is invented.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var INTERVALS = [0, 1, 3, 7, 16, 35].map(function (d) { return d * 86400000; });
  var SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g;

  function san(m) { return Array.isArray(m) ? m[0] : m.san || m; }
  function note(m) { return Array.isArray(m) ? m[1] : m.note || ''; }

  /** Safe alternatives to the mistake, read from the line's own notes and checked for legality. */
  function safeMoves(moves, ply, extraText, explicit) {
    var Chess = CT.Chess, g = new Chess();
    for (var i = 0; i < ply; i++) if (!g.move(san(moves[i]))) return [];
    var legal = g.moves(), strip = function (s) { return s.replace(/[+#]/g, ''); };
    var text = (note(moves[ply]) || '') + ' ' + (extraText || '');
    var m = text.match(/\((?:Correct was|Safe was|Safe instead:)([^)]*)\)|(?:Correct is|should play|Answer[^.]*?with|play)\s+([^.]*)/i);
    var cands = (explicit ? [explicit] : []);
    var chunk = m ? (m[1] || m[2] || '') : '';
    var bySan = chunk.match(SAN_RE) || [];
    // also "(7.Bxc6 was correct.)"
    var m2 = text.match(/\(([^)]*?) was correct\.?\)/i);
    if (m2) bySan = bySan.concat(m2[1].match(SAN_RE) || []);
    cands = cands.concat(bySan);
    var out = [];
    cands.forEach(function (c) {
      var hit = legal.filter(function (l) { return strip(l) === strip(c); })[0];
      if (hit && out.indexOf(hit) < 0 && strip(hit) !== strip(san(moves[ply]))) out.push(hit);
    });
    return out;
  }

  var cache = null;
  function all() {
    if (cache) return cache;
    var D = CT.Data, list = [];
    var reps = {}; (D.repertoires || []).forEach(function (r) { reps[r.id] = r; });
    (D.openingLines || []).forEach(function (l) {
      var mp = l.mistakePly != null ? l.mistakePly : l.safeAlternative ? l.safeAlternative.afterPly : null;
      if (mp == null) return;
      var victim = mp % 2 ? 'b' : 'w', setter = victim === 'w' ? 'b' : 'w';
      var base = { alsoGood: l.alsoGood || [], stockfish: l.stockfish || null, lineId: l.id, name: l.name.replace(/^(Punish it|Trap to avoid|Trap|Tactical idea):\s*/, ''), moves: l.moves, mistakePly: mp, summary: l.summary, repertoire: true, rep: l.repertoire, soundness: l.soundness || 'sound', href: '#/openings/' + l.id + '/learn' };
      if (l.side === setter) list.push(Object.assign({}, base, { id: 'P-' + l.id, mode: 'punish', color: setter }));
      if (l.side === victim) {
        var safe = safeMoves(l.moves, mp, l.summary, l.safeAlternative && l.safeAlternative.move);
        if (safe.length) list.push(Object.assign({}, base, { id: 'A-' + l.id, mode: 'avoid', color: victim, safe: safe }));
      }
    });
    (D.traps || []).forEach(function (t) {
      if (t.mistakePly == null) return;
      var victim = t.mistakePly % 2 ? 'b' : 'w', setter = victim === 'w' ? 'b' : 'w';
      var base = { alsoGood: [], lineId: t.id, name: t.name, moves: t.moves, mistakePly: t.mistakePly, summary: t.summary, repertoire: false, soundness: t.soundness, href: '#/lab/trap/' + t.id };
      list.push(Object.assign({}, base, { id: 'P-' + t.id, mode: 'punish', color: setter }));
      var safe = safeMoves(t.moves, t.mistakePly, t.avoid);
      if (safe.length) list.push(Object.assign({}, base, { id: 'A-' + t.id, mode: 'avoid', color: victim, safe: safe, repertoire: t.side === victim }));
    });
    cache = list;
    return list;
  }

  function recs() { return CT.Store.state.trapDrills || (CT.Store.state.trapDrills = {}); }
  function record(id, pass) {
    var all = recs(), r = all[id] || { attempts: 0, passes: 0, box: 0, due: 0 };
    r.attempts++; r.lastAt = Date.now();
    if (pass) { r.passes++; r.box = Math.min(r.box + 1, INTERVALS.length - 1); } else r.box = 0;
    r.due = Date.now() + (pass ? INTERVALS[r.box] : 10 * 60000);
    all[id] = r;
    CT.Store.bumpDay('trapDrills');
    return r;
  }
  /** Next drill: due reviews first, then new drills from your repertoire, then the rest. */
  function next() {
    var list = all(), r = recs(), now = Date.now();
    var due = list.filter(function (d) { return r[d.id] && r[d.id].due <= now; }).sort(function (a, b) { return r[a.id].box - r[b.id].box; })[0];
    if (due) return { drill: due, href: '#/lab/drill/' + due.id, label: 'Review: ' + (due.mode === 'punish' ? 'punish ' : 'avoid ') + due.name };
    var fresh = list.filter(function (d) { return !r[d.id]; }).sort(function (a, b) { return (b.repertoire ? 1 : 0) - (a.repertoire ? 1 : 0); })[0];
    if (fresh) return { drill: fresh, href: '#/lab/drill/' + fresh.id, label: (fresh.mode === 'punish' ? 'Punish it: ' : 'Avoid it: ') + fresh.name };
    return null;
  }

  /* ---------- view ---------- */
  function listView(view) {
    var UI = CT.UI, esc = UI.esc, r = recs(), list = all();
    var card = function (d) {
      var x = r[d.id];
      return '<a class="card theme-card" href="#/lab/drill/' + d.id + '"><div class="row-between"><h3>' + (d.mode === 'punish' ? '⚔ Punish: ' : '🛡 Avoid: ') + esc(d.name) + '</h3><span class="small muted">' + (x ? x.passes + '/' + x.attempts : 'new') + '</span></div>' +
        '<p class="small muted">You play ' + UI.sideName(d.color) + ' · ' + esc(d.soundness) + (x && x.due <= Date.now() ? ' · <strong>review due</strong>' : '') + '</p></a>';
    };
    var mine = list.filter(function (d) { return d.repertoire; }), other = list.filter(function (d) { return !d.repertoire; });
    view.innerHTML = '<a class="back" href="#/lab">← Deception Lab</a><header class="page-head"><div><h1>Trap Drills</h1><p class="muted">Traps from your own openings, from both sides. <strong>Punish it</strong>: the opponent just fell in — find the knockout. <strong>Avoid it</strong>: you are the target — find the safe move. Missed drills come back sooner.</p></div></header>' +
      '<h2 class="tier-head">In your repertoire</h2><section class="theme-grid">' + mine.map(card).join('') + '</section>' +
      '<h2 class="tier-head">Classic traps</h2><section class="theme-grid">' + other.map(card).join('') + '</section>';
  }

  function drillView(view, id) {
    var UI = CT.UI, esc = UI.esc, Chess = CT.Chess;
    var d = all().filter(function (x) { return x.id === id; })[0];
    if (!d) { view.innerHTML = '<p>Unknown drill. <a href="#/lab/drills">Trap Drills</a></p>'; return; }
    var startPly = d.mode === 'punish' ? d.mistakePly + 1 : d.mistakePly, ply, game, board, st;
    view.innerHTML = '<a class="back" href="#/lab/drills">← Trap Drills</a><div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: d.color,
      canMove: function (color) { return st && !st.done && !st.busy && color === d.color && game.turn() === d.color; },
      onMove: onMove
    });
    CT.Annotate.bind(panel, function () { return board; });

    function load() {
      game = new Chess();
      for (var i = 0; i < startPly; i++) game.move(san(d.moves[i]));
      ply = startPly;
      st = { done: false, busy: false, wrong: 0, recorded: false };
      var last = game.history({ verbose: true }).slice(-1)[0];
      board.setArrows([]);
      board.setGame(game, { lastMove: last ? { from: last.from, to: last.to } : null });
      draw(d.mode === 'punish' ?
        '<p>Your opponent just played <strong>' + esc(san(d.moves[d.mistakePly])) + '</strong>. It looks natural — but it is a mistake. Find the move that punishes it.</p>' :
        '<p>A well-known trap is waiting in this position. Find a <strong>safe</strong> move — the natural one may walk straight into it.</p>');
      CT.Voice.say(d.mode === 'punish' ? 'Your opponent just played ' + san(d.moves[d.mistakePly]) + '. Punish it.' : 'There is a trap here. Find the safe move.');
    }
    function draw(msg) {
      panel.innerHTML = '<p class="small muted">' + (d.mode === 'punish' ? '⚔ Punish it' : '🛡 Avoid it') + ' · you play ' + UI.sideName(d.color) + ' · ' + esc(d.soundness) + '</p><h2>' + esc(d.name) + '</h2>' + msg +
        (st.done ? '<div class="btn-row"><button class="btn primary" data-act="next">Next drill</button><button class="btn" data-act="again">Again</button><a class="btn" href="' + d.href + '">Full lesson</a></div>' : '<div class="btn-row"><button class="btn" data-act="show">Show me</button></div>');
    }
    function finish(pass, html) {
      st.done = true;
      if (!st.recorded) { st.recorded = true; record(id, pass); }
      CT.Sound.play(pass ? 'win' : 'good');
      draw(html + '<p class="small">' + esc(d.summary || '') + '</p>');
    }
    function fail(why) {
      if (!st.recorded) { st.recorded = true; record(id, false); }
      st.wrong++;
      CT.Sound.play('bad');
      draw('<p class="bad">' + why + '</p>');
    }
    function onMove(from, to, promotion) {
      var before = game.fen(), mv = game.move({ from: from, to: to, promotion: promotion || 'q' });
      if (!mv) return false;
      var strip = function (s) { return s.replace(/[+#?!]/g, ''); };
      if (d.mode === 'avoid') {
        var ok = d.safe.some(function (s) { return strip(s) === strip(mv.san); });
        if (ok) { board.setGame(game, { lastMove: { from: mv.from, to: mv.to } }); return finish(!st.wrong, '<p class="good">✓ <strong>' + esc(mv.san) + '</strong> is safe. The trap was <strong>' + esc(san(d.moves[d.mistakePly])) + '?</strong> — ' + esc(note(d.moves[d.mistakePly])) + '</p>'), true; }
        var isTrap = strip(mv.san) === strip(san(d.moves[d.mistakePly]));
        game.undo();
        board.setGame(game, { lastMove: null });
        if (isTrap) {
          var g2 = new Chess(before); g2.move(mv.san); var punish = san(d.moves[d.mistakePly + 1]); var pm = g2.move(punish);
          if (pm) board.setArrows([{ from: pm.from, to: pm.to, color: 'red' }]);
          fail('✗ That is the trap! After ' + esc(mv.san) + ' your opponent plays <strong>' + esc(punish) + '</strong> (red arrow). ' + esc(note(d.moves[d.mistakePly + 1])) + ' Try again.');
        } else {
          fail('That move is not one of the safe moves this drill has verified (' + esc(d.safe.join(', ')) + '). It might be fine, but we only teach moves we have checked. Try again.');
        }
        return true;
      }
      // Punish: follow the verified line; any checkmate also counts.
      var want = san(d.moves[ply]);
      if (ply === d.mistakePly + 1 && strip(mv.san) !== strip(want) && (d.alsoGood || []).some(function (a) { return strip(a) === strip(mv.san); })) {
        board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
        return finish(!st.wrong, '<p class="good">✓ ' + esc(mv.san) + ' also punishes the mistake (Stockfish agrees it wins). The main line is ' + esc(want) + ': ' + esc(note(d.moves[ply])) + '</p>'), true;
      }
      if (strip(mv.san) !== strip(want) && !game.isCheckmate()) {
        game.undo(); board.setGame(game, { lastMove: null });
        fail('✗ ' + esc(mv.san) + ' is not it. ' + (st.wrong >= 1 ? 'Hint: ' + hintFor(want) : 'Look at what the last move left undefended or what it walked into.'));
        return true;
      }
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
      ply++;
      if (game.isCheckmate() || ply >= d.moves.length) return finish(!st.wrong, '<p class="good">✓ ' + (game.isCheckmate() ? 'Checkmate! ' : '') + esc(note(d.moves[ply - 1])) + '</p>'), true;
      st.busy = true;
      draw('<p class="good">✓ ' + esc(note(d.moves[ply - 1])) + '</p>');
      setTimeout(function () {
        var r = game.move(san(d.moves[ply])); ply++;
        st.busy = false;
        board.setGame(game, { lastMove: r ? { from: r.from, to: r.to } : null });
        if (ply >= d.moves.length) return finish(!st.wrong, '<p class="good">✓ ' + esc(note(d.moves[ply - 1])) + '</p>');
        draw('<p>Your opponent replies <strong>' + esc(r ? r.san : '') + '</strong>. ' + esc(note(d.moves[ply - 1])) + ' Keep going.</p>');
      }, 600);
      return true;
    }
    function hintFor(s) {
      var c = s.charAt(0), names = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
      return 'move your ' + (names[c] || 'pawn') + (/x/.test(s) ? ' — and capture something' : '') + (/\+/.test(s) ? ', with check' : '') + '.';
    }
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'again') load();
      if (a === 'next') { var n = next(); location.hash = n ? n.href : '#/lab/drills'; if (n && n.drill.id === id) load(); }
      if (a === 'show' && !st.done) {
        if (!st.recorded) { st.recorded = true; record(id, false); }
        var target = d.mode === 'avoid' ? d.safe[0] : san(d.moves[ply]);
        var g2 = new Chess(game.fen()), m = g2.move(target);
        if (m) board.setArrows([{ from: m.from, to: m.to, color: 'green' }]);
        draw('<p>The answer: <strong>' + esc(target) + '</strong> (green arrow). Play it to continue.</p>');
      }
    });
    load();
  }

  CT.TrapDrills = { all: all, next: next, record: record, safeMoves: safeMoves };
  if (CT.Views) { CT.Views.trapDrills = listView; CT.Views.trapDrill = drillView; }
  else CT.Views = { trapDrills: listView, trapDrill: drillView };
  if (typeof module !== 'undefined' && module.exports) module.exports = CT.TrapDrills;
})(typeof window !== 'undefined' ? window : globalThis);
