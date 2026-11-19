/* Deception Lab: trap library (searchable), hidden-threat exercises, and links to sacrifice/deception themes. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  var SOUND = { sound: ['Sound', 'Costs you nothing if the opponent sees it.'], conditional: ['Conditional', 'Works only after an opponent error; your own moves are fine.'], unsound: ['Unsound', 'The trap move itself is objectively bad — learn it to avoid it.'] };

  /** Before you attack: the five questions strong attackers ask (after Prusikin's attacking prerequisites). */
  function attackChecklist() {
    var Q = [
      ['Development', 'Are more of your pieces out and pointing at the king than your opponent has defending it?'],
      ['The centre', 'Is the centre closed or stable? If your opponent can break open the centre, they counter-attack faster than you attack.'],
      ['Numbers', 'Count attackers vs defenders near the king. You usually need at least one more attacker.'],
      ['A target', 'Is there something to hit — an advanced pawn (a "hook"), an open file, a weak square like f7/h7, a king that cannot castle?'],
      ['Your own king', 'Is your king safe, and is nothing of yours hanging? An attack with a loose piece behind it is a gamble.']
    ];
    return '<section class="card"><h2>⚔ Attack checklist</h2><p class="small muted">Ask these before you sacrifice or throw pawns forward. Four or five "yes" answers: attack. Two or fewer: improve your worst piece first — the quiet move is stronger.</p>' +
      '<ol class="checklist">' + Q.map(function (q) { return '<li><strong>' + q[0] + '.</strong> ' + q[1] + '</li>'; }).join('') + '</ol></section>';
  }

  function allTraps() {
    var D = CT.Data;
    var lib = D.traps.map(function (t) { return { id: t.id, name: t.name, opening: t.opening, soundness: t.soundness, tags: t.tags, summary: t.summary, side: t.side, href: '#/lab/trap/' + t.id }; });
    var linked = D.linkedTraps.map(function (l) {
      var line = CT.Coach.lineById(l.id), rep = D.repertoires.find(function (r) { return r.id === line.repertoire; });
      return { id: l.id, name: line.name, opening: rep ? rep.name + ' (your repertoire)' : '', soundness: line.soundness || (line.kind === 'punish' ? 'punish' : 'conditional'), tags: l.tags, summary: line.summary, side: line.side, href: '#/openings/' + l.id + '/learn' };
    });
    return lib.concat(linked);
  }

  function hub(view) {
    var D = CT.Data, Store = CT.Store;
    var traps = allTraps();
    var seenThreats = Object.keys(Store.state.lab || {}).length;
    var sacThemes = ['decoy', 'remove-defender', 'smothered', 'zwischenzug', 'quiet-move', 'windmill', 'discovered', 'overload'];
    view.innerHTML = '<header class="page-head"><div><h1>Deception Lab</h1><p class="muted">Learn to set traps that are actually sound — and never fall into them yourself. Every trap is labelled honestly and checked by the engine.</p></div>' +
      '<a class="btn primary big" href="#/lab/threats">Hidden-threat drill</a></header>' +
      '<section class="grid-2">' +
        '<a class="card lab-tile" href="#/lab/drills"><span class="lab-ico">⚑</span><h3>Trap Drills</h3><p class="small muted">Traps from your own openings, from both sides: punish the mistake, or dodge the trap. Spaced repetition brings back the ones you miss.</p></a>' +
        '<a class="card lab-tile" href="#/lab/threats"><span class="lab-ico">👁</span><h3>Hidden threats</h3><p class="small muted">Your opponent just moved. What do they threaten — and how do you defend? ' + seenThreats + '/' + D.threats.length + ' done.</p></a>' +
        (CT.Danger ? '<a class="card lab-tile" href="#/tactics/danger"><span class="lab-ico">🛡</span><h3>Back-rank danger</h3><p class="small muted">Two candidate moves, one loses to a back-rank mate. Learn to spot your own weak back rank in time. ' + CT.Danger.progress().ok + '/' + CT.Danger.count + ' done.</p></a>' : '') +
        '<a class="card lab-tile" href="#trap-library"><span class="lab-ico">🪤</span><h3>Trap library</h3><p class="small muted">' + traps.length + ' traps: famous classics and the ones from your own repertoire.</p></a>' +
        '<a class="card lab-tile" href="#/tactics/theme/decoy"><span class="lab-ico">♛</span><h3>Sacrifices & decoys</h3><p class="small muted">Give material to drag a piece onto a fatal square.</p></a>' +
      '</section>' +
      attackChecklist() +
      payoffHtml() +
      '<section class="card" id="trap-library"><div class="row-between wrap"><h2>Trap library</h2><input type="search" class="trap-search" placeholder="Search: mate, Caro, queen, pin…" aria-label="Search traps"></div>' +
      '<div class="chips">' + ['all', 'sound', 'conditional', 'unsound', 'punish'].map(function (f, i) { return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-filter="' + f + '">' + (f === 'all' ? 'All' : f === 'punish' ? 'Punish a mistake' : SOUND[f][0]) + '</button>'; }).join('') + '</div>' +
      '<p class="small muted legend"><strong>Sound</strong> — costs you nothing if refused · <strong>Conditional</strong> — only works after an opponent error · <strong>Unsound</strong> — know it so you don\'t fall for it (or play it)</p>' +
      '<ul class="trap-list"></ul></section>' +
      '<section class="grid-2"><div class="card"><h2>Sacrifice & deception themes</h2><ul class="plist">' + sacThemes.map(function (k) { return D.themes[k] ? '<li><a href="#/tactics/theme/' + k + '">' + esc(D.themes[k].name) + '</a> <span class="small muted">' + D.puzzles.filter(function (p) { return p.theme === k; }).length + ' puzzles</span></li>' : ''; }).join('') + '</ul></div>' +
      '<div class="card"><h2>Coming next: deep sacrifice puzzles</h2><p class="small muted">These ideas need deep, exact calculation. Rather than risk teaching a sacrifice that does not really work, they will be added once the full engine can verify every line.</p><ul>' + D.needsStockfish.map(function (n) { return '<li><strong>' + esc(n.name) + '</strong> — <span class="small">' + esc(n.why) + '</span></li>'; }).join('') + '</ul></div></section>';

    var listEl = view.querySelector('.trap-list'), search = view.querySelector('.trap-search'), filter = 'all';
    function draw() {
      var q = search.value.trim().toLowerCase();
      var items = traps.filter(function (t) {
        if (filter !== 'all' && t.soundness !== filter) return false;
        if (!q) return true;
        return (t.name + ' ' + t.opening + ' ' + t.tags.join(' ') + ' ' + t.summary).toLowerCase().indexOf(q) >= 0;
      });
      listEl.innerHTML = items.length ? items.map(function (t) {
        var studied = Store.state.openings[t.id] && Store.state.openings[t.id].learned;
        return '<li><div><a href="' + t.href + '"><strong>' + esc(t.name) + '</strong></a> <span class="tag sound-' + t.soundness + '">' + (SOUND[t.soundness] ? SOUND[t.soundness][0] : 'Punish') + '</span>' + (studied ? ' <span class="tag ok">studied</span>' : '') +
          '<p class="small muted">' + esc(t.opening) + ' · ' + esc(t.tags.join(', ')) + '</p><p class="small">' + esc(t.summary) + '</p></div>' +
          '<a class="btn small" href="' + t.href + '">Open</a></li>';
      }).join('') : '<li class="muted">No traps match.</li>';
    }
    search.addEventListener('input', draw);
    view.querySelector('.chips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      filter = b.dataset.filter;
      view.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
      draw();
    });
    view.querySelector('a[href="#trap-library"]').addEventListener('click', function (e) { e.preventDefault(); view.querySelector('#trap-library').scrollIntoView({ behavior: 'smooth' }); });
    draw();
  }

  /* ---------------- Hidden-threat exercises ---------------- */
  function threats(view) {
    var Chess = CT.Chess, Engine = CT.Engine, Store = CT.Store, D = CT.Data;
    var idx = 0, ex, game, board, stage, found, defended, best = null;
    var order = D.threats.slice().sort(function (a, b) { return (Store.state.lab[a.id] ? 1 : 0) - (Store.state.lab[b.id] ? 1 : 0); });

    view.innerHTML = '<a class="back" href="#/lab">← Deception Lab</a><h1 class="lesson-title">Hidden threats</h1>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div><aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), {
      canMove: function () { return stage === 'find' || stage === 'defend'; },
      onMove: onMove
    });
    CT.Annotate.bind(panel, function () { return board; });

    function position() {
      if (ex.fen) return { g: new Chess(ex.fen), last: null };
      var g = new Chess(), last = null;
      ex.moves.split(' ').forEach(function (m) { last = g.move(m); });
      return { g: g, last: last };
    }

    function load() {
      ex = order[idx % order.length];
      var pos = position();
      game = pos.g; found = false; defended = false; best = null;
      stage = 'find';
      var you = game.turn();
      board.setOrientation(you);
      // Step 1: you move the OPPONENT's pieces to show their threat.
      var flipped = CT.Annotate.flipTurn(game.fen());
      board.setGame(flipped, { lastMove: pos.last ? { from: pos.last.from, to: pos.last.to } : null, sound: false });
      if (pos.last) board.setArrows([{ from: pos.last.from, to: pos.last.to, color: 'red' }]);
      panel.innerHTML = '<p class="small muted">Exercise ' + ((idx % order.length) + 1) + ' of ' + order.length + '</p><h2>' + esc(ex.title) + '</h2>' +
        '<p>You are ' + UI.sideName(you) + '. ' + (pos.last ? 'Your opponent just played <strong>' + esc(pos.last.san) + '</strong> (red arrow).' : 'Look at the position.') + '</p>' +
        '<p class="prompt">Step 1: What does your opponent threaten? Play THEIR threatening move on the board.</p>' +
        '<div class="btn-row"><button class="btn" data-act="givethreat">Show me the threat</button></div>';
      CT.Voice.say('You are ' + UI.sideName(you) + '. ' + (pos.last ? 'Your opponent just played ' + pos.last.san + '. ' : '') + 'What does your opponent threaten? Play their threatening move on the board.');
      // Start the engine work for step 2 in the background.
      setTimeout(function () { if (!best) best = Engine.analyseAll(new Chess(game.fen()), 2, 1.5e6).moves; }, 50);
    }

    function revealThreat(ok, played) {
      found = ok;
      stage = 'shown';
      var f = CT.Annotate.flipTurn(game.fen()), tm = f.move(ex.threats[0]);
      board.setGame(CT.Annotate.flipTurn(game.fen()), { lastMove: null, sound: false });
      if (tm) board.setArrows([{ from: tm.from, to: tm.to, color: 'red' }]);
      CT.Sound.play(ok ? 'good' : 'bad');
      panel.innerHTML = '<h2>' + esc(ex.title) + '</h2>' + (ok ? '<p class="good">✓ Yes — the threat is ' + esc(ex.threats[0]) + '.</p>' : '<p class="bad">' + (played ? esc(played) + ' is not the main threat. ' : '') + 'The threat is <strong>' + esc(ex.threats[0]) + '</strong> (red arrow).</p>') +
        '<p>' + CT.Annotate.annotate(ex.explain, f.fen()).html + '</p>' +
        '<div class="btn-row"><button class="btn primary" data-act="defend">Step 2: defend</button></div>';
      CT.Voice.say((ok ? 'Yes, the threat is ' : (played ? played + ' is not the main threat. ' : '') + 'The threat is ') + ex.threats[0] + '. ' + CT.Voice.brief(ex.explain, 2));
    }

    function startDefend() {
      stage = 'defend';
      board.setGame(game, { lastMove: null, sound: false });
      board.setArrows([]);
      panel.innerHTML = '<h2>' + esc(ex.title) + '</h2><p class="prompt">Step 2: Find a move that defends against ' + esc(ex.threats[0]) + '. Several moves may work — the engine checks yours.</p>';
      CT.Voice.say('Now find a move that defends against ' + ex.threats[0] + '.');
    }

    function judgeDefence(mv) {
      if (!best) best = Engine.analyseAll(new Chess(game.fen()), 2, 1.5e6).moves;
      var strip = function (s) { return s.replace(/[+#]/g, ''); };
      var mine = best.find(function (m) { return strip(m.san) === strip(mv.san); });
      var bad = ex.badDefences && ex.badDefences[mv.san];
      var ok = !bad && mine && best[0].score - mine.score <= 80;
      defended = ok;
      stage = 'done';
      Store.recordLab(ex.id, found, defended);
      CT.Sound.play(ok ? 'win' : 'bad');
      var top = best.slice(0, 3).map(function (m) { return m.san; });
      var msg = ok ? '<p class="good big">✓ ' + esc(mv.san) + ' defends.</p>' :
        '<p class="bad">✗ ' + esc(mv.san) + ' does not stop the threat.</p>' + (bad ? '<p>' + CT.Annotate.annotate(bad, game.fen()).html + '</p>' : '');
      var g2 = new Chess(game.fen());
      if (!ok && !bad) {
        g2.move(mv.san);
        var reply = Engine.bestMove(g2, 2, 2e5);
        if (reply) { var rm = new Chess(g2.fen()).move(reply.san); if (rm) board.setArrows([{ from: rm.from, to: rm.to, color: 'red' }]); msg += '<p>Your opponent answers <strong>' + esc(reply.san) + '</strong> (red arrow).</p>'; }
      }
      panel.innerHTML = '<h2>' + esc(ex.title) + '</h2>' + msg +
        '<div class="explain"><h3>Good defences</h3><p>' + CT.Annotate.annotate(ex.defence, game.fen()).html + '</p><p class="small muted">Engine\'s top choices here: ' + esc(top.join(', ')) + '</p></div>' +
        '';
      CT.Voice.say(msg + ' ' + CT.Voice.brief(ex.defence, 1));
      panel.innerHTML += '<div class="btn-row"><button class="btn primary" data-act="next">Next exercise</button>' + (ex.seeTrap ? '<a class="btn" href="#/lab/trap/' + ex.seeTrap + '">See the trap</a>' : '') + '</div>';
    }

    function onMove(from, to, promotion) {
      if (stage === 'find') {
        var f = CT.Annotate.flipTurn(game.fen()), mv = f.move({ from: from, to: to, promotion: promotion });
        if (!mv) return false;
        var ok = ex.threats.some(function (t) { return t.replace(/[+#]/g, '') === mv.san.replace(/[+#]/g, ''); });
        revealThreat(ok, mv.san);
        return false;
      }
      if (stage === 'defend') {
        var test = new Chess(game.fen()), d = test.move({ from: from, to: to, promotion: promotion });
        if (!d) return false;
        board.setGame(test, { lastMove: { from: d.from, to: d.to } });
        panel.innerHTML = '<p class="muted">Checking your defence…</p>';
        setTimeout(function () { judgeDefence(d); }, 30);
        return true;
      }
      return false;
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'givethreat') revealThreat(false, null);
      if (b.dataset.act === 'defend') startDefend();
      if (b.dataset.act === 'next') { idx++; load(); }
    });
    load();
  }

  function trapLesson(view, id) { return CT.Views.openingLesson(view, id, 'learn'); }

  /** Trap Payoff: which traps came up in your real games, who fell for them, and whether you punished them. */
  function payoffHtml() {
    if (!CT.Insights) return '';
    var rows = CT.Insights.trapPayoff(), esc = CT.UI.esc;
    var games = CT.Experiments ? CT.Experiments.realGames().length : 0;
    if (!rows.length) return '<section class="card"><h2>🎯 Trap Payoff</h2><p class="small muted">Which of your traps actually come up in your real games — and who falls for them. ' + (games ? 'None of the ' + games + ' analysed games reached a trap position yet.' : 'Appears once your chess.com games are imported and analysed.') + '</p></section>';
    var set = rows.filter(function (r) { return r.drill.mode === 'punish'; }), against = rows.filter(function (r) { return r.drill.mode === 'avoid'; });
    var tbl = function (list, cols) {
      return '<table class="nb-table payoff-table"><thead><tr><th>Trap</th>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + list.map(function (r) {
        return '<tr><td><a href="#/lab/drill/' + r.drill.id + '">' + esc(r.drill.name) + '</a></td><td>' + r.reached + '</td><td>' + r.fell + '</td>' + (cols.length > 2 ? '<td>' + r.punished + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table>';
    };
    return '<section class="card"><h2>🎯 Trap Payoff</h2><p class="small muted">From your ' + games + ' analysed real games. Drills for traps that come up — or that caught you — are served first.</p>' +
      (set.length ? '<h3 class="mt">Your traps</h3>' + tbl(set, ['came up', 'they fell', 'you punished']) : '') +
      (against.length ? '<h3 class="mt">Traps set against you</h3>' + tbl(against, ['came up', 'you fell']) : '') + '</section>';
  }

  CT.Views = CT.Views || {};
  CT.Views.lab = hub;
  CT.Views.labThreats = threats;
  CT.Views.labTrap = trapLesson;
})(window);
