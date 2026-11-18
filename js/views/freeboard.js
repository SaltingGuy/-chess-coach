/* Board tool: play freely with full rules, step through moves, load FEN, import/export PGN. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;
  var saved = null; // keep the position when you leave and come back during this visit

  function render(view) {
    var Chess = CT.Chess;
    var start = saved ? saved.start : Chess.DEFAULT_FEN;
    var moves = saved ? saved.moves.slice() : [];
    var idx = saved ? saved.idx : 0;
    var headers = saved ? saved.headers : {};
    var game, board;

    view.innerHTML = '<header class="page-head"><div><h1>Board</h1><p class="muted">Play both sides, set up positions with FEN, and import or export games as PGN. All moves are rule-checked.</p></div></header>' +
      '<div class="trainer"><div class="board-col"><div class="board-host"></div><div class="nav-row">' +
      '<button class="btn" data-act="first" aria-label="First move">⏮</button><button class="btn" data-act="prev" aria-label="Previous">◀</button>' +
      '<button class="btn" data-act="next" aria-label="Next">▶</button><button class="btn" data-act="last" aria-label="Last move">⏭</button>' +
      '<button class="btn" data-act="flip" aria-label="Flip board">⇅</button><button class="btn" data-act="undo">Undo</button><button class="btn" data-act="new">New game</button></div></div>' +
      '<aside class="panel"><div class="status"></div><div class="movelist"></div>' +
      '<details class="tool"><summary>Position (FEN)</summary><textarea class="fen" rows="2" spellcheck="false"></textarea>' +
      '<div class="btn-row"><button class="btn small" data-act="loadfen">Load FEN</button><button class="btn small" data-act="copyfen">Copy FEN</button></div></details>' +
      '<details class="tool"><summary>Import PGN</summary><textarea class="pgn-in" rows="6" placeholder="Paste a PGN here (from Chess.com, Lichess…)" spellcheck="false"></textarea>' +
      '<div class="btn-row"><button class="btn small" data-act="loadpgn">Import</button></div><p class="small muted">Comments and side variations are skipped. For a Stockfish review, use Game Analysis.</p></details>' +
      '<details class="tool"><summary>Export PGN</summary><textarea class="pgn-out" rows="6" readonly spellcheck="false"></textarea>' +
      '<div class="btn-row"><button class="btn small" data-act="copypgn">Copy</button><button class="btn small" data-act="dlpgn">Download .pgn</button></div></details>' +
      '</aside></div>';

    var statusEl = view.querySelector('.status'), listEl = view.querySelector('.movelist');
    board = new CT.Board(view.querySelector('.board-host'), {
      canMove: function () { return !game.isGameOver(); },
      onMove: function (from, to, promotion) {
        var mv = game.move({ from: from, to: to, promotion: promotion });
        if (!mv) return false;
        moves = moves.slice(0, idx); moves.push(mv.san); idx++;
        refresh();
        return true;
      }
    });

    function build() {
      game = new Chess(start);
      for (var i = 0; i < idx; i++) game.move(moves[i]);
      Object.keys(headers).forEach(function (k) { game.header(k, headers[k]); });
    }

    function full() {
      var g = new Chess(start);
      moves.forEach(function (m) { g.move(m); });
      Object.keys(headers).forEach(function (k) { g.header(k, headers[k]); });
      return g;
    }

    function refresh() {
      build();
      var hist = game.history({ verbose: true }), last = hist[hist.length - 1];
      board.setGame(game, { lastMove: last ? { from: last.from, to: last.to } : null });
      var s;
      if (game.isCheckmate()) s = '<strong>Checkmate.</strong> ' + UI.sideName(game.turn() === 'w' ? 'b' : 'w') + ' wins.';
      else if (game.isDraw()) s = '<strong>Draw</strong> by ' + game.gameOverReason() + '.';
      else s = UI.sideName(game.turn()) + ' to move' + (game.inCheck() ? ' — <strong>check!</strong>' : '') + '.';
      if (idx < moves.length) s += ' <span class="muted">(viewing move ' + idx + ' of ' + moves.length + ' — a new move here replaces the rest)</span>';
      statusEl.innerHTML = '<p>' + s + '</p>';
      var parts = start.split(' ');
      listEl.innerHTML = UI.moveListHtml(moves, parts[1], idx - 1, parseInt(parts[5], 10) || 1);
      view.querySelector('.fen').value = game.fen();
      view.querySelector('.pgn-out').value = full().pgn();
      saved = { start: start, moves: moves, idx: idx, headers: headers };
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'first') idx = 0;
      if (a === 'prev') idx = Math.max(0, idx - 1);
      if (a === 'next') idx = Math.min(moves.length, idx + 1);
      if (a === 'last') idx = moves.length;
      if (a === 'flip') { board.flip(); return; }
      if (a === 'undo') { if (idx > 0) { moves = moves.slice(0, idx - 1); idx--; } }
      if (a === 'new') { start = Chess.DEFAULT_FEN; moves = []; idx = 0; headers = {}; }
      if (a === 'loadfen') {
        var fen = view.querySelector('.fen').value.trim();
        var v = Chess.validateFen(fen);
        if (!v.ok) { UI.toast(v.error); return; }
        try { new Chess(fen); } catch (err) { UI.toast(err.message.replace('Invalid FEN: ', '')); return; }
        start = fen; moves = []; idx = 0; headers = {};
        UI.toast('Position loaded');
      }
      if (a === 'copyfen') { UI.copy(game.fen()); return; }
      if (a === 'loadpgn') {
        var r = Chess.parsePgn(view.querySelector('.pgn-in').value);
        if (!r.ok) { UI.toast(r.error); return; }
        start = r.startFen; moves = r.moves; idx = moves.length; headers = r.headers;
        UI.toast('Imported ' + moves.length + ' moves' + (headers.White ? ': ' + headers.White + ' vs ' + (headers.Black || '?') : ''));
      }
      if (a === 'copypgn') { UI.copy(full().pgn()); return; }
      if (a === 'dlpgn') { UI.download('game.pgn', full().pgn(), 'application/x-chess-pgn'); return; }
      refresh();
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.mv');
      if (!b) return;
      idx = +b.dataset.i + 1; refresh();
    });

    refresh();
  }

  CT.Views = CT.Views || {};
  CT.Views.freeboard = render;
})(window);
