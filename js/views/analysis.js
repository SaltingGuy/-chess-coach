/* Game Analysis: import (paste / file / chess.com), game review with engine + coaching report,
   game database (search, filters), and recurring patterns across your games. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  var DEPTHS = [['12', 'Quick'], ['16', 'Standard'], ['20', 'Deep']];

  function tabs(active) {
    return '<header class="page-head"><div><h1>Game Analysis</h1><p class="muted">Import your games, get an engine review in plain language, and turn your own mistakes into training.</p></div>' +
      '<div class="engine-chip" data-engine></div></header>' +
      '<div class="seg page-tabs">' + [['', 'Import'], ['games', 'My games'], ['patterns', 'Patterns']].map(function (t) {
        return '<a class="' + (t[0] === active ? 'on' : '') + '" href="#/analysis' + (t[0] ? '/' + t[0] : '') + '">' + t[1] + '</a>';
      }).join('') + '</div>';
  }

  /* ---------- engine status chip ---------- */
  function bindEngineChip(view) {
    var el = view.querySelector('[data-engine]');
    if (!el) return;
    function draw(st) {
      st = st || CT.Stockfish.status();
      var txt = { idle: 'Stockfish: not loaded yet', loading: 'Loading Stockfish…', ready: '✓ ' + (st.name || 'Stockfish') + ' ready', failed: 'Stockfish unavailable — using built-in engine' }[st.state];
      el.className = 'engine-chip ' + st.state;
      el.innerHTML = '<span>' + esc(txt) + '</span><button class="btn small" data-act="engine-test">Test engine</button>';
      el.title = st.state === 'failed' ? (st.error || '') : (st.source ? 'Source: ' + st.source : '');
    }
    CT.Stockfish.on(draw);
    draw();
    el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act=engine-test]')) return;
      var t0 = performance.now();
      el.querySelector('span').textContent = 'Testing…';
      CT.Stockfish.init().then(function (ok) {
        if (!ok) { draw(); UI.toast('Stockfish could not load (' + (CT.Stockfish.status().error || 'unknown reason') + '). Analysis will use the built-in engine.'); return; }
        return CT.Stockfish.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 12 }).then(function (r) {
          var l = r.lines[1] || {};
          draw();
          UI.toast(CT.Stockfish.status().name + ': depth ' + r.depth + ' in ' + ((performance.now() - t0) / 1000).toFixed(1) + 's · best reply ' + CT.Analyzer.uciToSan('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', r.bestmove) + ' (' + (l.cp != null ? (l.cp / 100).toFixed(2) : 'mate') + ')');
        });
      });
    });
  }

  /* ---------- Import ---------- */
  function importView(view) {
    var prof = CT.Store.state.profile;
    view.innerHTML = tabs('') +
      '<section class="grid-2">' +
      '<div class="card"><h2>Paste games (PGN)</h2>' +
        '<p class="small muted">Paste one game or many. Comments and clock times from chess.com or Lichess are fine.</p>' +
        '<textarea class="pgn-in" rows="9" spellcheck="false" placeholder="[Event &quot;Live Chess&quot;]&#10;[Site &quot;Chess.com&quot;]&#10;...&#10;1. e4 e5 2. Nc3 Nf6 3. f4 ..."></textarea>' +
        '<div class="btn-row"><button class="btn primary" data-act="import">Import</button><label class="btn file-btn">Upload .pgn file<input type="file" accept=".pgn,text/plain" class="pgn-file" hidden></label></div>' +
        '<div class="import-msg"></div></div>' +
      '<div class="card"><h2>Your chess.com games</h2>' +
        '<label class="field">Your chess.com username<input type="text" class="cc-user" value="' + esc(prof.chesscomUser || '') + '" placeholder="e.g. your_username" autocomplete="off" autocapitalize="off"></label>' +
        '<label class="check"><input type="checkbox" class="cc-auto"' + (prof.ccAuto !== false ? ' checked' : '') + '> Load my new games automatically when I open the app</label>' +
        '<p class="small muted">No password needed — chess.com publishes finished games by username. Works when the app runs as its own website (or from downloaded files); the claude.ai link blocks outside connections, so paste PGNs there.</p>' +
        '<div class="btn-row"><button class="btn primary" data-act="sync">Sync now</button><button class="btn" data-act="saveuser">Save</button><button class="btn" data-act="fetch">Pick games…</button></div>' +
        '<p class="small muted cc-status">' + esc(CT.ChessCom.statusText()) + '</p>' +
        '<div class="cc-list"></div>' +
        '<details class="tool"><summary>How to copy a game from chess.com</summary><ol class="small">' +
          '<li>Open the game on chess.com (Profile → Games, or the game you just finished).</li>' +
          '<li>Tap the <strong>Share</strong> button (arrow icon) under the board.</li>' +
          '<li>Choose the <strong>PGN</strong> tab and tap <strong>Copy PGN</strong>.</li>' +
          '<li>Paste it into the box on this page and press Import.</li>' +
          '<li>Many games at once: chess.com → Games → <strong>Archive</strong> → select games → <strong>Download</strong>, then upload the .pgn file here.</li></ol></details>' +
      '</div></section>';
    bindEngineChip(view);
    var msg = view.querySelector('.import-msg');

    function importText(text) {
      var parts = CT.Chess.splitPgn(text);
      if (!parts.length) { msg.innerHTML = '<p class="bad">Nothing to import — paste a PGN first.</p>'; return; }
      var ok = [], errs = [], dup = 0;
      parts.forEach(function (p, i) {
        var r = CT.Games.add(p);
        if (r.ok) { if (r.duplicate) dup++; else ok.push(r.id); } else errs.push('Game ' + (i + 1) + ': ' + r.error);
      });
      if (ok.length === 1 && !errs.length) { location.hash = '#/analysis/game/' + ok[0]; return; }
      msg.innerHTML = '<p class="' + (ok.length ? 'good' : 'bad') + '">Imported ' + ok.length + ' game' + (ok.length === 1 ? '' : 's') + (dup ? ' (' + dup + ' already saved)' : '') + '.</p>' +
        (errs.length ? '<ul class="small bad">' + errs.slice(0, 5).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
        (ok.length ? '<a class="btn small" href="#/analysis/games">Go to My games</a>' : '');
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'import') importText(view.querySelector('.pgn-in').value);
      if (a === 'saveuser' || a === 'fetch' || a === 'sync') {
        var u = view.querySelector('.cc-user').value.trim();
        CT.Store.state.profile.chesscomUser = u; CT.Store.state.profile.ccAuto = view.querySelector('.cc-auto').checked; CT.Store.save();
        if (a === 'saveuser') { UI.toast(u ? 'Saved' : 'Username cleared'); return; }
        if (!u) { UI.toast('Enter your chess.com username first.'); return; }
        if (a === 'fetch') { fetchChessCom(u, view.querySelector('.cc-list')); return; }
        var st = view.querySelector('.cc-status');
        st.textContent = 'Contacting chess.com…'; b.disabled = true;
        CT.ChessCom.sync().then(function (res) {
          b.disabled = false;
          st.textContent = CT.ChessCom.statusText();
          if (res.ok) msg.innerHTML = '<p class="good">' + (res.added.length ? res.added.length + ' new game' + (res.added.length > 1 ? 's' : '') + ' added.' : 'You are up to date — no new games.') + '</p>' +
            (res.added.length ? '<a class="btn small primary" href="#/analysis/games">Review them</a>' : '');
        });
      }
      if (a === 'cc-import') {
        var picked = Array.prototype.slice.call(view.querySelectorAll('.cc-pick:checked')).map(function (c) { return view._ccGames[+c.value].pgn; });
        importText(picked.join('\n\n'));
      }
    });
    view.querySelector('.pgn-file').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (f) f.text().then(importText);
    });

    function fetchChessCom(user, out) {
      out.innerHTML = '<p class="muted small">Contacting chess.com…</p>';
      var base = 'https://api.chess.com/pub/player/' + encodeURIComponent(user.toLowerCase());
      fetch(base + '/games/archives').then(function (r) {
        if (r.status === 404) throw new Error('No chess.com player called "' + user + '".');
        if (!r.ok) throw new Error('chess.com answered with an error (' + r.status + ').');
        return r.json();
      }).then(function (j) {
        var months = (j.archives || []).slice(-2).reverse();
        if (!months.length) throw new Error('No games found for this player.');
        return Promise.all(months.map(function (u) { return fetch(u).then(function (r) { return r.json(); }); }));
      }).then(function (lists) {
        var all = [];
        lists.forEach(function (l) { (l.games || []).forEach(function (g) { if (g.pgn && (!g.rules || g.rules === 'chess')) all.push(g); }); });
        all.sort(function (a, b) { return (b.end_time || 0) - (a.end_time || 0); });
        all = all.slice(0, 30);
        view._ccGames = all;
        if (!all.length) { out.innerHTML = '<p class="muted">No standard games in the last two months.</p>'; return; }
        out.innerHTML = '<p class="small">Pick games to import (newest first):</p><ul class="cc-games">' + all.map(function (g, i) {
          var me = g.white.username.toLowerCase() === user.toLowerCase() ? 'w' : 'b';
          var opp = me === 'w' ? g.black : g.white, res = (me === 'w' ? g.white : g.black).result;
          var outcome = res === 'win' ? 'Won' : /agreed|repetition|stalemate|insufficient|50move|timevsinsufficient/.test(res) ? 'Draw' : 'Lost';
          return '<li><label><input type="checkbox" class="cc-pick" value="' + i + '"' + (i < 5 ? ' checked' : '') + '> ' +
            '<span class="tag ' + (outcome === 'Won' ? 'ok' : outcome === 'Lost' ? 'bad' : '') + '">' + outcome + '</span> vs ' + esc(opp.username) + ' (' + esc(String(opp.rating)) + ') · ' + esc(g.time_class || '') +
            ' · ' + new Date((g.end_time || 0) * 1000).toLocaleDateString() + '</label></li>';
        }).join('') + '</ul><button class="btn primary" data-act="cc-import">Import selected</button>';
      }).catch(function (err) {
        var blocked = err instanceof TypeError;
        out.innerHTML = '<p class="bad">' + esc(blocked ? 'Could not reach chess.com from here.' : err.message) + '</p>' +
          (blocked ? '<p class="small">If you are using the claude.ai link, outside connections are blocked — copy the PGN from chess.com instead (see "How to copy a game"), or open the app from your downloaded files. Otherwise, check your internet connection.</p>' : '');
      });
    }
  }

  /* ---------- Game list (database) ---------- */
  function gamesView(view) {
    var all = CT.Games.list();
    var motifs = {};
    all.forEach(function (g) { if (g.report) Object.keys(g.report.motifCounts || {}).forEach(function (k) { motifs[k] = true; }); });
    view.innerHTML = tabs('games') +
      '<section class="card"><div class="row-between wrap"><input type="search" class="trap-search g-search" placeholder="Search opponent, opening, date…"><div class="btn-row"><button class="btn small" data-act="exportall">Copy all as PGN</button></div></div>' +
      '<div class="chips">' + ['all', 'won', 'lost', 'drew', 'unanalysed'].map(function (f, i) { return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-filter="' + f + '">' + f[0].toUpperCase() + f.slice(1) + '</button>'; }).join('') +
      Object.keys(motifs).map(function (k) { return '<button class="chip" data-motif="' + k + '">' + esc(CT.Analysis.MOTIF_NAME[k]) + '</button>'; }).join('') + '</div>' +
      '<ul class="game-list"></ul></section>';
    bindEngineChip(view);
    var listEl = view.querySelector('.game-list'), search = view.querySelector('.g-search'), filter = 'all', motif = null;
    function draw() {
      var q = search.value.trim().toLowerCase();
      var items = CT.Games.list().filter(function (g) {
        var r = g.report;
        if (filter === 'unanalysed' && g.analysis) return false;
        if (['won', 'lost', 'drew'].indexOf(filter) >= 0 && (!r || r.outcome !== filter)) return false;
        if (motif && (!r || !(r.motifCounts || {})[motif])) return false;
        if (!q) return true;
        var h = g.headers || {};
        return [h.White, h.Black, h.Date, g.opening, h.Event].join(' ').toLowerCase().indexOf(q) >= 0;
      });
      listEl.innerHTML = items.length ? items.map(function (g) {
        var h = g.headers || {}, r = g.report, c = g.analysis && g.userColor ? CT.Games.countsOf(g)[g.userColor] : null;
        return '<li><a href="#/analysis/game/' + g.id + '"><strong>' + esc(h.White || 'White') + ' – ' + esc(h.Black || 'Black') + '</strong></a> ' +
          (r ? '<span class="tag ' + (r.outcome === 'won' ? 'ok' : r.outcome === 'lost' ? 'bad' : '') + '">' + r.outcome + '</span>' : (g.analysis ? '' : '<span class="tag">not analysed</span>')) +
          '<p class="small muted">' + esc(g.opening) + ' · ' + esc(h.Date || '') + (r ? ' · accuracy ' + Math.round(r.accuracy || 0) + '%' : '') + (c ? ' · ' + c.blunder + ' blunder' + (c.blunder === 1 ? '' : 's') : '') + '</p>' +
          '<div class="line-actions"><a class="btn small" href="#/analysis/game/' + g.id + '">' + (g.analysis ? 'Review' : 'Analyse') + '</a><button class="btn small" data-del="' + g.id + '">Delete</button></div></li>';
      }).join('') : '<li class="muted">' + (all.length ? 'No games match.' : 'No games yet — import some on the Import tab.') + '</li>';
    }
    search.addEventListener('input', draw);
    view.addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (c) {
        if (c.dataset.filter) { filter = c.dataset.filter; motif = null; } else { motif = motif === c.dataset.motif ? null : c.dataset.motif; filter = 'all'; }
        view.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', (x.dataset.filter && x.dataset.filter === filter && !motif) || (x.dataset.motif && x.dataset.motif === motif)); });
        draw(); return;
      }
      var d = e.target.closest('[data-del]');
      if (d) {
        if (d.dataset.confirm) { CT.Games.remove(d.dataset.del); draw(); UI.toast('Game deleted'); }
        else { d.dataset.confirm = '1'; d.textContent = 'Tap again to delete'; }
        return;
      }
      if (e.target.closest('[data-act=exportall]')) UI.copy(CT.Games.exportPgn());
    });
    draw();
  }

  /* ---------- Patterns across games ---------- */
  function patternsView(view) {
    var p = CT.Games.patterns(10);
    var analysed = CT.Games.list().filter(function (g) { return g.report; }).slice(0, 20).reverse();
    var worst = [];
    CT.Games.list().forEach(function (g) {
      if (!g.analysis || !g.userColor) return;
      g.analysis.moves.forEach(function (m, ply) {
        var color = (ply % 2 === 0) === (g.startFen.split(' ')[1] === 'w') ? 'w' : 'b';
        if (color === g.userColor && m.loss >= 20) worst.push({ g: g, ply: ply, loss: m.loss, text: m.explanation, san: g.moves[ply] });
      });
    });
    worst.sort(function (a, b) { return b.loss - a.loss; });
    view.innerHTML = tabs('patterns') +
      '<section class="grid-2"><div class="card"><h2>Recurring weaknesses</h2>' +
        (p.games < 2 ? '<p class="muted">Analyse at least two games (and tell the app which colour you played) to see recurring patterns.</p>' :
          (p.insights.length ? '<ul class="insights">' + p.insights.map(function (i) {
            var link = i.theme ? '#/tactics/train/' + i.theme : i.href;
            return '<li><p>' + esc(i.text) + '</p>' + (link ? '<a class="btn small" href="' + link + '">Train it</a>' : '') + '</li>';
          }).join('') + '</ul>' : '<p>No pattern has repeated across your last ' + p.games + ' games. Nice — keep it up.</p>')) +
        (p.blundersPerGame != null ? '<p class="small muted">Blunders per game (last ' + p.games + '): <strong>' + p.blundersPerGame.toFixed(1) + '</strong></p>' : '') + '</div>' +
      '<div class="card"><h2>Are you improving?</h2>' + trendChart(analysed) + '</div></section>' +
      '<section class="card"><h2>Your worst mistakes</h2>' + (worst.length ? '<ul class="plist">' + worst.slice(0, 10).map(function (w) {
        var h = w.g.headers || {};
        return '<li><a href="#/analysis/game/' + w.g.id + '/' + w.ply + '"><strong>' + Math.floor(w.ply / 2 + 1) + (w.ply % 2 ? '… ' : '. ') + esc(w.san) + '</strong></a> <span class="small muted">vs ' + esc((w.g.userColor === 'w' ? h.Black : h.White) || '?') + ' · −' + Math.round(w.loss) + '% winning chances</span><p class="small">' + esc(w.text || '') + '</p></li>';
      }).join('') + '</ul>' : '<p class="muted">No big mistakes recorded yet.</p>') + '</section>';
    bindEngineChip(view);
  }

  function trendChart(games) {
    if (games.length < 2) return '<p class="muted">Analyse a few games to see your accuracy trend.</p>';
    var W = 320, H = 140, pad = 24;
    var pts = games.map(function (g, i) { return { x: pad + i * (W - 2 * pad) / (games.length - 1), y: H - pad - (g.report.accuracy || 0) / 100 * (H - 2 * pad), a: g.report.accuracy, b: CT.Games.countsOf(g)[g.userColor].blunder }; });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Accuracy over your last games">' +
      [25, 50, 75].map(function (v) { var y = H - pad - v / 100 * (H - 2 * pad); return '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="2" y="' + (y + 3) + '">' + v + '%</text>'; }).join('') +
      '<path d="' + path + '" class="line"/>' + pts.map(function (p) { return '<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5"><title>' + Math.round(p.a) + '% accuracy, ' + p.b + ' blunders</title></circle>'; }).join('') +
      '</svg><p class="small muted">Accuracy in your last ' + games.length + ' analysed games (oldest → newest).</p>';
  }

  /* ---------- Single game review ---------- */
  function gameView(view, id, startPly) {
    var g = CT.Games.get(id), auto = startPly === 'auto';
    if (auto) startPly = null;
    if (!g) { view.innerHTML = '<p>Game not found. <a href="#/analysis/games">My games</a></p>'; return; }
    var Chess = CT.Chess, board, result = CT.Games.expand(g), ply = startPly != null ? +startPly + 1 : 0, job = null, tab = 'report';
    var h = g.headers || {};
    // Counts toward the Play-day "Review the game" item (once per game per day).
    var rv = CT.Store.state.reviewed, dk = CT.Store.dayKey();
    if (!rv || rv.date !== dk) rv = CT.Store.state.reviewed = { date: dk, ids: {} };
    if (!rv.ids[id]) { rv.ids[id] = 1; CT.Store.bumpDay('reviews'); }

    view.innerHTML = '<a class="back" href="#/analysis/games">← My games</a>' +
      '<div class="row-between wrap"><h1 class="lesson-title">' + esc(h.White || 'White') + ' – ' + esc(h.Black || 'Black') + ' <span class="muted small">' + esc(h.Result || '') + '</span></h1><div class="engine-chip" data-engine></div></div>' +
      '<p class="small muted">' + esc(g.opening) + (h.Date ? ' · ' + esc(h.Date) : '') + (h.TimeControl ? ' · ' + esc(h.TimeControl) : '') + '</p>' +
      '<div class="trainer"><div class="board-col"><div class="evalbar"><span></span><b></b></div><div class="board-host"></div>' +
      '<div class="nav-row"><button class="btn" data-act="first">⏮</button><button class="btn" data-act="prev">◀</button><button class="btn" data-act="next">▶</button><button class="btn" data-act="last">⏭</button><button class="btn" data-act="flip">⇅</button></div>' +
      '<div class="graph-host"></div></div>' +
      '<aside class="panel"><div class="panel-body"></div></aside></div>';
    bindEngineChip(view);
    var panel = view.querySelector('.panel-body');
    board = new CT.Board(view.querySelector('.board-host'), { orientation: g.userColor || 'w', canMove: function () { return false; } });
    CT.Annotate.bind(panel, function () { return board; });

    function positionAt(n) { var c = new Chess(g.startFen); for (var i = 0; i < n; i++) c.move(g.moves[i]); return c; }

    function showBoard() {
      var c = positionAt(ply), arrows = [];
      var m = result && ply > 0 ? result.moves[ply - 1] : null;
      var last = ply > 0 ? c.history({ verbose: true }).pop() : null;
      board.setGame(c, { lastMove: last ? { from: last.from, to: last.to } : null });
      if (m) {
        var bad = ['blunder', 'mistake', 'inaccuracy'].indexOf(m.cls) >= 0;
        arrows.push({ from: m.from, to: m.to, color: bad ? (m.cls === 'inaccuracy' ? 'yellow' : 'red') : 'green' });
        if (bad && m.best) { var bm = new Chess(m.fenBefore).move(m.best); if (bm) arrows.push({ from: bm.from, to: bm.to, color: 'green' }); }
        if (bad && m.lessonKind === 'threat' && m.reply) { var rm = new Chess(m.fenAfter).move(m.reply); if (rm) arrows.push({ from: rm.from, to: rm.to, color: 'blue' }); }
      } else if (!m && last) arrows.push({ from: last.from, to: last.to, color: 'green' });
      board.setArrows(arrows);
      // Eval bar
      var bar = view.querySelector('.evalbar');
      if (result) {
        var ev = result.evals[ply], w = CT.Analysis.winPct(ev);
        bar.querySelector('span').style.width = w + '%';
        bar.querySelector('b').textContent = CT.Analysis.fmtEval(ev);
        bar.classList.add('on');
      }
      drawGraph();
    }

    function drawGraph() {
      var host = view.querySelector('.graph-host');
      var tsum = CT.TimeUse ? CT.TimeUse.summary(g, result) : null, timeHtml = tsum ? CT.TimeUse.chartHtml(tsum) : '';
      if (!result) { host.innerHTML = timeHtml; bindTime(host); return; }
      var W = 600, H = 90, n = result.evals.length;
      var pts = result.evals.map(function (e, i) { return [i * W / Math.max(1, n - 1), H - CT.Analysis.winPct(e) / 100 * H]; });
      var area = 'M0 ' + H + ' ' + pts.map(function (p) { return 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' L' + W + ' ' + H + ' Z';
      var marks = result.moves.map(function (m, i) {
        if (m.cls !== 'blunder' && m.cls !== 'mistake') return '';
        var p = pts[i + 1];
        return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" class="mk ' + m.cls + (m.color === g.userColor ? ' mine' : '') + '"/>';
      }).join('');
      var cx = ply * W / Math.max(1, n - 1);
      host.innerHTML = '<svg class="evalgraph" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-label="Evaluation graph"><rect width="' + W + '" height="' + H + '" class="bg"/><path d="' + area + '" class="area"/><line x1="0" x2="' + W + '" y1="' + H / 2 + '" y2="' + H / 2 + '" class="mid"/>' + marks + '<line x1="' + cx + '" x2="' + cx + '" y1="0" y2="' + H + '" class="cursor"/></svg>' +
        '<p class="small muted">White\'s winning chances over the game. Red dots = blunders, orange = mistakes. Tap the graph to jump.</p>' + timeHtml;
      bindTime(host);
      host.querySelector('svg').onclick = function (e) {
        var r = e.currentTarget.getBoundingClientRect();
        ply = Math.round((e.clientX - r.left) / r.width * (n - 1)); ply = Math.max(0, Math.min(n - 1, ply)); showBoard(); renderPanel();
      };
    }

    function bindTime(host) {
      var tc = host.querySelector('.timechart');
      if (tc) tc.onclick = function (e) { var r = e.target.closest('rect'); if (r) { ply = +r.getAttribute('data-ply'); showBoard(); renderPanel(); } };
    }

    function renderPanel() {
      if (!g.userColor) {
        var guess = CT.Games.detectColor(h);
        panel.innerHTML = '<h2>Which side were you?</h2><p>So the report can focus on your moves.</p><div class="btn-row"><button class="btn' + (guess === 'w' ? ' primary' : '') + '" data-color="w">White (' + esc(h.White || '?') + ')</button><button class="btn' + (guess === 'b' ? ' primary' : '') + '" data-color="b">Black (' + esc(h.Black || '?') + ')</button></div>' +
          '<p class="small muted">Tip: save your chess.com username on the Import tab and this is detected automatically.</p>';
        return;
      }
      if (!result) {
        if (job) return;
        panel.innerHTML = '<h2>Analyse this game</h2><p>The engine checks every move (' + g.moves.length + ' half-moves). With Stockfish this usually takes 1–4 minutes; the built-in engine is faster but much weaker.</p>' +
          '<label class="field">Depth<select class="depth">' + DEPTHS.map(function (d) { return '<option value="' + d[0] + '"' + (d[0] === '16' ? ' selected' : '') + '>' + d[1] + ' (depth ' + d[0] + ')</option>'; }).join('') + '</select></label>' +
          '<div class="btn-row"><button class="btn primary" data-act="analyse">Analyse with Stockfish</button><button class="btn" data-act="analyse-builtin">Quick check (built-in engine)</button></div>';
        return;
      }
      var tabsHtml = '<div class="seg small-seg"><a class="' + (tab === 'report' ? 'on' : '') + '" data-tab="report">Coach report</a><a class="' + (tab === 'moves' ? 'on' : '') + '" data-tab="moves">Moves</a></div>';
      var engineNote = result.source === 'builtin' ? '<p class="warnbox small">Analysed with the built-in Trainer Engine (about a quarter-second per move, much weaker than Stockfish). For a reliable review press <strong>Re-analyse</strong> once Stockfish is available.</p>' : '<p class="small muted">Engine: ' + esc(result.engine) + '</p>';
      panel.innerHTML = tabsHtml + (tab === 'report' ? reportHtml() : movesHtml()) + engineNote +
        '<div class="btn-row"><button class="btn small" data-act="reanalyse">Re-analyse</button><button class="btn small" data-act="copypgn">Copy PGN</button><button class="btn small" data-act="swapcolor">I was ' + (g.userColor === 'w' ? 'Black' : 'White') + '</button></div>';
      var cur = panel.querySelector('.mv.cur');
      if (cur && tab === 'moves') cur.scrollIntoView({ block: 'nearest' });
    }

    function moveLink(m, label) { return m ? '<button class="btn small jump" data-ply="' + (m.ply + 1) + '">' + (label || 'Show') + '</button>' : ''; }
    function moveName(m) { return m.moveNo + (m.color === 'w' ? '. ' : '… ') + m.san; }

    function reportHtml() {
      var rep = g.report;
      if (!rep) return '<p>Choose your colour to see the report.</p>';
      var M = function (r) { return r && r.ply != null ? result.moves[r.ply] : null; };
      var big = M(rep.biggestMistake), opp = M(rep.opponentMistake), miss = M(rep.missedOpportunity);
      var ex = rep.exercises.map(function (id) { return CT.Coach.puzzleById(id); }).filter(Boolean);
      var ann = function (t, m) { return CT.Annotate.annotate(t || '', m ? m.fenBefore : null).html; };
      var think = CT.Think && !CT.Think.done(g.id) && CT.Think.moments(g).length ?
        '<div class="think-call"><strong>🧠 Think first?</strong> Before reading the engine\'s verdict, replay your ' + CT.Think.moments(g).length + ' turning point' + (CT.Think.moments(g).length > 1 ? 's' : '') + ' and find the better move yourself — it sticks far better.<div class="btn-row"><a class="btn primary small" href="#/analysis/think/' + g.id + '">Think first ▶</a></div></div>' : '';
      return think + '<ol class="report">' +
        '<li><h3>Summary</h3><p>' + esc(rep.summary) + '</p><div class="acc-row"><span>You <b>' + Math.round(rep.accuracy || 0) + '%</b></span><span>Opponent <b>' + Math.round(rep.oppAccuracy || 0) + '%</b></span></div></li>' +
        '<li><h3>Your biggest mistake</h3>' + (big ? '<p><strong>' + esc(moveName(big)) + '</strong> ' + ann(big.explanation, big) + '</p>' + moveLink(big) : '<p>No real mistakes — excellent.</p>') + '</li>' +
        '<li><h3>Your opponent\'s biggest mistake</h3>' + (opp ? '<p><strong>' + esc(moveName(opp)) + '</strong> ' + ann(opp.explanation, opp) + '</p>' + moveLink(opp) : '<p>Your opponent played cleanly.</p>') + '</li>' +
        '<li><h3>The most important missed opportunity</h3>' + (miss ? '<p><strong>' + esc(moveName(miss)) + '</strong> — you could have played <strong>' + esc(miss.best) + '</strong>. ' + ann(miss.explanation, miss) + '</p>' + moveLink(miss) : '<p>None — you took your chances.</p>') + '</li>' +
        '<li><h3>Tactical pattern to recognise</h3><p>' + esc(rep.pattern.text) + '</p>' + (rep.pattern.theme ? '<a class="btn small" href="#/tactics/theme/' + rep.pattern.theme + '">Study it</a>' : '') + '</li>' +
        '<li><h3>Opening lesson</h3><p>' + ann(rep.opening.text) + '</p>' + (rep.opening.line ? '<a class="btn small" href="#/openings/' + rep.opening.line + '/learn">Review the line</a>' : '') + '</li>' +
        '<li><h3>Middlegame lesson</h3><p>' + ann(rep.middlegame.text, rep.middlegame.ply != null ? result.moves[rep.middlegame.ply] : null) + '</p>' + (rep.middlegame.ply != null ? moveLink(result.moves[rep.middlegame.ply]) : '') + '</li>' +
        '<li><h3>Something you did well</h3><p>' + esc(rep.didWell.text) + '</p>' + (rep.didWell.ply != null ? moveLink(result.moves[rep.didWell.ply]) : '') + '</li>' +
        '<li><h3>Three exercises from this game</h3>' + (ex.length ? '<ul class="plist">' + ex.map(function (p) { return '<li><a href="#/tactics/p/' + p.id + '">' + esc(p.title) + '</a></li>'; }).join('') + '</ul><p class="small muted">They are also added to your Tactics training with spaced repetition.</p>' : '<p>No mistakes to turn into exercises — practise your weakest theme instead.</p>') + '</li>' +
        '</ol>';
    }

    function movesHtml() {
      var m = ply > 0 ? result.moves[ply - 1] : null;
      var cur = m ? '<div class="explain"><p class="mvhead"><strong>' + esc(moveName(m)) + esc(m.symbol || '') + '</strong> <span class="tag cls-' + m.cls + '">' + m.cls + '</span> <span class="muted small">eval ' + CT.Analysis.fmtEval(m.evalAfter) + '</span></p>' +
        (m.explanation ? '<p>' + CT.Annotate.annotate(m.explanation, m.fenBefore).html + '</p>' : (m.cls === 'best' ? '<p>The engine\'s top move.</p>' : '<p>A reasonable move.</p>')) +
        (m.best && m.cls !== 'best' ? '<p class="small">Engine line: ' + esc((m.bestPv || [m.best]).slice(0, 6).join(' ')) + '</p>' : '') +
        '<p class="small muted">Arrows: ' + (['blunder', 'mistake'].indexOf(m.cls) >= 0 ? 'red = your move, green = better move' + (m.lessonKind === 'threat' ? ', blue = opponent\'s punishing reply' : '') : 'green = the move played') + '.</p></div>' : '<p class="muted">Use ▶ or tap a move to step through the game.</p>';
      var list = result.moves.map(function (mv, i) {
        var num = mv.color === 'w' ? '<span class="mnum">' + mv.moveNo + '.</span>' : (i === 0 ? '<span class="mnum">' + mv.moveNo + '…</span>' : '');
        return num + '<button type="button" class="mv cls-' + mv.cls + (i === ply - 1 ? ' cur' : '') + (mv.color === g.userColor ? ' mine' : '') + '" data-ply="' + (i + 1) + '">' + esc(mv.san) + esc(mv.symbol || '') + '</button>';
      }).join('');
      return cur + '<div class="movelist">' + list + '</div>';
    }

    function runAnalysis(useStockfish) {
      var depth = +(panel.querySelector('.depth') ? panel.querySelector('.depth').value : 16);
      panel.innerHTML = '<h2>Analysing…</h2><p class="muted small an-status">Preparing the engine…</p>' + UI.bar(0) + '<div class="btn-row"><button class="btn" data-act="cancel">Cancel</button></div>';
      var setP = function (i, n) { var b = panel.querySelector('.bar span'); if (b) b.style.width = Math.round(i / n * 100) + '%'; var s = panel.querySelector('.an-status'); if (s) s.textContent = 'Position ' + i + ' of ' + n; };
      CT.Analyzer.pick(useStockfish).then(function (an) {
        var s = panel.querySelector('.an-status');
        if (s) s.textContent = (an.source === 'stockfish' ? 'Using ' + (CT.Stockfish.status().name || 'Stockfish') : 'Stockfish unavailable — using the built-in engine') + '…';
        job = CT.Analysis.analyseGame({ startFen: g.startFen, moves: g.moves, headers: h }, { analyzer: an, depth: an.source === 'builtin' ? 2 : depth, onProgress: setP });
        return job;
      }).then(function (res) {
        job = null;
        CT.Games.saveAnalysis(g.id, res);
        if (CT.Experiments) CT.Experiments.update().forEach(function (e) { UI.toast(e.kind === 'concluded' ? CT.Experiments.verdictText(e.exp) : '🔬 New experiment: ' + CT.Experiments.label(e.exp.symptom, e.exp.motif).toLowerCase()); });
        g = CT.Games.get(id);
        result = CT.Games.expand(g);
        CT.Sound.play('win');
        tab = 'report';
        showBoard(); renderPanel();
      }).catch(function (err) {
        job = null;
        if (err && err.message === 'cancelled') { renderPanel(); return; }
        panel.innerHTML = '<p class="bad">Analysis failed: ' + esc(err && err.message) + '</p><button class="btn" data-act="reanalyse">Try again</button>';
      });
    }

    view.addEventListener('click', function (e) {
      var j = e.target.closest('[data-ply]');
      if (j) { ply = +j.dataset.ply; if (j.classList.contains('jump')) tab = 'moves'; showBoard(); renderPanel(); speakMove(); return; }
      var tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; renderPanel(); return; }
      var col = e.target.closest('[data-color]');
      if (col) { CT.Games.setColor(g.id, col.dataset.color); g = CT.Games.get(id); board.setOrientation(g.userColor); renderPanel(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act, n = g.moves.length;
      if (a === 'first') ply = 0;
      if (a === 'prev') ply = Math.max(0, ply - 1);
      if (a === 'next') ply = Math.min(n, ply + 1);
      if (a === 'last') ply = n;
      if (a === 'flip') { board.flip(); return; }
      if (a === 'analyse') return runAnalysis(true);
      if (a === 'analyse-builtin') return runAnalysis(false);
      if (a === 'reanalyse') { result = null; g.analysis = null; renderPanel(); return; }
      if (a === 'cancel') { if (job && job.cancel) job.cancel(); return; }
      if (a === 'copypgn') { var c = positionAt(n); Object.keys(h).forEach(function (k) { c.header(k, h[k]); }); UI.copy(c.pgn()); return; }
      if (a === 'swapcolor') { CT.Games.setColor(g.id, g.userColor === 'w' ? 'b' : 'w'); g = CT.Games.get(id); board.setOrientation(g.userColor); renderPanel(); return; }
      if (['first', 'prev', 'next', 'last'].indexOf(a) >= 0) { if (tab === 'report' && result) tab = 'moves'; showBoard(); renderPanel(); speakMove(); }
    });
    // Voice coach: read the current move's verdict and explanation.
    function speakMove() {
      var m = result && ply > 0 ? result.moves[ply - 1] : null;
      if (!m) return;
      var verdict = { blunder: 'a blunder', mistake: 'a mistake', inaccuracy: 'an inaccuracy', best: 'the best move' }[m.cls];
      CT.Voice.say((m.color === 'w' ? 'White' : 'Black') + ' played ' + m.san + (verdict ? ', ' + verdict : '') + '. ' + (m.explanation ? CT.Voice.brief(m.explanation, 2) : ''));
    }
    root.addEventListener('keydown', keys);
    function keys(e) {
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      if (e.key === 'ArrowRight') { ply = Math.min(g.moves.length, ply + 1); tab = result ? 'moves' : tab; showBoard(); renderPanel(); }
      if (e.key === 'ArrowLeft') { ply = Math.max(0, ply - 1); tab = result ? 'moves' : tab; showBoard(); renderPanel(); }
    }
    if (startPly != null) tab = 'moves';
    showBoard(); renderPanel();
    if (auto && !result) runAnalysis(true);
    return function () { root.removeEventListener('keydown', keys); if (job && job.cancel) job.cancel(); };
  }

  CT.Views = CT.Views || {};
  CT.Views.analysisImport = importView;
  CT.Views.analysisGames = gamesView;
  CT.Views.analysisPatterns = patternsView;
  CT.Views.analysisGame = gameView;
})(window);
