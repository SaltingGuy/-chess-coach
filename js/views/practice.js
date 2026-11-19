/*
 * Practice: play full games against computer opponents with different styles.
 *   #/practice       — choose opponent, level, colour, opening and clock (or resume a game)
 *   #/practice/play  — the game; afterwards a "what happened" summary and a link to the full engine review
 * The game in progress is saved after every move, so refreshing the page does not lose it.
 */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  var CLOCKS = { off: null, '10': { base: 600000, inc: 0, label: '10 min' }, '15+10': { base: 900000, inc: 10000, label: '15 | 10' } };

  function O() { return CT.Opponent; }
  function S() { return CT.Store; }
  function lvlLabel(n) { return 'Level ' + n + ' (≈' + O().LEVELS[n].elo + ')'; }
  function moveNo(ply) { return (Math.floor(ply / 2) + 1) + (ply % 2 ? '…' : '.'); }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    var s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0') + (ms < 10000 ? '.' + Math.floor((ms % 1000) / 100) : '');
  }
  function engineChip() {
    var st = CT.Stockfish.status();
    return st.state === 'ready' ? '<span class="tag ok">Stockfish</span>' : st.state === 'loading' ? '<span class="tag">Loading Stockfish…</span>' : '<span class="tag bad">Built-in engine</span>';
  }

  /* ======================= Setup ======================= */
  function setup(view) {
    var Coach = CT.Coach, st = Coach.practiceStats(), pick = Coach.practicePick();
    var sel = { style: pick.style, level: pick.level, color: 'w', rep: '', clock: '15+10', safety: S().state.profile.safetyMode || 'auto', punish: S().state.profile.punishAll !== false };
    var cur = S().state.practiceCurrent;
    CT.Stockfish.init(); // start loading in the background

    function card(k) {
      var s = O().STYLES[k], r = st[k];
      return '<button type="button" class="style-card' + (sel.style === k ? ' on' : '') + '" data-style="' + k + '"><span class="style-ico">' + s.icon + '</span><span><strong>' + esc(s.name) + '</strong>' +
        '<small>' + esc(s.short) + '</small>' + (r ? '<small class="rec">You: ' + r.w + ' W · ' + r.l + ' L · ' + r.d + ' D' + (r.best ? ' · best win at level ' + r.best : '') + '</small>' : '') + '</span></button>';
    }
    function render() {
      var s = O().STYLES[sel.style];
      var reps = CT.Data.repertoires;
      var pt = CT.Insights ? CT.Insights.practiceTilt() : null;
      view.innerHTML = '<header class="page-head"><div><h1>Practice</h1><p class="muted">Full games against computer opponents with different personalities. After each game you get an explanation of what happened.</p></div><div class="engine-state">' + engineChip() + '</div></header>' +
        (pt ? '<p class="warnbox small">🧊 You lost your last two practice games. A short break (or a few easy puzzles) before the next one usually helps more than playing on.</p>' : '') +
        (cur ? '<section class="card resume"><div class="row-between wrap"><div><h2>Game in progress</h2><p class="small muted">vs ' + esc(O().STYLES[cur.style].name) + ' · ' + lvlLabel(cur.level) + ' · ' + cur.moves.length + ' half-moves played</p></div>' +
          '<div class="btn-row"><a class="btn primary" href="#/practice/play">Resume</a><button class="btn" data-act="abandon">Abandon</button></div></div></section>' : '') +
        '<section class="card coach-pick"><h2>Coach suggests</h2><p><strong>' + O().STYLES[pick.style].icon + ' ' + esc(O().STYLES[pick.style].name) + '</strong> at ' + lvlLabel(pick.level) + '</p><p class="small">' + esc(pick.reason) + '</p>' +
          '<button class="btn" data-act="usepick">Use this</button></section>' +
        '<section class="card"><h2>1. Opponent</h2><div class="style-grid">' + O().STYLE_ORDER.map(card).join('') + '</div>' +
          '<p class="small style-teach"><strong>What this opponent trains:</strong> ' + esc(s.teaches) + '</p></section>' +
        '<section class="card"><h2>2. Settings</h2><div class="settings-grid">' +
          '<label class="field">Strength<select class="lvl">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="' + n + '"' + (n === sel.level ? ' selected' : '') + '>' + lvlLabel(n) + (n === Coach.suggestedLevel(sel.style) ? ' — suggested' : '') + '</option>'; }).join('') + '</select></label>' +
          '<label class="field">You play<select class="col"' + (sel.rep ? ' disabled' : '') + '><option value="w"' + (sel.color === 'w' ? ' selected' : '') + '>White</option><option value="b"' + (sel.color === 'b' ? ' selected' : '') + '>Black</option><option value="r"' + (sel.color === 'r' ? ' selected' : '') + '>Random</option></select></label>' +
          '<label class="field">Opening<select class="rep"><option value="">Free play</option>' + reps.map(function (r) { return '<option value="' + r.id + '"' + (sel.rep === r.id ? ' selected' : '') + '>Practise: ' + esc(r.name) + ' (as ' + UI.sideName(r.side) + ')</option>'; }).join('') + '</select></label>' +
          '<label class="field">Safety check<select class="saf">' + [['auto', 'When it matters (recommended)'], ['always', 'Every move'], ['off', 'Off']].map(function (o) { return '<option value="' + o[0] + '"' + (sel.safety === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
          '<label class="field">Mistakes<select class="pun"><option value="1"' + (sel.punish ? ' selected' : '') + '>Always punish my blunders (recommended)</option><option value="0"' + (sel.punish ? '' : ' selected') + '>Play to the level only</option></select></label>' +
          '<label class="field">Clock<select class="clk">' + Object.keys(CLOCKS).map(function (k) { return '<option value="' + k + '"' + (sel.clock === k ? ' selected' : '') + '>' + (CLOCKS[k] ? CLOCKS[k].label + ' (rapid)' : 'No clock') + '</option>'; }).join('') + '</select></label>' +
        '</div>' +
        '<p class="small"><strong>Safety check</strong> ("Real Chess"): before your move is played, you name your opponent\'s most dangerous reply. If your move would lose material or allow mate, you can take it back. ' + safetyLine() + '</p>' +
        (sel.rep ? '<p class="small muted">Opening practice: the opponent follows your repertoire (including common mistakes for you to punish) until the lines run out, then plays normally. You are told where you left your preparation.</p>' : '') +
        '<p class="small muted">Levels are rough guides. Weaker levels make human-like slips (missed tactics), not random sacrifices; only the Blunder-Prone Beginner leaves pieces hanging. ' +
        (CT.Stockfish.status().state === 'failed' ? '<span class="bad">Stockfish could not load, so the opponent uses the built-in Trainer Engine: decent club-level play at the top levels, but much weaker than Stockfish and weaker still on a slow phone. Wins against it don\'t count toward milestones.</span>' : '') + '</p>' +
        '<div class="btn-row"><button class="btn primary big" data-act="start">Start game</button></div></section>';
    }
    render();
    var unsub = function () {};
    CT.Stockfish.on(function () { var e = view.querySelector('.engine-state'); if (e) e.innerHTML = engineChip(); });

    view.addEventListener('click', function (e) {
      var c = e.target.closest('[data-style]');
      if (c) { sel.style = c.dataset.style; sel.level = Coach.suggestedLevel(sel.style); render(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'usepick') { sel.style = pick.style; sel.level = pick.level; render(); return; }
      if (a === 'abandon') {
        b.parentNode.innerHTML = '<span class="bad small">Abandon this game? It will not be saved.</span><button class="btn danger" data-act="abandon-yes">Yes, abandon</button><button class="btn" data-act="abandon-no">Keep it</button>';
        return;
      }
      if (a === 'abandon-yes') { S().state.practiceCurrent = null; S().save(); cur = null; render(); return; }
      if (a === 'abandon-no') { render(); return; }
      if (a === 'start') {
        var color = sel.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : sel.color;
        if (sel.rep) color = CT.Data.repertoires.find(function (r) { return r.id === sel.rep; }).side;
        var clk = CLOCKS[sel.clock];
        S().state.practiceCurrent = {
          style: sel.style, level: sel.level, color: color, rep: sel.rep || null, clock: clk ? { base: clk.base, inc: clk.inc, label: clk.label } : null,
          startFen: CT.Chess.DEFAULT_FEN, moves: [], notes: [], times: clk ? { w: clk.base, b: clk.base } : null,
          takebacks: 0, engines: {}, startedAt: Date.now(), bookExit: null, safetyMode: sel.safety, safety: { checks: 0, correct: 0, caught: 0, missed: 0, saves: 0 }, punish: sel.punish
        };
        S().save();
        location.hash = '#/practice/play';
      }
    });
    view.addEventListener('change', function (e) {
      if (e.target.matches('.lvl')) sel.level = +e.target.value;
      if (e.target.matches('.col')) sel.color = e.target.value;
      if (e.target.matches('.clk')) sel.clock = e.target.value;
      if (e.target.matches('.pun')) { sel.punish = e.target.value === '1'; S().state.profile.punishAll = sel.punish; S().save(); }
      if (e.target.matches('.saf')) { sel.safety = e.target.value; S().state.profile.safetyMode = sel.safety; S().save(); }
      if (e.target.matches('.rep')) { sel.rep = e.target.value; render(); }
    });
    return unsub;
  }

  /* ======================= Play ======================= */
  function play(view) {
    var cur = S().state.practiceCurrent;
    if (!cur) { location.hash = '#/practice'; return; }
    var Chess = CT.Chess, style = O().STYLES[cur.style], botColor = cur.color === 'w' ? 'b' : 'w';
    var gate = null;
    if (!cur.safety) cur.safety = { checks: 0, correct: 0, caught: 0, missed: 0, saves: 0 };
    if (!cur.safetyMode) cur.safetyMode = 'off';
    var game, board, thinking = false, over = false, seq = 0, timer = null, lastTick = Date.now(), confirmResign = false, sfMsg = '';
    var tree = cur.rep && CT.OpeningTree ? CT.OpeningTree.build(cur.rep) : null;

    view.innerHTML = '<a class="back" href="#/practice">← Practice</a>' +
      '<div class="trainer"><div class="board-col">' +
      '<div class="player-bar opp"><span class="pb-name">' + style.icon + ' ' + esc(style.name) + ' <small class="muted">' + lvlLabel(cur.level) + '</small></span><span class="clock" data-clock="' + botColor + '"></span></div>' +
      '<div class="board-host"></div>' +
      '<div class="player-bar me"><span class="pb-name">You <small class="muted">(' + UI.sideName(cur.color) + ')</small></span><span class="clock" data-clock="' + cur.color + '"></span></div>' +
      '<div class="nav-row"><button class="btn" data-act="takeback">↶ Takeback</button><button class="btn" data-act="flip" aria-label="Flip board">⇅</button><button class="btn danger" data-act="resign">Resign</button></div></div>' +
      '<aside class="panel"><div class="panel-body"></div><div class="movelist"></div></aside></div>';
    var panel = view.querySelector('.panel-body'), listEl = view.querySelector('.movelist');

    board = new CT.Board(view.querySelector('.board-host'), {
      orientation: cur.color,
      canMove: function (color) { return !over && !thinking && !gate && color === cur.color && game.turn() === cur.color; },
      onMove: onUserMove
    });

    function rebuild() {
      game = new Chess(cur.startFen);
      cur.moves.forEach(function (m) { game.move(m); });
    }
    function save() { S().state.practiceCurrent = cur; S().save(); }
    function lastMove() { var h = game.history({ verbose: true }), l = h[h.length - 1]; return l ? { from: l.from, to: l.to } : null; }

    function renderClocks() {
      if (!cur.clock) { view.querySelectorAll('.clock').forEach(function (c) { c.style.display = 'none'; }); return; }
      ['w', 'b'].forEach(function (c) {
        var el = view.querySelector('[data-clock="' + c + '"]');
        el.textContent = fmtClock(cur.times[c]);
        el.classList.toggle('run', !over && game.turn() === c && cur.moves.length > 0);
        el.classList.toggle('low', cur.times[c] < 30000);
      });
    }

    function renderPanel(msg) {
      if (over) return;
      var turnMine = game.turn() === cur.color;
      var status = thinking ? '<p class="thinking"><span></span><span></span><span></span> ' + esc(style.name.replace(/^The /, '')) + ' is thinking…</p>' :
        turnMine ? '<p class="prompt">Your move' + (game.inCheck() ? ' — <strong>you are in check!</strong>' : '') + '</p>' : '';
      panel.innerHTML = '<div class="row-between"><span class="small muted">' + engineChip() + (cur.takebacks ? ' <span class="tag">' + cur.takebacks + ' takeback' + (cur.takebacks > 1 ? 's' : '') + '</span>' : '') + '</span></div>' +
        (sfMsg ? '<p class="small bad">' + sfMsg + '</p>' : '') + status + (msg || '') +
        (confirmResign ? '<div class="warnbox small"><p>Resign this game?</p><div class="btn-row"><button class="btn danger" data-act="resign-yes">Yes, resign</button><button class="btn" data-act="resign-no">Keep playing</button></div></div>' : '') +
        '<details class="tool small"><summary>About this opponent</summary><p>' + esc(style.short) + '</p><p><strong>Trains:</strong> ' + esc(style.teaches) + '</p></details>';
      listEl.innerHTML = UI.moveListHtml(cur.moves, 'w', cur.moves.length - 1);
    }

    function refresh(msg, sound) {
      board.setGame(game, { lastMove: lastMove(), sound: sound });
      renderClocks(); renderPanel(msg);
    }

    function tick() {
      var now = Date.now(), dt = now - lastTick; lastTick = now;
      if (!cur.clock || over || !cur.moves.length) return;
      var t = gate ? cur.color : game.turn(); // during a safety check it is still your time
      cur.times[t] -= dt;
      if (cur.times[t] <= 0) { cur.times[t] = 0; renderClocks(); return finish('time', t === 'w' ? 'b' : 'w'); }
      renderClocks();
    }

    function afterMove(color) {
      if (cur.clock && cur.moves.length > 1) cur.times[color] += cur.clock.inc;
      if (cur.clock) { cur.clk = cur.clk || []; cur.clk.length = cur.moves.length - 1; cur.clk.push(Math.round(cur.times[color] / 100) / 10); }
      if (cur.convert && CT.Endgame && color === botColor) {
        // Convert the Win: your lead is measured after the bot's reply (so a recapture in progress does not count against you).
        var ld = CT.Endgame.lead(game.fen(), cur.color);
        if (ld < cur.convert.minLead) cur.convert.minLead = ld;
      }
      save();
      if (game.isGameOver()) {
        if (game.isCheckmate()) return finish('checkmate', color), true;
        return finish(game.gameOverReason(), null), true;
      }
      return false;
    }

    function onUserMove(from, to, promotion) {
      var before = game.fen();
      var mv = game.move({ from: from, to: to, promotion: promotion });
      if (!mv) return false;
      if (gateWanted()) { startGate(mv, before); return true; }
      commitUserMove(mv);
      return true;
    }

    /* ---------- Safety check ("Real Chess") ---------- */
    function gateWanted() {
      if (cur.safetyMode === 'off' || game.isGameOver()) return false;
      if (cur.safetyMode === 'always') return true;
      return CT.Safety.forcing(game).length > 0; // only when the opponent has checks or captures available
    }
    function startGate(mv, before) {
      var my = ++seq;
      gate = { mv: mv, before: before, result: null };
      board.setGame(game, { lastMove: { from: mv.from, to: mv.to }, sound: true });
      var opp = cur.color === 'w' ? 'Black' : 'White';
      gate.html = '<div class="gate"><h3>🛡 Safety check</h3><p>Before <strong>' + esc(mv.san) + '</strong> is played: what is ' + opp + '\'s most dangerous reply?</p>';
      panel.innerHTML = gate.html + '<p class="thinking"><span></span><span></span><span></span> Looking at their replies…</p></div>';
      CT.Voice.say('Safety check. What is ' + opp + "'s most dangerous reply?");
      CT.Safety.check(before, mv.san).then(function (r) {
        if (my !== seq || !gate) return;
        gate.result = r;
        panel.innerHTML = gate.html + '<div class="gate-opts">' + r.options.map(function (o) { return '<button class="btn" data-act="gate-pick" data-san="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') +
          '<button class="btn" data-act="gate-pick" data-san="">Nothing dangerous</button></div><p class="small muted">Think about their checks, captures and threats. Tap a move to see it on the board first if you like — then choose.</p></div>';
      }, function () {
        if (my !== seq || !gate) return;
        var mv2 = gate.mv; gate = null; commitUserMove(mv2); // engine problem: never block the game
      });
    }
    function gatePick(san) {
      var r = gate.result, mv = gate.mv, st = cur.safety;
      st.checks++;
      var dangerSan = r.reply ? r.reply.san : null;
      var arrow = r.reply ? [{ from: r.reply.from, to: r.reply.to, color: 'red' }] : [];
      var lossTxt = r.allowsMate ? 'it allows checkmate' : 'it loses about ' + (Math.round(r.loss / 10) / 10) + ' pawns';
      if (r.unsafe) {
        var caught = san && san === dangerSan;
        if (caught) { st.correct++; st.caught++; } else st.missed++;
        board.setArrows(arrow);
        panel.innerHTML = '<div class="gate ' + (caught ? 'good-i' : 'bad-i') + '"><h3>' + (caught ? '✓ Well spotted' : '⚠ Careful!') + '</h3>' +
          '<p>' + (caught ? 'Yes — ' : 'The real danger is ') + '<strong>' + esc(dangerSan) + '</strong> (red arrow): after ' + esc(mv.san) + ', ' + lossTxt + '.</p>' +
          '<p class="small">This is exactly the check that stops "hope chess". Take the move back and find a safer one.</p>' +
          '<div class="btn-row"><button class="btn primary" data-act="gate-back">Take it back</button><button class="btn" data-act="gate-play">Play it anyway</button></div></div>';
        CT.Voice.say((caught ? 'Well spotted. ' : 'Careful! The danger is ' + dangerSan + '. ') + 'Your move ' + lossTxt + '. Take it back and find a safer move.');
        save();
        return;
      }
      // Safe move.
      var right = !san;
      if (right) st.correct++;
      var note = right ? '<p class="small good">🛡 Safe — nothing dangerous. ✓</p>' :
        '<p class="small">🛡 ' + esc(mv.san) + ' is safe: ' + esc(san) + ' doesn\'t hurt you' + (dangerSan && dangerSan !== san ? ' (their best reply is ' + esc(dangerSan) + ', and you can meet it)' : '') + '. Only flag a reply when it really wins something.</p>';
      gate = null;
      commitUserMove(mv, note);
    }
    function gateBack() {
      cur.safety.saves++;
      game.undo(); gate = null; seq++;
      board.setArrows([]);
      save(); refresh('<p class="small">Move taken back by the safety check. Find a move that keeps everything protected.</p>', false);
    }

    function commitUserMove(mv, note) {
      var ply = cur.moves.length;
      // Opening practice: did you leave your repertoire?
      if (tree && !cur.bookExit) {
        var kids = CT.OpeningTree.childList(tree, cur.moves.join(' '));
        if (kids.length && !kids.some(function (k) { return k.san === mv.san; })) cur.bookExit = { ply: ply, played: mv.san, expected: kids.map(function (k) { return k.san; }) };
      }
      cur.moves.push(mv.san);
      refresh(note);
      if (afterMove(cur.color)) return;
      botMove();
    }

    function botMove() {
      if (over || game.turn() !== botColor) return;
      thinking = true; renderPanel();
      var my = ++seq, t0 = Date.now();
      var fen = game.fen();
      var ready = CT.Stockfish.status().state === 'ready' ? Promise.resolve(true) :
        Promise.race([CT.Stockfish.init(), new Promise(function (r) { setTimeout(function () { r(false); }, 12000); })]);
      ready.then(function (ok) {
        if (!ok && !sfMsg) sfMsg = 'Stockfish is not available, so this opponent uses the built-in Trainer Engine (much weaker than Stockfish). This game won\'t count toward milestones.';
        return O().move({ fen: fen, history: cur.moves.slice(), style: cur.style, level: cur.level, color: botColor, repertoire: cur.rep, useStockfish: !!ok, punishAll: !!cur.punish });
      }).then(function (r) {
        var wait = Math.max(0, 450 - (Date.now() - t0));
        setTimeout(function () {
          if (my !== seq || over) return;
          var mv = game.move(r.san);
          if (!mv) { thinking = false; renderPanel('<p class="bad">The opponent tried an illegal move (' + esc(r.san) + '). Please report this.</p>'); return; }
          var ply = cur.moves.length;
          cur.moves.push(mv.san);
          (r.notes || []).forEach(function (n) { n.ply = ply; cur.notes.push(n); });
          cur.engines[r.engine] = (cur.engines[r.engine] || 0) + 1;
          thinking = false;
          refresh();
          CT.Voice.say(mv.san);
          afterMove(botColor);
        }, wait);
      }).catch(function (err) {
        if (my !== seq) return;
        thinking = false;
        renderPanel('<p class="bad">The opponent could not move: ' + esc(err && err.message) + '</p><button class="btn small" data-act="retry">Try again</button>');
      });
    }

    function takeback() {
      if (gate) { game.undo(); gate = null; seq++; board.setArrows([]); refresh(null, false); return; }
      if (over || !cur.moves.length) return;
      seq++; thinking = false;
      var n = game.turn() === cur.color ? 2 : 1; // your turn: undo the bot's reply and your move
      if (cur.moves.length < n) n = cur.moves.length;
      cur.moves.splice(cur.moves.length - n, n);
      cur.notes = cur.notes.filter(function (x) { return x.ply < cur.moves.length; });
      if (cur.bookExit && cur.bookExit.ply >= cur.moves.length) cur.bookExit = null;
      cur.takebacks++;
      rebuild(); save(); refresh(null, false);
      if (game.turn() === botColor) botMove();
    }

    /* ---------- end of game ---------- */
    function finish(reason, winner) {
      if (over) return;
      over = true; seq++; thinking = false; clearInterval(timer);
      var result = winner === null ? 'draw' : winner === cur.color ? 'win' : 'loss';
      var resultStr = winner === null ? '1/2-1/2' : winner === 'w' ? '1-0' : '0-1';
      var c = new Chess(cur.startFen);
      cur.moves.forEach(function (m) { c.move(m); });
      var d = new Date(), botName = style.name.replace(/^The /, '') + ' (level ' + cur.level + ')';
      var hdr = { Event: 'Practice: ' + style.name, Site: 'Chess Trainer', Date: d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'),
        White: cur.color === 'w' ? 'You' : botName, Black: cur.color === 'b' ? 'You' : botName, Result: resultStr, Termination: reason };
      if (cur.clock) hdr.TimeControl = Math.round(cur.clock.base / 1000) + (cur.clock.inc ? '+' + Math.round(cur.clock.inc / 1000) : '');
      Object.keys(hdr).forEach(function (k) { c.header(k, hdr[k]); });
      var gameId = null;
      if (cur.moves.length >= 2) {
        var added = CT.Games.add(c.pgn());
        if (added.ok) { gameId = added.id; CT.Games.setColor(gameId, cur.color); if (cur.clk) CT.Games.setClocks(gameId, cur.clk); }
      }
      var ex = explain(cur);
      var engine = cur.engines.stockfish ? 'stockfish' : cur.engines.builtin ? 'builtin' : 'book';
      var entry = { style: cur.style, level: cur.level, color: cur.color, result: result, reason: reason, plies: cur.moves.length, gameId: gameId, takebacks: cur.takebacks,
        safetyMode: cur.safetyMode, safety: cur.safetyMode !== 'off' ? cur.safety : null,
        rep: cur.rep, engine: engine, trapsSet: ex.trapsSet, trapsFell: ex.trapsFell, slips: ex.slips, slipsPunished: ex.slipsPunished, slipsMissed: ex.slipsMissed, bookExit: cur.bookExit ? cur.bookExit.ply : null };
      var conv = cur.convert ? { pass: result === 'win' && cur.convert.minLead >= 2 && !cur.takebacks && !(cur.safety && cur.safety.saves), minLead: cur.convert.minLead } : null;
      if (conv) CT.Endgame.recordConvert({ id: cur.convert.id }, conv.pass, { result: result, minLead: conv.minLead });
      else if (cur.moves.length >= 2) S().recordPractice(entry);
      S().state.practiceCurrent = null; S().save();
      CT.Sound.play(result === 'win' ? 'win' : result === 'loss' ? 'bad' : 'good');
      board.setGame(game, { lastMove: lastMove(), sound: false });
      renderClocks();
      var REASON = { checkmate: 'by checkmate', resignation: 'by resignation', time: 'on time', stalemate: '— stalemate', 'insufficient material': '— insufficient material', 'threefold repetition': '— threefold repetition', 'fifty-move rule': '— fifty-move rule' };
      var head = result === 'win' ? '🏆 You won ' : result === 'loss' ? 'You lost ' : 'Draw ';
      var next = CT.Coach.suggestedLevel(cur.style);
      panel.innerHTML = '<div class="explain result-' + result + '"><h2>' + head + esc(REASON[reason] || reason || '') + '</h2>' +
        '<p class="small muted">vs ' + esc(style.name) + ', ' + lvlLabel(cur.level) + ' · ' + cur.moves.length + ' half-moves' + (cur.takebacks ? ' · ' + cur.takebacks + ' takeback(s) — this game does not count toward milestones' : '') + (engine === 'builtin' ? ' · opponent used the built-in engine' : '') + '</p></div>' +
        (cur.safetyMode !== 'off' && cur.safety.checks ? '<p class="small">🛡 Safety checks: <strong>' + cur.safety.correct + '/' + cur.safety.checks + '</strong> right' + (cur.safety.missed ? ' · missed ' + cur.safety.missed + ' real danger' + (cur.safety.missed > 1 ? 's' : '') : '') + (cur.safety.saves ? ' · ' + cur.safety.saves + ' move' + (cur.safety.saves > 1 ? 's' : '') + ' taken back (this game will not count toward milestones)' : '') + '.</p>' : '') +
        (conv ? '<p class="' + (conv.pass ? 'good' : 'bad') + '"><strong>Convert the Win: ' + (conv.pass ? 'passed ✓' : 'not passed') + '.</strong> You started ' + cur.convert.startLead + ' points up; your lead never fell below ' + conv.minLead + (conv.pass ? '.' : (result === 'win' ? ' — it dropped under +2 on the way, so the win was shakier than it looked.' : '. Winning positions need care: trade pieces (not pawns), keep your pieces protected, and check every capture and check your opponent has.')) + '</p>' : '') +
        '<h3 class="mt">What happened</h3>' + (ex.items.length ? '<ul class="happened">' + ex.items.map(function (i) { return '<li class="' + (i.good ? 'good-i' : i.bad ? 'bad-i' : '') + '">' + i.html + '</li>'; }).join('') + '</ul>' : '<p class="small muted">No traps or clear opponent mistakes this game. The full review below finds your own mistakes.</p>') +
        '<p class="small"><strong>What ' + esc(style.name) + ' trains:</strong> ' + esc(style.teaches) + '</p>' +
        '<p class="small muted">Next suggested level vs this opponent: ' + lvlLabel(next) + '.</p>' +
        '<div class="btn-row">' + (gameId ? '<a class="btn primary" href="#/analysis/game/' + gameId + '/auto">Full engine review &amp; coaching report</a>' : '') +
        (conv ? '<a class="btn" href="#/endgames/convert/go">Next conversion</a><a class="btn" href="#/endgames">Endgame Academy</a></div>' : '<button class="btn" data-act="again">Play again</button><a class="btn" href="#/practice">Change opponent</a></div>');
      listEl.innerHTML = UI.moveListHtml(cur.moves, 'w', cur.moves.length - 1);
      CT.Voice.say(head + (REASON[reason] || reason || '') + '. ' + (ex.items[0] ? ex.items[0].html : 'Tap Full engine review to see your mistakes.'));
      lastGame = conv ? null : { style: cur.style, level: next, color: cur.color, rep: cur.rep, clock: cur.clock, safetyMode: cur.safetyMode, punish: cur.punish };
    }
    var lastGame = null;

    /* ---------- events ---------- */
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'flip') board.flip();
      if (a === 'takeback') takeback();
      if (a === 'resign' && !over && cur.moves.length) { confirmResign = true; renderPanel(); }
      if (a === 'resign' && !over && !cur.moves.length) { S().state.practiceCurrent = null; S().save(); location.hash = '#/practice'; }
      if (a === 'resign-no') { confirmResign = false; renderPanel(); }
      if (a === 'resign-yes') { confirmResign = false; finish('resignation', botColor); }
      if (a === 'retry') botMove();
      if (a === 'gate-pick' && gate && gate.result) gatePick(b.dataset.san);
      if (a === 'gate-back' && gate) gateBack();
      if (a === 'gate-play' && gate) { var gm = gate.mv; gate = null; board.setArrows([]); commitUserMove(gm); }
      if (a === 'again' && lastGame) {
        S().state.practiceCurrent = {
          style: lastGame.style, level: lastGame.level, color: lastGame.color, rep: lastGame.rep, clock: lastGame.clock, startFen: CT.Chess.DEFAULT_FEN, moves: [], notes: [],
          times: lastGame.clock ? { w: lastGame.clock.base, b: lastGame.clock.base } : null, takebacks: 0, engines: {}, startedAt: Date.now(), bookExit: null,
          safetyMode: lastGame.safetyMode, safety: { checks: 0, correct: 0, caught: 0, missed: 0, saves: 0 }, punish: lastGame.punish
        };
        S().save(); CT.App.rerender();
      }
    });
    CT.Annotate.bind(panel, function () { return board; });

    rebuild();
    refresh(cur.moves.length ? '<p class="small muted">Game resumed.</p>' : cur.convert ? '<p class="small"><strong>Convert the Win.</strong> You play ' + UI.sideName(cur.color) + ' and you are ' + cur.convert.startLead + ' points of material up. Win the game without letting your lead fall below +2 (no takebacks). Your opponent moves first.</p>' : '<p class="small">You play ' + UI.sideName(cur.color) + '. Good luck!</p>', false);
    CT.Voice.say(cur.moves.length ? 'Game resumed.' : 'You play ' + UI.sideName(cur.color) + ' against ' + style.name + '. Good luck!');
    if (cur.clock) timer = setInterval(tick, 200);
    if (game.isGameOver()) finish(game.isCheckmate() ? 'checkmate' : game.gameOverReason(), game.isCheckmate() ? (game.turn() === 'w' ? 'b' : 'w') : null);
    else if (game.turn() === botColor) botMove();
    return function () { seq++; clearInterval(timer); if (!over) save(); };
  }

  /* ======================= "What happened" ======================= */
  /** Turn the opponent's notes (traps, slips, book moves) into plain-language findings. Pure function (tested). */
  function explain(cur) {
    var h = cur.moves, items = [], out = { trapsSet: 0, trapsFell: 0, slips: 0, slipsPunished: 0, slipsMissed: 0 };
    var seenTrap = {};
    var QUICK = ' <span class="muted">(quick check by the built-in engine)</span>';
    cur.notes.forEach(function (n) {
      var next = h[n.ply + 1], at = moveNo(n.ply) + ' ' + n.san, q = n.quick ? QUICK : '';
      if (n.kind === 'trap' && next) {
        out.trapsSet++;
        if (next === n.bait) {
          out.trapsFell++;
          items.push({ bad: true, html: 'Trap at <b>' + esc(at) + '</b>: capturing with <b>' + esc(n.bait) + '</b> looked free, but ' + (n.punish ? '<b>' + esc(n.punish) + '</b>' : 'the reply') + ' punished it (about ' + n.loss + ' pawns). You took the bait. Lesson: before grabbing, ask why your opponent allowed it.' + q });
        } else items.push({ good: true, html: 'Trap at <b>' + esc(at) + '</b>: <b>' + esc(n.bait) + '</b> would have lost about ' + n.loss + ' pawns' + (n.punish ? ' (after ' + esc(n.punish) + ')' : '') + '. You didn\'t take the bait ✓' + q });
      }
      if (n.kind === 'book-trap' && !seenTrap[n.trap.id]) {
        var vp = n.trap.victimPly;
        if (h.length > vp) {
          seenTrap[n.trap.id] = true; out.trapsSet++;
          var link = '<a href="' + n.trap.href + '">' + esc(n.trap.name) + '</a>';
          if (h[vp] === n.trap.victimMove) { out.trapsFell++; items.push({ bad: true, html: 'The opponent steered into the ' + link + ' and you fell for it with <b>' + moveNo(vp) + ' ' + esc(n.trap.victimMove) + '</b>. Study it in the Deception Lab so it never works again.' }); }
          else items.push({ good: true, html: 'The opponent tried the ' + link + ' (' + n.trap.soundness + ' trap). The losing move was ' + moveNo(vp) + ' ' + esc(n.trap.victimMove) + ' — you played ' + esc(h[vp]) + ' instead ✓' });
        }
      }
      if (n.kind === 'slip' && next) {
        out.slips++;
        if (n.punish && next === n.punish) { out.slipsPunished++; items.push({ good: true, html: 'Opponent\'s mistake at <b>' + esc(at) + '</b> (better was ' + esc(n.best) + '). You punished it with <b>' + esc(next) + '</b> ✓' + q }); }
        else if (n.punish) { out.slipsMissed++; items.push({ bad: true, html: 'Opponent\'s mistake at <b>' + esc(at) + '</b> (it cost them about ' + n.loss + ' pawns). The punishment was <b>' + esc(n.punish) + '</b>; you played ' + esc(next) + '. Always ask after their move: what did that move leave undefended?' + q }); }
      }
      if (n.kind === 'book-mistake' && next && cur.rep && CT.OpeningTree) {
        var tree = CT.OpeningTree.build(cur.rep), kids = CT.OpeningTree.childList(tree, h.slice(0, n.ply + 1).join(' '));
        if (kids.length) {
          var right = kids.some(function (k) { return k.san === next; });
          out.slips++; if (right) out.slipsPunished++; else out.slipsMissed++;
          items.push(right ? { good: true, html: 'At <b>' + esc(at) + '</b> the opponent played a common mistake from your repertoire. You punished it with <b>' + esc(next) + '</b> ✓' }
            : { bad: true, html: 'At <b>' + esc(at) + '</b> the opponent played a common mistake. Your prepared punishment was <b>' + esc(kids[0].san) + '</b>; you played ' + esc(next) + '.' });
        }
      }
    });
    if (cur.rep && cur.bookExit) items.unshift({ bad: true, html: 'You left your repertoire at <b>' + moveNo(cur.bookExit.ply) + ' ' + esc(cur.bookExit.played) + '</b>; your prepared move was <b>' + esc(cur.bookExit.expected.join(' / ')) + '</b>.' });
    else if (cur.rep && h.length > 6) items.unshift({ good: true, html: 'You followed your repertoire for as long as it went ✓' });
    out.items = items;
    return out;
  }

  function safetyLine() {
    var sc = CT.Safety.score(5);
    return sc.score == null ? 'Your Safety Score appears after a few games.' : 'Your Safety Score (last ' + sc.games + ' games): <strong>' + Math.round(sc.score * 100) + '%</strong>' + (sc.score >= 0.9 && sc.games >= 5 ? ' — excellent. Try "Off" now and keep the habit in your head.' : '.');
  }

  CT.Views = CT.Views || {};
  CT.Views.practice = setup;
  CT.Views.practicePlay = play;
  CT.Practice = { explain: explain, CLOCKS: CLOCKS };
})(typeof window !== 'undefined' ? window : globalThis);
