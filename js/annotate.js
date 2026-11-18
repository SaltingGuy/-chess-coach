/*
 * annotate.js — Turns explanation text into something you can SEE on the board.
 * Moves mentioned in the text ("Qxg4", "…Nf2") become arrows; squares ("f7", "e5") get a ring.
 * Each mention becomes a tappable chip that flashes its square/arrow on the board.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var TOKEN = /(…|\.\.\.)?\b(O-O-O|O-O|[NBRQK][a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|[a-h]x[a-h][1-8](?:=[NBRQ])?[+#]?|[a-h][1-8](?:=[NBRQ])?[+#]?)(?![a-z0-9])/g;

  function flipTurn(fen) {
    var p = fen.split(' ');
    p[1] = p[1] === 'w' ? 'b' : 'w';
    p[3] = '-';
    try { return new CT.Chess(p.join(' ')); } catch (e) { return null; }
  }

  // Try to read a token as a legal move in the position (for either side).
  function resolve(token, games) {
    for (var i = 0; i < games.length; i++) {
      var g = games[i];
      if (!g) continue;
      var m = new CT.Chess(g.fen()).move(token);
      if (m) return m;
    }
    return null;
  }

  /**
   * annotate(text, fen, opts) -> {html, arrows:[{from,to,color}], squares:[sq]}
   * fen: the position the text talks about. opts.skip: SAN to leave without an arrow (the move just played).
   */
  function annotate(text, fen, opts) {
    opts = opts || {};
    var esc = CT.UI.esc, arrows = [], squares = [], html = '';
    var games = [];
    if (fen) {
      try { games.push(new CT.Chess(fen)); } catch (e) { /* ignore */ }
      games.push(flipTurn(fen));
    }
    var last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      var whole = m[0], tok = m[2];
      html += esc(text.slice(last, m.index));
      last = m.index + whole.length;
      var isSquare = /^[a-h][1-8]$/.test(tok);
      var mv = (!isSquare && games.length) ? resolve(tok, games) : null;
      if (mv) {
        var same = opts.skip && opts.skip.replace(/[+#]/g, '') === tok.replace(/[+#]/g, '');
        if (!same && arrows.length < (opts.maxArrows || 3) && !arrows.some(function (a) { return a.from === mv.from && a.to === mv.to; }))
          arrows.push({ from: mv.from, to: mv.to, color: 'blue' });
        html += '<button type="button" class="sqref mvref" data-from="' + mv.from + '" data-to="' + mv.to + '">' + esc(whole) + '</button>';
      } else if (isSquare) {
        if (squares.indexOf(tok) < 0 && squares.length < (opts.maxSquares || 4)) squares.push(tok);
        html += '<button type="button" class="sqref" data-sq="' + tok + '">' + esc(whole) + '</button>';
      } else {
        var sq = tok.replace(/[+#]|=[NBRQ]/g, '').slice(-2);
        html += /^[a-h][1-8]$/.test(sq) ? '<button type="button" class="sqref" data-sq="' + sq + '">' + esc(whole) + '</button>' : esc(whole);
      }
    }
    html += esc(text.slice(last));
    return { html: html, arrows: arrows, squares: squares };
  }

  /** Make chips inside `container` flash on `board` when tapped or hovered. Call once per container. */
  function bind(container, getBoard) {
    function show(el) {
      var board = getBoard();
      if (!board || !el) return;
      if (el.dataset.from) board.flash([el.dataset.from, el.dataset.to], { from: el.dataset.from, to: el.dataset.to });
      else board.flash([el.dataset.sq]);
    }
    container.addEventListener('click', function (e) { var el = e.target.closest('.sqref'); if (el) { e.preventDefault(); show(el); } });
    container.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var el = e.target.closest('.sqref'); if (el) show(el);
    });
  }

  /** Convenience: show a move's own arrow plus whatever the explanation mentions. */
  function showOnBoard(board, ann, moveArrow) {
    var arrows = ann.arrows.slice();
    if (moveArrow) arrows.unshift(Object.assign({ color: 'green' }, moveArrow));
    var autoArrows = !CT.Store || CT.Store.state.profile.autoArrows !== false;
    board.setArrows(autoArrows ? arrows : (moveArrow ? [arrows[0]] : []));
    var rings = {};
    if (autoArrows) ann.squares.forEach(function (s) { rings[s] = 'ring'; });
    board.setMarks(rings);
  }

  CT.Annotate = { annotate: annotate, bind: bind, showOnBoard: showOnBoard, flipTurn: flipTurn };
})(window);
