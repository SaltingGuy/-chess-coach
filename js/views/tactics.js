/* Tactical Academy: theme overview, concept pages (with worked examples) and the adaptive puzzle trainer. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  function strip(s) { return String(s).replace(/[+#?!]/g, ''); }
  var TIER_NAMES = { 1: 'Beginner · one move', 2: 'Early intermediate · two moves', 3: 'Intermediate · three moves', 4: 'Advanced · quiet moves & combinations' };

  function overview(view) {
    var D = CT.Data, stats = CT.Store.themeStats(D.themes), recs = CT.Store.state.puzzles, tier = CT.Coach.tierInfo();
    var byTier = {};
    Object.keys(D.themes).forEach(function (k) { var t = D.themes[k].tier; (byTier[t] = byTier[t] || []).push(k); });
    var sections = Object.keys(byTier).sort().map(function (t) {
      var locked = +t > tier.tier;
      return '<h2 class="tier-head">Tier ' + t + ' <span class="muted small">' + TIER_NAMES[t] + '</span>' + (locked ? ' <span class="tag">locked</span>' : '') + '</h2>' +
        '<section class="theme-grid">' + byTier[t].map(function (k) {
          var th = D.themes[k], s = stats[k];
          var list = D.puzzles.filter(function (p) { return p.theme === k; });
          var solved = list.filter(function (p) { return recs[p.id] && recs[p.id].firstTryOk; }).length;
          return '<a class="card theme-card' + (locked ? ' locked' : '') + '" href="#/tactics/theme/' + k + '">' +
            '<div class="row-between"><h3>' + esc(th.name) + '</h3><span class="small muted">' + solved + '/' + list.length + '</span></div>' +
            (CT.Store.isMastered(k) ? '<p><span class="tag ok">✓ tested out</span></p>' : '') +
            '<p class="small muted">' + esc(th.what.split('. ')[0]) + '.</p>' +
            UI.bar(s.recentAccuracy, s.recentAccuracy != null && s.recentAccuracy < 0.6 ? 'warn' : '') + '<p class="small">Accuracy ' + UI.pct(s.recentAccuracy) + '</p></a>';
        }).join('') + '</section>';
    }).join('');
    var composed = D.puzzles.filter(function (p) { return !p.source; }).length, lich = CT.Pack ? CT.Pack.count : 0, wi = CT.Coach.woodpecker();
    view.innerHTML = '<header class="page-head"><div><h1>Tactical Academy</h1><p class="muted">' + composed + ' hand-made lessons plus ' + lich.toLocaleString() + ' puzzles from real games (Lichess, free to use). Your puzzle rating: <strong>' + CT.Store.puzzleRating() + '</strong>.</p></div>' +
      '<a class="btn primary big" href="#/tactics/train">Daily Mix</a></header>' +
      '<section class="grid-2 mode-cards">' +
        '<a class="card mode-card" href="#/tactics/train"><h3>🎲 Daily Mix <span class="tag ok">recommended</span></h3><p class="small">Unlabelled puzzles near your level, like a real game where nobody tells you "this is a fork". Reviews and puzzles from your own games come first; about 2 in 5 target your costliest weakness.</p></a>' +
        '<a class="card mode-card" href="#/tactics/woodpecker"><h3>🪵 Woodpecker set</h3><p class="small">' + wi.total + ' easy puzzles solved in cycles, faster each time, until the patterns become automatic. Cycle ' + wi.cycle + ': ' + wi.solved + '/' + wi.total + ' done.</p></a>' +
        (CT.Danger ? '<a class="card mode-card" href="#/tactics/danger"><h3>🛡 Back-rank danger</h3><p class="small">The defending side: two candidate moves, one loses to a back-rank mate. Spot it, then play your opponent\'s punishment. ' + CT.Danger.progress().ok + '/' + CT.Danger.count + ' done.</p></a>' : '') +
      '</section>' +
      '<h2 class="mt">Theme School</h2><p class="small muted">Learn a new idea here first (concept, worked example, then puzzles on that theme). Day to day, the Daily Mix trains better for real games.</p>' +
      '<div class="tier-status card"><div><strong>Your tier: ' + tier.tier + '</strong> — ' + esc(TIER_NAMES[tier.tier]) + '</div>' +
      (tier.tier < 4 ? '<div class="small muted">' + esc(tier.need) + ' Now: ' + UI.pct(tier.recentAtTier ? tier.accuracyAtTier : null) + ' over ' + tier.recentAtTier + ' puzzles.</div>' + UI.bar(tier.recentAtTier ? Math.min(1, tier.recentAtTier / 8) * Math.min(1, tier.accuracyAtTier / 0.7) : 0) : '<div class="small">All tiers unlocked.</div>') + '</div>' +
      sections;
  }

  /* ---------------- Concept page with a worked example ---------------- */
  function themePage(view, theme) {
    var D = CT.Data, th = D.themes[theme];
    if (!th) { view.innerHTML = '<p>Unknown theme.</p>'; return; }
    var list = D.puzzles.filter(function (p) { return p.theme === theme; }), recs = CT.Store.state.puzzles;
    var ex = CT.Coach.exampleFor(theme);
    view.innerHTML = '<a class="back" href="#/tactics">← Tactical Academy</a>' +
      '<header class="page-head"><div><h1>' + esc(th.name) + '</h1><p class="muted">Tier ' + th.tier + ' · ' + esc(TIER_NAMES[th.tier]) + '</p></div>' +
      '<a class="btn primary big" href="#/tactics/train/' + theme + '">Practise this theme</a></header>' +
      '<section class="grid-2"><div class="card concept"><h2>1 · What it is</h2><p>' + CT.Annotate.annotate(th.what, null).html + '</p><h2>2 · The idea</h2><p>' + CT.Annotate.annotate(th.idea, null).html + '</p>' +
      '<h2>3 · The deceptive angle</h2><p>' + CT.Annotate.annotate(th.deception, null).html + '</p></div>' +
      (ex ? '<div class="card example"><h2>4 · Worked example</h2><div class="board-host small-board"></div><div class="ex-text"></div><div class="nav-row"><button class="btn" data-act="ex-start">⏮</button><button class="btn primary" data-act="ex-next">Next ▶</button></div></div>' : '<div class="card"><h2>4 · Worked example</h2><p class="muted">Solve the first puzzle below — its full explanation appears when you finish.</p></div>') +
      '</section>' +
      '<section class="card"><h2>5 · Practice</h2><p class="small muted">Calculate before you move: there is no time limit. After each puzzle you see why the solution works and why the tempting alternatives fail.' +
        (list.filter(function (p) { return p.source === 'lichess'; }).length ? ' <strong>Practise this theme</strong> also serves ' + list.filter(function (p) { return p.source === 'lichess'; }).length + ' puzzles from real games, closest to your level first.' : '') + '</p><ul class="plist">' + list.filter(function (p) { return p.source !== 'lichess' && (!ex || p.id !== ex.id); }).map(function (p) {
        var r = recs[p.id];
        var st = !r ? '<span class="tag">new</span>' : r.firstTryOk ? '<span class="tag ok">solved</span>' : '<span class="tag bad">missed</span>';
        return '<li><a href="#/tactics/p/' + p.id + '">' + esc(p.title) + '</a> <span class="small muted">level ' + p.level + '</span> ' + st + '</li>';
      }).join('') + '</ul></section>' + testOutCard(theme) +
      (/^back-rank/.test(theme) && CT.Danger ? '<section class="card"><h2>🛡 The defending side</h2><p class="small">Seeing a back-rank mate is the easy part. The harder skill is noticing when <em>your</em> back rank is weak and making an escape square in time.</p><div class="btn-row"><a class="btn" href="#/tactics/danger">Back-rank danger drill</a></div></section>' : '') +
      (theme === 'back-rank' && D.themes['back-rank-combo'] ? '<p class="small muted">Too easy? <a href="#/tactics/theme/back-rank-combo">Back-rank combinations</a> are the harder version: you have to remove the defender before the mate works.</p>' : '');
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="unmaster"]');
      if (!b) return;
      CT.Store.unmaster(theme); CT.App.rerender();
    });
    if (ex) workedExample(view, ex);
  }

  /** "Already know this?" — 3 harder puzzles, one try, no hints. Pass → the theme only comes back as a check-in. */
  function testOutCard(theme) {
    var Coach = CT.Coach, m = Coach.masteredInfo(theme), T = Coach.TESTOUT;
    if (m) {
      return '<section class="card"><h2>✓ Tested out</h2><p class="small">You passed the test on ' + new Date(m.at).toLocaleDateString() + '. This theme only comes back in your Daily Mix as a check-in, about every ' + Math.round(Coach.CHECKIN_GAP / 86400000) + ' days' +
        (m.checkins ? ' (' + m.checkins + ' passed so far)' : '') + '. Miss a check-in and it returns to normal training.</p>' +
        (m.fromGames ? '<p class="small warn">Your analysed games show mistakes with this theme, so you are getting it in training anyway.</p>' : '<p class="small muted">Next check-in: ' + (m.checkinDue ? 'due now' : new Date(m.nextCheckin).toLocaleDateString()) + '.</p>') +
        '<div class="btn-row"><button class="btn" data-act="unmaster">Bring it back into training</button></div></section>';
    }
    if (!Coach.testOutAvailable(theme)) return '';
    return '<section class="card"><h2>Already know this? Test out</h2><p class="small">' + T.count + ' harder puzzles from this theme, one try each, no hints, ' + T.secs / 60 + ' minutes each. Solve all ' + T.count + ' and this theme only shows up as an occasional check-in.</p>' +
      '<div class="btn-row"><a class="btn" href="#/tactics/testout/' + theme + '">Test out</a></div></section>';
  }

  function workedExample(view, p) {
    var Chess = CT.Chess, host = view.querySelector('.example .board-host'), text = view.querySelector('.ex-text');
    var g, step = 0;
    var board = new CT.Board(host, { orientation: new Chess(p.fen).turn(), canMove: function () { return false; } });
    CT.Annotate.bind(text, function () { return board; });
    function show() {
      g = new Chess(p.fen);
      var last = null;
      for (var i = 0; i < step; i++) last = g.move(p.line[i]);
      board.setGame(g, { lastMove: last ? { from: last.from, to: last.to } : null });
      if (last) board.setArrows([{ from: last.from, to: last.to, color: i % 2 === 1 ? 'green' : 'red' }]);
      var who = new Chess(p.fen).turn();
      if (step === 0) text.innerHTML = '<p><strong>' + esc(p.title) + '.</strong> ' + CT.Annotate.annotate(p.prompt, p.fen).html + '</p><p class="small muted">Think first: what would you play? Then press Next.</p>';
      else if (step < p.line.length) text.innerHTML = '<p><strong>' + (step % 2 === 1 ? UI.sideName(who) : UI.sideName(who === 'w' ? 'b' : 'w')) + ' plays ' + esc(p.line[step - 1]) + '.</strong></p><p class="small muted">Press Next for the reply.</p>';
      else text.innerHTML = '<p><strong>Done.</strong> ' + CT.Annotate.annotate(p.explain, p.fen).html + '</p><p class="small">' + CT.Annotate.annotate(p.pitfalls, p.fen).html + '</p>';
    }
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'ex-next' && step < p.line.length) { step++; show(); }
      if (b.dataset.act === 'ex-start') { step = 0; show(); }
    });
    show();
  }

  /* ---------------- Puzzle trainer ---------------- */
  function trainer(view, opts) {
    var Chess = CT.Chess, Engine = CT.Engine, Store = CT.Store, Coach = CT.Coach;
    var p, game, ply, board, state, timerId, startAt, lastId = null, sessionCount = 0, sessionOk = 0;

    view.innerHTML = '<a class="back" href="#/tactics">← Tactical Academy</a>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div></div>' +
      '<aside class="panel"><div class="panel-body"></div></aside></div>';
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), {
      canMove: function (color) { return state && !state.done && !state.busy && !state.wrong && color === p.side; },
      onMove: onUserMove
    });
    CT.Annotate.bind(panel, function () { return board; });

    function pick() {
      if (opts.woodpecker) {
        var wi = Coach.woodpecker();
        if (wi.restDay) return null;
        return wi.next ? { puzzle: wi.next, reason: 'Woodpecker cycle ' + wi.cycle + ' · ' + (wi.solved + 1) + ' of ' + wi.total + (wi.targetMs ? ' · target pace ' + Math.round(wi.targetMs / wi.total / 1000) + 's per puzzle' : ' · accuracy first') } : null;
      }
      if (opts.id) return { puzzle: Coach.puzzleById(opts.id), reason: 'Selected puzzle.' };
      return Coach.nextPuzzle({ theme: opts.theme, exclude: lastId, allowEarly: !!opts.theme, warmup: !!opts.warmup, mine: !!opts.mine, stretch: !!opts.stretch });
    }

    function load() {
      var choice = pick();
      if (!choice || !choice.puzzle) return caughtUp();
      p = choice.puzzle;
      p.side = new Chess(p.fen).turn();
      game = new Chess(p.fen);
      ply = 0;
      state = { done: false, mistakes: 0, hints: 0, gaveUp: false, recorded: false, reason: choice.reason, busy: false, wrong: false, checkin: !!choice.checkin };
      // First attempts are untimed on screen: calculate properly, don't race. Woodpecker cycles and reviews show the clock.
      state.showClock = !!opts.woodpecker || !!Store.state.puzzles[p.id];
      board.setOrientation(p.side);
      board.setGame(game, { lastMove: p.pre ? { from: p.pre.from, to: p.pre.to } : null });
      startAt = Date.now();
      clearInterval(timerId);
      timerId = setInterval(tick, 1000);
      draw();
      CT.Voice.say((/to move/i.test(p.prompt) ? '' : UI.sideName(p.side) + ' to move. ') + p.prompt + (p.goal === 'mate' && !/mate in/i.test(p.prompt) ? ' Checkmate in ' + p.mateIn + '.' : ''));
    }

    function caughtUp() {
      clearInterval(timerId);
      board.setGame(new Chess(), { lastMove: null });
      if (opts.woodpecker) {
        var wi = Coach.woodpecker(), last = wi.prev;
        panel.innerHTML = '<h2>' + (wi.restDay ? 'Rest day' : 'Cycle complete') + '</h2>' +
          (last ? '<p>Cycle ' + last.cycle + ': <strong>' + Math.round(last.accuracy * 100) + '%</strong> correct in <strong>' + Math.round(last.ms / 60000) + ' min</strong>.</p>' : '') +
          '<p>The Woodpecker method works best with a day of rest between cycles. Next cycle, aim for about half the time with the same accuracy.</p>' +
          '<div class="btn-row"><a class="btn primary" href="#/tactics/woodpecker">Woodpecker overview</a><a class="btn" href="#/tactics/train">Daily Mix</a></div>';
        return;
      }
      if (opts.mine) {
        panel.innerHTML = '<h2>No more due</h2><p>None of your own mistakes or reviews are due right now — they come back on a schedule so they stick.</p>' +
          (sessionCount ? '<p>This block: <strong>' + sessionOk + '/' + sessionCount + '</strong> right first time.</p>' : '') +
          (CT.Session && CT.Session.active() ? '<div class="btn-row"><button class="btn primary" data-act="session-next">Next block ▶</button></div>' : '<div class="btn-row"><a class="btn primary" href="#/tactics/train">Daily Mix</a></div>');
        var nb = panel.querySelector('[data-act="session-next"]');
        if (nb) nb.addEventListener('click', function () { CT.Session.next(true); });
        return;
      }
      panel.innerHTML = '<h2>All caught up</h2><p>You have no puzzles due right now' + (opts.theme ? ' in this theme' : '') + '. Missed puzzles come back after a short break (often as a mirrored twin — same idea, new position), and solved ones come back days later so they stick.</p>' +
        (sessionCount ? '<p>This session: <strong>' + sessionOk + '/' + sessionCount + '</strong> right first time.</p>' : '') +
        '<div class="btn-row"><a class="btn" href="#/tactics">Choose a theme</a><a class="btn" href="#/lab">Deception Lab</a><a class="btn" href="#/">Dashboard</a></div>';
    }

    function tick() { var el = panel.querySelector('.clock'); if (el && !state.done && state.showClock) el.textContent = fmt(Date.now() - startAt); }
    function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    function draw(feedback) {
      var th = CT.Data.themes[p.theme];
      var html = '<p class="small muted">' + esc(state.reason) + ' · level ' + p.level + '</p>' +
        '<div class="row-between"><h2>' + esc(p.title) + '</h2><span class="clock' + (state.showClock ? '' : ' small muted') + '" title="' + (state.showClock ? '' : 'First tries are untimed — take the time to check every forcing move.') + '">' + (state.showClock ? fmt(Date.now() - startAt) : 'untimed') + '</span></div>' +
        '<p class="tomove ' + p.side + '"><span class="swatch"></span>' + CT.Annotate.annotate(p.prompt, null).html + '</p>' +
        (p.goal === 'mate' ? '<p class="small">Goal: checkmate in ' + p.mateIn + '. Any move that forces mate counts.</p>' : '<p class="small">Goal: win material. The opponent will defend as well as possible.</p>');
      if (state.hints >= 1 && !state.done) html += '<p class="hint">💡 ' + CT.Annotate.annotate(p.hint, p.fen).html + '</p>';
      if (feedback) html += feedback;
      if (state.done) {
        var twin = Coach.twinOf(p);
        html += '<div class="explain"><h3>Why it works</h3><p>' + CT.Annotate.annotate(p.explain, p.fen).html + '</p><h3>Tempting moves that fail</h3><p>' + CT.Annotate.annotate(p.pitfalls, p.fen).html + '</p>' +
          '<p class="small muted">Tap a highlighted move or square to see it. Theme: <a href="#/tactics/theme/' + p.theme + '">' + esc(th.name) + '</a> · Moves: ' + esc(p.line.join(' ')) + '</p></div>' +
          '<div class="btn-row"><button class="btn primary" data-act="next">Next puzzle</button><button class="btn" data-act="replay">Replay solution</button>' +
          (twin ? '<button class="btn" data-act="twin">Same idea, new position</button>' : '') + '</div>' + afterNote();
      } else if (state.wrong) {
        html += '<div class="btn-row"><button class="btn primary" data-act="undo">Try again</button><button class="btn" data-act="show">Show solution</button></div>';
      } else {
        html += '<div class="btn-row"><button class="btn" data-act="hint">' + (state.hints === 0 ? 'Hint' : state.hints === 1 ? 'Show the idea (arrow)' : 'Hint used') + '</button><button class="btn" data-act="show">Show solution</button></div>';
      }
      if (sessionCount) html += '<p class="small muted session">Session: ' + sessionOk + '/' + sessionCount + ' right first time</p>';
      panel.innerHTML = html;
    }

    // After a puzzle: the result of a check-in, or an offer to test out of a theme you keep getting right.
    function afterNote() {
      var th = CT.Data.themes[p.theme], name = esc(th.name), link = '<a href="#/tactics/theme/' + p.theme + '">' + name + '</a>';
      if (state.unmastered) return '<p class="small warn">That was a check-in on ' + link + ', a theme you tested out of. It is back in normal training for now — you can test out again later.</p>';
      if (state.checkin) return '<p class="small good">Check-in passed: ' + link + ' stays tested out.</p>';
      if (Store.isMastered(p.theme) || !Coach.testOutAvailable(p.theme)) return '';
      var s = Store.themeStats(CT.Data.themes)[p.theme];
      if (s && s.attempts >= 5 && s.recentAccuracy >= 0.8) return '<p class="small muted">Finding ' + name + ' easy? <a href="#/tactics/testout/' + p.theme + '">Test out</a> — 3 harder puzzles, and it only comes back as a check-in.</p>';
      return '';
    }

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'next') { lastId = p.id; opts.id = null; load(); }
      if (a === 'twin') { var tw = Coach.twinOf(p); if (tw) { lastId = p.id; opts.id = tw.id; load(); opts.id = null; } }
      if (a === 'replay') replay();
      if (a === 'hint') giveHint();
      if (a === 'show') showSolution();
      if (a === 'undo') { game.undo(); state.wrong = false; board.setGame(game, { lastMove: null, sound: false }); draw(); }
    });

    function fail(kind) {
      if (state.recorded) return;
      state.recorded = true;
      var rec = Store.recordPuzzle(p, { ok: false, ms: Date.now() - startAt, usedHint: kind === 'hint', woodpecker: !!opts.woodpecker, checkin: state.checkin });
      if (rec.unmastered) { state.unmastered = rec.unmastered; delete rec.unmastered; Store.save(); }
      if (opts.woodpecker) Coach.recordWoodpecker(p, false, Date.now() - startAt);
      if (opts.warmup) Store.bumpDay('warmup');
      sessionCount++;
    }

    function giveHint() {
      if (state.hints >= 2) return;
      state.hints++;
      fail('hint');
      if (state.hints === 2) {
        var m = new Chess(game.fen()).move(p.line[ply]);
        if (m) { var mk = {}; mk[m.from] = 'hint'; board.setMarks(mk); board.setArrows([{ from: m.from, to: m.to, color: 'blue' }]); }
      }
      draw();
      CT.Voice.say(state.hints === 1 ? 'Hint. ' + p.hint : 'The blue arrow shows the first move.');
    }

    function onUserMove(from, to, promotion) {
      var before = game.fen();
      var mv = game.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      var correct = false, alt = false;
      if (p.exact) {
        // Lichess puzzles: only the solution move counts, except that any checkmate counts.
        correct = strip(mv.san) === strip(p.line[ply]) || game.isCheckmate();
      } else if (p.goal === 'mate') {
        var remaining = p.mateIn - Math.floor(ply / 2);
        game.undo();
        correct = Engine.sanForcesMate(game, mv.san, remaining);
        game.move(mv.san);
      } else {
        correct = strip(mv.san) === strip(p.line[ply]);
        if (!correct && ply === 0 && (p.alsoAccept || []).some(function (a) { return strip(a) === strip(mv.san); })) { correct = true; alt = true; }
      }
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to } });
      if (!correct) return wrongMove(mv, before), true;
      var onLine = strip(mv.san) === strip(p.line[ply] || '');
      ply++;
      if (game.isCheckmate() || alt || (p.goal !== 'mate' && ply >= p.line.length)) return solved(alt ? mv.san : null), true;
      CT.Sound.play('good');
      state.busy = true;
      draw('<p class="good">✓ Good move. Your opponent replies…</p>');
      setTimeout(function () {
        var reply = (onLine || p.exact) && p.line[ply] ? p.line[ply] : Engine.stubbornDefence(game, p.mateIn - Math.floor(ply / 2));
        var r = game.move(reply);
        ply++;
        state.busy = false;
        board.setGame(game, { lastMove: r ? { from: r.from, to: r.to } : null });
        if (r) board.setArrows([{ from: r.from, to: r.to, color: 'red' }]);
        draw('<p class="good">✓ Correct. Your opponent answered ' + esc(r ? r.san : reply) + ' (red arrow). Now keep going — what is the follow-up?</p>');
        CT.Voice.say('Correct. Your opponent answered ' + (r ? r.san : reply) + '. What is the follow-up?');
      }, 650);
      return true;
    }

    function wrongMove(mv, beforeFen) {
      state.mistakes++;
      state.wrong = true;
      CT.Sound.play('bad');
      fail('wrong');
      var msg = '<p class="bad">✗ ' + esc(mv.san) + ' is not the answer.</p>';
      if (game.isCheckmate()) msg = '<p class="bad">✗ Unexpected — that is mate, but not the intended solution.</p>';
      else if (game.isStalemate()) msg += '<p>That is stalemate — a draw!</p>';
      else {
        var reply = Engine.bestMove(game, 2, 2e5);
        if (reply) {
          var rm = new Chess(game.fen()).move(reply.san);
          if (rm) board.setArrows([{ from: mv.from, to: mv.to, color: 'yellow' }, { from: rm.from, to: rm.to, color: 'red' }]);
          msg += '<p>Your move (yellow arrow) can be answered by <strong>' + esc(reply.san) + '</strong> (red arrow). ' +
            (p.goal === 'mate' ? 'There is no forced mate after your move.' : 'Look again for a move that wins more.') + '</p>' +
            '<p class="small muted">Quick check by the built-in mini-engine (shallow).</p>';
        }
      }
      draw(msg);
      CT.Voice.say(msg.replace(/<p class="small muted">.*$/, ''));
    }

    function solved(altSan) {
      state.done = true;
      clearInterval(timerId);
      var ok = state.mistakes === 0 && state.hints === 0 && !state.gaveUp;
      if (!state.recorded) {
        state.recorded = true; Store.recordPuzzle(p, { ok: ok, ms: Date.now() - startAt, woodpecker: !!opts.woodpecker, checkin: state.checkin && ok }); sessionCount++; if (ok) sessionOk++;
        if (opts.warmup) Store.bumpDay('warmup');
        if (opts.woodpecker) Coach.recordWoodpecker(p, ok, Date.now() - startAt);
      }
      CT.Sound.play(ok ? 'win' : 'good');
      var fb = ok ? '<p class="good big">✓ Solved first try in ' + fmt(Date.now() - startAt) + '!</p>' : '<p class="good">✓ Solved. This idea will come back for review soon.</p>';
      if (altSan) fb += '<p class="small">' + esc(altSan) + ' also wins. The main line was ' + esc(p.line[0]) + '.</p>';
      draw(fb);
      CT.Voice.say((ok ? 'Solved first try! ' : 'Solved. ') + CT.Voice.brief(p.explain, 2));
    }

    // Animate a line from the start with arrows; used by "Show solution" and "Replay solution".
    function animate(fromPly, done) {
      var i = fromPly;
      state.busy = true;
      (function step() {
        if (i >= p.line.length) { state.busy = false; done(); return; }
        var m = game.move(p.line[i]);
        board.setGame(game, { lastMove: m ? { from: m.from, to: m.to } : null });
        if (m) board.setArrows([{ from: m.from, to: m.to, color: i % 2 === 0 ? 'green' : 'red' }]);
        i++;
        setTimeout(step, 900);
      })();
    }

    function replay() {
      game = new Chess(p.fen);
      board.setGame(game, { lastMove: null, sound: false });
      setTimeout(function () { animate(0, function () { draw('<p class="small">Replay finished.</p>'); }); }, 400);
    }

    function showSolution() {
      state.gaveUp = true;
      fail('show');
      if (state.wrong) { game.undo(); state.wrong = false; }
      animate(ply, function () { state.done = true; clearInterval(timerId); draw('<p class="bad">Solution shown. This idea will come back for review — possibly in a mirrored position.</p>'); });
    }

    load();
    return function cleanup() { clearInterval(timerId); };
  }

  CT.Views = CT.Views || {};
  /* ---------------- Woodpecker overview ---------------- */
  function woodpeckerPage(view) {
    var wi = CT.Coach.woodpecker();
    var hist = wi.history.map(function (h) { return '<tr><td>' + h.cycle + '</td><td>' + Math.round(h.accuracy * 100) + '%</td><td>' + Math.round(h.ms / 60000) + ' min</td><td>' + new Date(h.finishedAt).toLocaleDateString() + '</td></tr>'; }).join('');
    view.innerHTML = '<a class="back" href="#/tactics">← Tactical Academy</a><header class="page-head"><div><h1>🪵 Woodpecker set</h1><p class="muted">The same ' + wi.total + ' easy puzzles (Lichess 600–1000), solved in cycles until the patterns jump out at you instantly.</p></div>' +
      (wi.restDay ? '<span class="tag">rest day</span>' : '<a class="btn primary big" href="#/tactics/woodpecker/go">' + (wi.solved ? 'Continue cycle ' + wi.cycle : 'Start cycle ' + wi.cycle) + '</a>') + '</header>' +
      '<section class="card"><h2>Cycle ' + wi.cycle + '</h2>' + UI.bar(wi.total ? wi.solved / wi.total : 0) +
        '<p>' + wi.solved + ' of ' + wi.total + ' solved · ' + (wi.solved ? Math.round(wi.correct / wi.solved * 100) + '% correct · ' + Math.round(wi.ms / 60000) + ' min so far' : 'not started') + '</p>' +
        (wi.targetMs ? '<p class="small">Target for this cycle: about <strong>' + Math.round(wi.targetMs / 60000) + ' minutes</strong> in total (half the last cycle) with the same accuracy.</p>' : '<p class="small">First cycle: take your time and aim for accuracy. Later cycles aim for about half the previous time.</p>') +
        (wi.restDay ? '<p class="small">You finished a cycle less than a day ago. A rest day before the next cycle helps the patterns settle.</p>' : '') + '</section>' +
      '<section class="card"><h2>How it works</h2><ul class="small"><li>Do 20–30 puzzles a day as part of your training; the app remembers where you are.</li><li>Your answers here do not change your puzzle rating or the review queue — the set is about speed of recognition.</li><li>Based on the Woodpecker Method (Smith &amp; Tikkanen). Its authors suggest a few hundred puzzles for club players and several cycles, faster each time.</li></ul></section>' +
      (hist ? '<section class="card"><h2>Finished cycles</h2><table class="tbl"><thead><tr><th>Cycle</th><th>Correct</th><th>Time</th><th>Finished</th></tr></thead><tbody>' + hist + '</tbody></table></section>' : '');
  }

  CT.Views.tactics = overview;
  CT.Views.woodpecker = woodpeckerPage;
  CT.Views.tacticsTheme = themePage;
  CT.Views.tacticsTrainer = trainer;
})(window);
