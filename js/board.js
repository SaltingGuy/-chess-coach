/*
 * board.js — Interactive chessboard (tap-to-move and drag-and-drop, phone friendly).
 * The board only displays a position and reports the user's intended move; the caller
 * decides whether the move is accepted (rules are enforced by CT.Chess).
 *
 *   var b = new CT.Board(el, {
 *     orientation: 'w',
 *     canMove: function (color) { return true },          // may the user move pieces of this colour now?
 *     onMove: function (from, to, promotion) { ... }      // return true if accepted
 *   });
 *   b.setGame(chessInstance, { lastMove: {from,to} });
 */
(function (root) {
  'use strict';
  var Chess = root.CT.Chess, Pieces = root.CT.Pieces;
  var FILES = 'abcdefgh';

  function Board(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.orientation = this.opts.orientation || 'w';
    this.game = null;
    this.selected = null;
    this.targets = [];
    this.lastMove = null;
    this.arrows = [];
    this.marks = {};
    this._build();
  }

  Board.prototype._build = function () {
    var self = this;
    this.el.classList.add('board-wrap');
    var uid = this._uid();
    var markers = ['green', 'red', 'blue', 'yellow'].map(function (c) {
      return '<marker id="ah-' + uid + '-' + c + '" class="mk-' + c + '" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0 0L10 5 0 10z"/></marker>';
    }).join('');
    this.el.innerHTML = '<div class="board" role="grid" aria-label="Chessboard"></div><svg class="arrows" viewBox="0 0 8 8" aria-hidden="true">' +
      '<defs>' + markers + '</defs></svg>' +
      '<div class="promo" hidden></div>';
    this.boardEl = this.el.querySelector('.board');
    this.arrowEl = this.el.querySelector('.arrows');
    this.promoEl = this.el.querySelector('.promo');
    this.squares = {};
    for (var i = 0; i < 64; i++) {
      var d = document.createElement('div');
      d.className = 'sq';
      d.setAttribute('role', 'gridcell');
      this.boardEl.appendChild(d);
    }
    this._layout();
    this.boardEl.addEventListener('pointerdown', function (e) { self._down(e); });
    this.boardEl.addEventListener('pointermove', function (e) { self._moveDrag(e); });
    this.boardEl.addEventListener('pointerup', function (e) { self._up(e); });
    this.boardEl.addEventListener('pointercancel', function () { self._cancelDrag(); });
    this.boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  Board.prototype._uid = function () { this.uid = this.uid || ('b' + Math.random().toString(36).slice(2, 8)); return this.uid; };

  // Assign square names to cells according to orientation.
  Board.prototype._layout = function () {
    var cells = this.boardEl.children;
    this.squares = {};
    for (var i = 0; i < 64; i++) {
      var r = i >> 3, c = i & 7;
      var file = this.orientation === 'w' ? c : 7 - c;
      var rank = this.orientation === 'w' ? 8 - r : r + 1;
      var name = FILES[file] + rank;
      var cell = cells[i];
      cell.dataset.sq = name;
      cell.className = 'sq ' + (((file + rank) % 2 === 0) ? 'dark' : 'light');
      cell.setAttribute('aria-label', name);
      this.squares[name] = cell;
    }
  };

  Board.prototype.setOrientation = function (o) { this.orientation = o; this._layout(); this.render(); };
  Board.prototype.flip = function () { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); };

  Board.prototype.setGame = function (game, opts) {
    opts = opts || {};
    // Sound effects: only when a new move appears on the board.
    var fen = game.fen();
    if (opts.lastMove && this._lastFen && fen !== this._lastFen && opts.sound !== false && root.CT.Sound) {
      var count = function (f) { return f.split(' ')[0].replace(/[^a-zA-Z]/g, '').length; };
      var name = game.inCheck() ? 'check' : count(fen) < count(this._lastFen) ? 'capture' : 'move';
      var p = game.get(opts.lastMove.to);
      if (name === 'move' && p && p.type === 'k' && Math.abs(opts.lastMove.from.charCodeAt(0) - opts.lastMove.to.charCodeAt(0)) === 2) name = 'castle';
      root.CT.Sound.play(name);
    }
    this._lastFen = fen;
    this.game = game;
    if ('lastMove' in opts) this.lastMove = opts.lastMove;
    this.selected = null; this.targets = [];
    if (!opts.keepArrows) this.arrows = [];
    if (!opts.keepMarks) this.marks = {};
    this.render();
  };

  Board.prototype.setArrows = function (arrows) { this.arrows = arrows || []; this._renderArrows(); };
  // marks: { e4: 'good' | 'bad' | 'hint' }
  Board.prototype.setMarks = function (marks) { this.marks = marks || {}; this.render(); };

  Board.prototype.render = function () {
    if (!this.game) return;
    var checkSq = null;
    if (this.game.inCheck()) {
      var k = this.game.turn() === 'w' ? 'K' : 'k';
      for (var i = 0; i < 64; i++) if (this.game._board[i] === k) checkSq = Chess.sqName(i);
    }
    for (var name in this.squares) {
      var cell = this.squares[name];
      var p = this.game.get(name);
      var cls = cell.className.replace(/ (sel|last|tgt|cap|chk|flash|mk-\w+)/g, '');
      if (this.selected === name) cls += ' sel';
      if (this.lastMove && (this.lastMove.from === name || this.lastMove.to === name)) cls += ' last';
      if (this.targets.indexOf(name) >= 0) cls += p ? ' cap' : ' tgt';
      if (checkSq === name) cls += ' chk';
      if (this.marks[name]) cls += ' mk-' + this.marks[name];
      cell.className = cls;
      var html = p ? Pieces.svg(p.color, p.type) : '';
      // coordinates
      var r = name[1], f = name[0];
      var leftFile = this.orientation === 'w' ? 'a' : 'h', bottomRank = this.orientation === 'w' ? '1' : '8';
      if (f === leftFile) html += '<span class="coord rank">' + r + '</span>';
      if (r === bottomRank) html += '<span class="coord file">' + f + '</span>';
      if (showNames()) html += '<span class="sqname">' + name + '</span>';
      if (cell._html !== html) { cell.innerHTML = html; cell._html = html; }
      cell.setAttribute('aria-label', name + (p ? ' ' + (p.color === 'w' ? 'white ' : 'black ') + Pieces.names[p.type] : ''));
    }
    this._renderArrows();
  };

  function showNames() { try { return !!root.CT.Store.state.profile.squareNames; } catch (e) { return false; } }

  /** Briefly highlight squares (and optionally an arrow) — used when you tap a square name in an explanation. */
  Board.prototype.flash = function (squares, arrow) {
    var self = this;
    clearTimeout(this._flashT);
    (this._flashed || []).forEach(function (s) { if (self.squares[s]) self.squares[s].classList.remove('flash'); });
    this._flashed = squares.filter(function (s) { return self.squares[s]; });
    this._flashed.forEach(function (s) { self.squares[s].classList.add('flash'); });
    this._tempArrow = arrow ? { from: arrow.from, to: arrow.to, color: 'yellow' } : null;
    this._renderArrows();
    this._flashT = setTimeout(function () {
      self._flashed.forEach(function (s) { if (self.squares[s]) self.squares[s].classList.remove('flash'); });
      self._tempArrow = null; self._renderArrows();
    }, 1600);
  };

  Board.prototype._center = function (sq) {
    var f = FILES.indexOf(sq[0]), r = +sq[1];
    var x = this.orientation === 'w' ? f : 7 - f;
    var y = this.orientation === 'w' ? 8 - r : r - 1;
    return [x + 0.5, y + 0.5];
  };

  Board.prototype._renderArrows = function () {
    var self = this, svg = this.arrowEl;
    Array.prototype.slice.call(svg.querySelectorAll('line')).forEach(function (l) { l.remove(); });
    var list = this.arrows.slice();
    if (this._tempArrow) list.push(this._tempArrow);
    list.forEach(function (a) {
      var p1 = self._center(a.from), p2 = self._center(a.to);
      var dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      var x2 = p2[0] - dx / len * 0.32, y2 = p2[1] - dy / len * 0.32;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1[0]); line.setAttribute('y1', p1[1]);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('class', 'arrow ' + (a.color || 'green'));
      line.setAttribute('marker-end', 'url(#ah-' + self.uid + '-' + (a.color || 'green') + ')');
      svg.appendChild(line);
    });
  };

  /* ---------- input ---------- */

  Board.prototype._squareAt = function (x, y) {
    var rect = this.boardEl.getBoundingClientRect();
    if (x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return null;
    var size = rect.width / 8;
    var c = Math.floor((x - rect.left) / size), r = Math.floor((y - rect.top) / size);
    return this.boardEl.children[r * 8 + c].dataset.sq;
  };

  Board.prototype._movable = function (sq) {
    var p = this.game && this.game.get(sq);
    if (!p || p.color !== this.game.turn()) return false;
    return this.opts.canMove ? !!this.opts.canMove(p.color) : true;
  };

  Board.prototype._select = function (sq) {
    this.selected = sq;
    this.targets = sq ? this.game.moves({ square: sq, verbose: true }).map(function (m) { return m.to; }) : [];
    this.render();
  };

  Board.prototype._down = function (e) {
    if (!this.game || !this.promoEl.hidden) return;
    if (e.button && e.button !== 0) return;
    var sq = this._squareAt(e.clientX, e.clientY);
    if (!sq) return;
    this._press = { sq: sq, x: e.clientX, y: e.clientY, wasSelected: this.selected, dragging: false };
    if (this._movable(sq) && this.selected !== sq && this.targets.indexOf(sq) < 0) this._select(sq);
    if (this._movable(sq)) {
      try { this.boardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    e.preventDefault();
  };

  Board.prototype._moveDrag = function (e) {
    var pr = this._press;
    if (!pr || !this._movable(pr.sq)) return;
    if (!pr.dragging) {
      if (Math.abs(e.clientX - pr.x) + Math.abs(e.clientY - pr.y) < 8) return;
      pr.dragging = true;
      var cell = this.squares[pr.sq], svg = cell.querySelector('svg');
      if (!svg) return;
      var size = cell.getBoundingClientRect().width;
      this._ghost = svg.cloneNode(true);
      this._ghost.classList.add('ghost');
      this._ghost.style.width = this._ghost.style.height = size * 1.1 + 'px';
      document.body.appendChild(this._ghost);
      svg.style.opacity = '0.25';
      this._dragSvg = svg;
    }
    if (this._ghost) {
      var w = parseFloat(this._ghost.style.width);
      this._ghost.style.transform = 'translate(' + (e.clientX - w / 2) + 'px,' + (e.clientY - w / 2) + 'px)';
      var over = this._squareAt(e.clientX, e.clientY);
      if (over !== this._over) {
        if (this._over && this.squares[this._over]) this.squares[this._over].classList.remove('hover');
        this._over = over;
        if (over && this.targets.indexOf(over) >= 0) this.squares[over].classList.add('hover');
      }
    }
  };

  Board.prototype._cancelDrag = function () {
    if (this._ghost) { this._ghost.remove(); this._ghost = null; }
    // Always un-fade the piece that was being dragged: if the move was refused, the square's HTML
    // does not change, so render() would otherwise leave the faded piece in place.
    if (this._dragSvg) { this._dragSvg.style.opacity = ''; this._dragSvg = null; }
    if (this._over && this.squares[this._over]) this.squares[this._over].classList.remove('hover');
    this._over = null;
    this._press = null;
    this.render();
  };

  Board.prototype._up = function (e) {
    var pr = this._press;
    if (!pr) return;
    var sq = this._squareAt(e.clientX, e.clientY);
    var dragged = pr.dragging;
    this._cancelDrag();
    if (dragged) {
      if (sq && sq !== pr.sq && this.targets.indexOf(sq) >= 0) this._attempt(pr.sq, sq);
      return;
    }
    // Tap logic
    if (pr.wasSelected && pr.wasSelected !== sq && this.targets.indexOf(sq) >= 0) { this._attempt(pr.wasSelected, sq); return; }
    if (pr.wasSelected === sq) { this._select(null); return; }
    if (!this._movable(sq)) this._select(null);
  };

  Board.prototype._attempt = function (from, to) {
    var self = this;
    var piece = this.game.get(from);
    var promoting = piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1');
    var finish = function (promotion) {
      self.selected = null; self.targets = [];
      var ok = self.opts.onMove ? self.opts.onMove(from, to, promotion) : false;
      if (!ok) self.render();
    };
    if (promoting) this._askPromotion(piece.color, finish);
    else finish(undefined);
  };

  Board.prototype._askPromotion = function (color, done) {
    var self = this;
    this.promoEl.innerHTML = '<div class="promo-box"><p>Promote to:</p>' + ['q', 'r', 'b', 'n'].map(function (t) {
      return '<button type="button" data-t="' + t + '" aria-label="' + Pieces.names[t] + '">' + Pieces.svg(color, t) + '</button>';
    }).join('') + '<button type="button" class="promo-cancel" data-t="">Cancel</button></div>';
    this.promoEl.hidden = false;
    this.promoEl.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      self.promoEl.hidden = true;
      if (b.dataset.t) done(b.dataset.t);
      else { self.selected = null; self.targets = []; self.render(); }
    };
  };

  root.CT.Board = Board;
})(window);
