/*
 * chess.js — Chess rules core for Chess Trainer.
 * Enforces legal moves, castling, en passant, promotion, check/checkmate/stalemate,
 * draw rules, and handles FEN, SAN and PGN. No external dependencies.
 * The public API is modelled on the popular chess.js library so it can be swapped later.
 *
 * Board indexing: 0 = a8, 7 = h8, 56 = a1, 63 = h1  (row 0 is rank 8).
 * Pieces are single characters: uppercase = White (PNBRQK), lowercase = Black.
 */
(function (root) {
  'use strict';

  var FILES = 'abcdefgh';
  var DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function sqName(i) { return FILES[i & 7] + (8 - (i >> 3)); }
  function sqIndex(name) {
    if (typeof name !== 'string' || name.length !== 2) return -1;
    var f = FILES.indexOf(name[0]);
    var r = name.charCodeAt(1) - 48;
    if (f < 0 || r < 1 || r > 8) return -1;
    return (8 - r) * 8 + f;
  }
  function colorOf(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
  function typeOf(p) { return p.toLowerCase(); }
  function other(c) { return c === 'w' ? 'b' : 'w'; }

  function Chess(fen) {
    this._history = [];
    this._positions = {};
    this._header = {};
    this.load(fen || DEFAULT_FEN);
  }

  Chess.DEFAULT_FEN = DEFAULT_FEN;
  Chess.sqName = sqName;
  Chess.sqIndex = sqIndex;

  /* ---------------- FEN ---------------- */

  Chess.validateFen = function (fen) {
    if (typeof fen !== 'string') return { ok: false, error: 'FEN must be text.' };
    var parts = fen.trim().split(/\s+/);
    if (parts.length < 4) return { ok: false, error: 'FEN needs at least 4 fields (pieces, side, castling, en passant).' };
    var rows = parts[0].split('/');
    if (rows.length !== 8) return { ok: false, error: 'FEN must describe 8 ranks.' };
    var kings = { K: 0, k: 0 };
    for (var r = 0; r < 8; r++) {
      var count = 0;
      for (var j = 0; j < rows[r].length; j++) {
        var ch = rows[r][j];
        if (/[1-8]/.test(ch)) count += +ch;
        else if (/[pnbrqkPNBRQK]/.test(ch)) {
          count++;
          if (ch === 'K' || ch === 'k') kings[ch]++;
          if ((ch === 'p' || ch === 'P') && (r === 0 || r === 7)) return { ok: false, error: 'Pawns cannot stand on the first or last rank.' };
        } else return { ok: false, error: 'Unknown character "' + ch + '" in FEN.' };
      }
      if (count !== 8) return { ok: false, error: 'Rank ' + (8 - r) + ' does not have 8 squares.' };
    }
    if (kings.K !== 1 || kings.k !== 1) return { ok: false, error: 'Each side must have exactly one king.' };
    if (parts[1] !== 'w' && parts[1] !== 'b') return { ok: false, error: 'Side to move must be "w" or "b".' };
    if (!/^(-|[KQkq]{1,4})$/.test(parts[2])) return { ok: false, error: 'Castling field is invalid.' };
    if (!/^(-|[a-h][36])$/.test(parts[3])) return { ok: false, error: 'En passant field is invalid.' };
    return { ok: true };
  };

  Chess.prototype.load = function (fen) {
    var v = Chess.validateFen(fen);
    if (!v.ok) throw new Error('Invalid FEN: ' + v.error);
    var parts = fen.trim().split(/\s+/);
    var board = new Array(64).fill(null);
    var rows = parts[0].split('/');
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var j = 0; j < rows[r].length; j++) {
        var ch = rows[r][j];
        if (/[1-8]/.test(ch)) f += +ch;
        else { board[r * 8 + f] = ch; f++; }
      }
    }
    this._board = board;
    this._turn = parts[1];
    var c = parts[2];
    this._castling = { K: c.indexOf('K') >= 0, Q: c.indexOf('Q') >= 0, k: c.indexOf('k') >= 0, q: c.indexOf('q') >= 0 };
    // Drop castling rights that are impossible given piece placement.
    if (board[60] !== 'K') { this._castling.K = false; this._castling.Q = false; }
    if (board[63] !== 'R') this._castling.K = false;
    if (board[56] !== 'R') this._castling.Q = false;
    if (board[4] !== 'k') { this._castling.k = false; this._castling.q = false; }
    if (board[7] !== 'r') this._castling.k = false;
    if (board[0] !== 'r') this._castling.q = false;
    this._ep = parts[3] === '-' ? -1 : sqIndex(parts[3]);
    this._half = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    this._full = parts[5] ? Math.max(1, parseInt(parts[5], 10) || 1) : 1;
    this._history = [];
    this._positions = {};
    this._startFen = this.fen();
    // The side that is NOT to move must not be in check.
    if (this._attacked(this._kingSq(other(this._turn)), this._turn)) {
      throw new Error('Invalid FEN: the side not to move is in check.');
    }
    this._recordPosition();
    return true;
  };

  Chess.prototype.reset = function () { this.load(DEFAULT_FEN); this._header = {}; };

  Chess.prototype.fen = function () {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = this._board[r * 8 + f];
        if (!p) empty++;
        else { if (empty) { out += empty; empty = 0; } out += p; }
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    var c = (this._castling.K ? 'K' : '') + (this._castling.Q ? 'Q' : '') + (this._castling.k ? 'k' : '') + (this._castling.q ? 'q' : '');
    // Only print an en passant square when a capture there is actually possible (keeps repetition detection honest).
    var ep = '-';
    if (this._ep >= 0 && this._epCapturePossible()) ep = sqName(this._ep);
    return out + ' ' + this._turn + ' ' + (c || '-') + ' ' + ep + ' ' + this._half + ' ' + this._full;
  };

  Chess.prototype._epCapturePossible = function () {
    var ep = this._ep, pawn = this._turn === 'w' ? 'P' : 'p';
    var row = ep >> 3, col = ep & 7;
    var fromRow = this._turn === 'w' ? row + 1 : row - 1;
    for (var dc = -1; dc <= 1; dc += 2) {
      var c = col + dc;
      if (c < 0 || c > 7) continue;
      if (this._board[fromRow * 8 + c] === pawn) return true;
    }
    return false;
  };

  Chess.prototype._positionKey = function () { return this.fen().split(' ').slice(0, 4).join(' '); };
  Chess.prototype._recordPosition = function () {
    var k = this._positionKey();
    this._positions[k] = (this._positions[k] || 0) + 1;
  };

  /* ---------------- Queries ---------------- */

  Chess.prototype.turn = function () { return this._turn; };
  Chess.prototype.get = function (square) {
    var i = sqIndex(square);
    if (i < 0 || !this._board[i]) return null;
    var p = this._board[i];
    return { type: typeOf(p), color: colorOf(p) };
  };
  Chess.prototype.board = function () {
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var f = 0; f < 8; f++) {
        var p = this._board[r * 8 + f];
        row.push(p ? { square: sqName(r * 8 + f), type: typeOf(p), color: colorOf(p) } : null);
      }
      rows.push(row);
    }
    return rows;
  };

  Chess.prototype._kingSq = function (color) {
    var k = color === 'w' ? 'K' : 'k';
    for (var i = 0; i < 64; i++) if (this._board[i] === k) return i;
    return -1;
  };

  // Is square `sq` attacked by any piece of colour `by`?
  Chess.prototype._attacked = function (sq, by) {
    if (sq < 0) return false;
    var b = this._board, row = sq >> 3, col = sq & 7, i, r, c, p;
    // Pawns
    var pr = by === 'w' ? row + 1 : row - 1;
    var pawn = by === 'w' ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (col > 0 && b[pr * 8 + col - 1] === pawn) return true;
      if (col < 7 && b[pr * 8 + col + 1] === pawn) return true;
    }
    var knight = by === 'w' ? 'N' : 'n', king = by === 'w' ? 'K' : 'k';
    for (i = 0; i < 8; i++) {
      r = row + KNIGHT[i][0]; c = col + KNIGHT[i][1];
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === knight) return true;
      r = row + KING[i][0]; c = col + KING[i][1];
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === king) return true;
    }
    var bishop = by === 'w' ? 'B' : 'b', rook = by === 'w' ? 'R' : 'r', queen = by === 'w' ? 'Q' : 'q';
    for (i = 0; i < 4; i++) {
      r = row + DIAG[i][0]; c = col + DIAG[i][1];
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        p = b[r * 8 + c];
        if (p) { if (p === bishop || p === queen) return true; break; }
        r += DIAG[i][0]; c += DIAG[i][1];
      }
      r = row + ORTHO[i][0]; c = col + ORTHO[i][1];
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        p = b[r * 8 + c];
        if (p) { if (p === rook || p === queen) return true; break; }
        r += ORTHO[i][0]; c += ORTHO[i][1];
      }
    }
    return false;
  };

  Chess.prototype.inCheck = function () { return this._attacked(this._kingSq(this._turn), other(this._turn)); };
  Chess.prototype.isCheck = Chess.prototype.inCheck;

  /** Which pieces of colour `by` attack `square`? Returns array of square names. Used for teaching. */
  Chess.prototype.attackers = function (square, by) {
    var target = sqIndex(square), out = [];
    var saved = this._board[target];
    for (var i = 0; i < 64; i++) {
      var p = this._board[i];
      if (!p || colorOf(p) !== by) continue;
      // Temporarily isolate: test whether this piece alone attacks target.
      var mv = this._pieceAttacks(i);
      if (mv.indexOf(target) >= 0) out.push(sqName(i));
    }
    this._board[target] = saved;
    return out;
  };

  // Squares a piece on `from` attacks (ignores pins).
  Chess.prototype._pieceAttacks = function (from) {
    var b = this._board, p = b[from], t = typeOf(p), col = colorOf(p);
    var row = from >> 3, c0 = from & 7, out = [], i, r, c;
    if (t === 'p') {
      var dr = col === 'w' ? -1 : 1;
      r = row + dr;
      if (r >= 0 && r < 8) { if (c0 > 0) out.push(r * 8 + c0 - 1); if (c0 < 7) out.push(r * 8 + c0 + 1); }
      return out;
    }
    if (t === 'n' || t === 'k') {
      var offs = t === 'n' ? KNIGHT : KING;
      for (i = 0; i < 8; i++) { r = row + offs[i][0]; c = c0 + offs[i][1]; if (r >= 0 && r < 8 && c >= 0 && c < 8) out.push(r * 8 + c); }
      return out;
    }
    var dirs = t === 'b' ? DIAG : t === 'r' ? ORTHO : DIAG.concat(ORTHO);
    for (i = 0; i < dirs.length; i++) {
      r = row + dirs[i][0]; c = c0 + dirs[i][1];
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        out.push(r * 8 + c);
        if (b[r * 8 + c]) break;
        r += dirs[i][0]; c += dirs[i][1];
      }
    }
    return out;
  };

  /* ---------------- Move generation ---------------- */

  // Internal move: {from, to, piece, captured, promotion, flags}
  // flags: 'n' normal, 'b' pawn double push, 'e' en passant, 'k' O-O, 'q' O-O-O, plus 'c' capture, 'p' promotion
  Chess.prototype._pseudo = function () {
    var moves = [], b = this._board, us = this._turn, them = other(us);
    for (var from = 0; from < 64; from++) {
      var p = b[from];
      if (!p || colorOf(p) !== us) continue;
      var t = typeOf(p), row = from >> 3, col = from & 7, i, r, c, to, q;
      if (t === 'p') {
        var dir = us === 'w' ? -1 : 1, startRow = us === 'w' ? 6 : 1, lastRow = us === 'w' ? 0 : 7;
        r = row + dir;
        if (r >= 0 && r < 8) {
          to = r * 8 + col;
          if (!b[to]) {
            this._addPawn(moves, from, to, p, null, r === lastRow, 'n');
            if (row === startRow && !b[(r + dir) * 8 + col]) moves.push({ from: from, to: (r + dir) * 8 + col, piece: p, captured: null, promotion: null, flags: 'b' });
          }
          for (var dc = -1; dc <= 1; dc += 2) {
            c = col + dc;
            if (c < 0 || c > 7) continue;
            to = r * 8 + c;
            if (b[to] && colorOf(b[to]) === them) this._addPawn(moves, from, to, p, b[to], r === lastRow, 'c');
            else if (to === this._ep && !b[to]) moves.push({ from: from, to: to, piece: p, captured: us === 'w' ? 'p' : 'P', promotion: null, flags: 'e' });
          }
        }
        continue;
      }
      if (t === 'n' || t === 'k') {
        var offs = t === 'n' ? KNIGHT : KING;
        for (i = 0; i < 8; i++) {
          r = row + offs[i][0]; c = col + offs[i][1];
          if (r < 0 || r > 7 || c < 0 || c > 7) continue;
          to = r * 8 + c; q = b[to];
          if (!q) moves.push({ from: from, to: to, piece: p, captured: null, promotion: null, flags: 'n' });
          else if (colorOf(q) === them) moves.push({ from: from, to: to, piece: p, captured: q, promotion: null, flags: 'c' });
        }
        if (t === 'k') this._addCastles(moves, from, p);
        continue;
      }
      var dirs = t === 'b' ? DIAG : t === 'r' ? ORTHO : DIAG.concat(ORTHO);
      for (i = 0; i < dirs.length; i++) {
        r = row + dirs[i][0]; c = col + dirs[i][1];
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          to = r * 8 + c; q = b[to];
          if (!q) moves.push({ from: from, to: to, piece: p, captured: null, promotion: null, flags: 'n' });
          else { if (colorOf(q) === them) moves.push({ from: from, to: to, piece: p, captured: q, promotion: null, flags: 'c' }); break; }
          r += dirs[i][0]; c += dirs[i][1];
        }
      }
    }
    return moves;
  };

  Chess.prototype._addPawn = function (moves, from, to, p, captured, promo, flags) {
    if (promo) {
      var white = colorOf(p) === 'w';
      ['q', 'r', 'b', 'n'].forEach(function (t) {
        moves.push({ from: from, to: to, piece: p, captured: captured, promotion: white ? t.toUpperCase() : t, flags: flags + 'p' });
      });
    } else moves.push({ from: from, to: to, piece: p, captured: captured, promotion: null, flags: flags });
  };

  Chess.prototype._addCastles = function (moves, from, p) {
    var b = this._board, us = this._turn, them = other(us);
    if (us === 'w' && from === 60) {
      if (this._castling.K && b[63] === 'R' && !b[61] && !b[62] && !this._attacked(60, them) && !this._attacked(61, them) && !this._attacked(62, them))
        moves.push({ from: 60, to: 62, piece: p, captured: null, promotion: null, flags: 'k' });
      if (this._castling.Q && b[56] === 'R' && !b[59] && !b[58] && !b[57] && !this._attacked(60, them) && !this._attacked(59, them) && !this._attacked(58, them))
        moves.push({ from: 60, to: 58, piece: p, captured: null, promotion: null, flags: 'q' });
    }
    if (us === 'b' && from === 4) {
      if (this._castling.k && b[7] === 'r' && !b[5] && !b[6] && !this._attacked(4, them) && !this._attacked(5, them) && !this._attacked(6, them))
        moves.push({ from: 4, to: 6, piece: p, captured: null, promotion: null, flags: 'k' });
      if (this._castling.q && b[0] === 'r' && !b[3] && !b[2] && !b[1] && !this._attacked(4, them) && !this._attacked(3, them) && !this._attacked(2, them))
        moves.push({ from: 4, to: 2, piece: p, captured: null, promotion: null, flags: 'q' });
    }
  };

  Chess.prototype._make = function (m) {
    var b = this._board, us = this._turn;
    this._history.push({
      move: m, castling: { K: this._castling.K, Q: this._castling.Q, k: this._castling.k, q: this._castling.q },
      ep: this._ep, half: this._half, full: this._full
    });
    b[m.to] = m.promotion || m.piece;
    b[m.from] = null;
    if (m.flags === 'e') b[us === 'w' ? m.to + 8 : m.to - 8] = null;
    if (m.flags === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.flags === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    // Castling rights
    if (m.piece === 'K') { this._castling.K = false; this._castling.Q = false; }
    if (m.piece === 'k') { this._castling.k = false; this._castling.q = false; }
    if (m.from === 63 || m.to === 63) this._castling.K = false;
    if (m.from === 56 || m.to === 56) this._castling.Q = false;
    if (m.from === 7 || m.to === 7) this._castling.k = false;
    if (m.from === 0 || m.to === 0) this._castling.q = false;
    this._ep = m.flags === 'b' ? (m.from + m.to) / 2 : -1;
    this._half = (typeOf(m.piece) === 'p' || m.captured) ? 0 : this._half + 1;
    if (us === 'b') this._full++;
    this._turn = other(us);
  };

  Chess.prototype._unmake = function () {
    var h = this._history.pop();
    if (!h) return null;
    var m = h.move, b = this._board;
    this._turn = colorOf(m.piece);
    var us = this._turn;
    b[m.from] = m.piece;
    b[m.to] = null;
    if (m.flags === 'e') b[us === 'w' ? m.to + 8 : m.to - 8] = m.captured;
    else if (m.captured) b[m.to] = m.captured;
    if (m.flags === 'k') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
    if (m.flags === 'q') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
    this._castling = h.castling; this._ep = h.ep; this._half = h.half; this._full = h.full;
    return m;
  };

  Chess.prototype._legal = function () {
    var out = [], pseudo = this._pseudo(), us = this._turn;
    for (var i = 0; i < pseudo.length; i++) {
      this._make(pseudo[i]);
      if (!this._attacked(this._kingSq(us), this._turn)) out.push(pseudo[i]);
      this._unmake();
    }
    return out;
  };

  /* ---------------- SAN ---------------- */

  Chess.prototype._san = function (m, legal) {
    var t = typeOf(m.piece), s;
    if (m.flags === 'k') s = 'O-O';
    else if (m.flags === 'q') s = 'O-O-O';
    else {
      s = '';
      if (t !== 'p') {
        s = t.toUpperCase();
        var sameFile = false, sameRank = false, ambiguous = false;
        for (var i = 0; i < legal.length; i++) {
          var o = legal[i];
          if (o.piece === m.piece && o.to === m.to && o.from !== m.from) {
            ambiguous = true;
            if ((o.from & 7) === (m.from & 7)) sameFile = true;
            if ((o.from >> 3) === (m.from >> 3)) sameRank = true;
          }
        }
        if (ambiguous) {
          if (!sameFile) s += FILES[m.from & 7];
          else if (!sameRank) s += (8 - (m.from >> 3));
          else s += sqName(m.from);
        }
      }
      if (m.captured) s += (t === 'p' ? FILES[m.from & 7] : '') + 'x';
      s += sqName(m.to);
      if (m.promotion) s += '=' + m.promotion.toUpperCase();
    }
    this._make(m);
    if (this.inCheck()) s += this._legal().length === 0 ? '#' : '+';
    this._unmake();
    return s;
  };

  Chess.prototype._verbose = function (m, legal) {
    var flags = m.flags;
    return {
      color: colorOf(m.piece), from: sqName(m.from), to: sqName(m.to), piece: typeOf(m.piece),
      captured: m.captured ? typeOf(m.captured) : undefined,
      promotion: m.promotion ? typeOf(m.promotion) : undefined,
      flags: flags, san: this._san(m, legal || this._legal()),
      lan: sqName(m.from) + sqName(m.to) + (m.promotion ? typeOf(m.promotion) : '')
    };
  };

  /** moves({square, verbose}) — legal moves, optionally from one square. */
  Chess.prototype.moves = function (opts) {
    opts = opts || {};
    var legal = this._legal(), self = this;
    if (opts.square) {
      var s = sqIndex(opts.square);
      legal = legal.filter(function (m) { return m.from === s; });
    }
    var all = opts.square ? this._legal() : legal;
    return legal.map(function (m) { return opts.verbose ? self._verbose(m, all) : self._san(m, all); });
  };

  function stripSan(s) { return s.replace(/[+#?!]+$/g, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O').replace(/e\.p\./, '').trim(); }

  // Find the internal move matching SAN text, coordinate text ("e2e4", "e7e8q") or {from,to,promotion}.
  Chess.prototype._findMove = function (input) {
    var legal = this._legal(), i;
    if (typeof input === 'object' && input) {
      var f = sqIndex(input.from), t = sqIndex(input.to);
      var promo = input.promotion ? input.promotion.toLowerCase() : 'q';
      for (i = 0; i < legal.length; i++) {
        var m = legal[i];
        if (m.from === f && m.to === t && (!m.promotion || typeOf(m.promotion) === promo)) return m;
      }
      return null;
    }
    if (typeof input !== 'string') return null;
    var text = stripSan(input);
    for (i = 0; i < legal.length; i++) if (stripSan(this._san(legal[i], legal)) === text) return legal[i];
    // Coordinate notation
    var lan = /^([a-h][1-8])-?([a-h][1-8])([qrbnQRBN])?$/.exec(text);
    if (lan) return this._findMove({ from: lan[1], to: lan[2], promotion: lan[3] || 'q' });
    // Over-specified SAN like "Ngf3", "Qd1d4", "exd6" without ep marker, promotions without '='
    var re = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])=?([NBRQnbrq])?$/.exec(text);
    if (re) {
      var piece = (re[1] || 'P'), to = sqIndex(re[4]), pr = re[5] ? re[5].toLowerCase() : null, cands = [];
      for (i = 0; i < legal.length; i++) {
        var mv = legal[i];
        if (mv.to !== to || typeOf(mv.piece) !== piece.toLowerCase()) continue;
        if (re[2] && FILES[mv.from & 7] !== re[2]) continue;
        if (re[3] && (8 - (mv.from >> 3)) !== +re[3]) continue;
        if (mv.promotion && typeOf(mv.promotion) !== (pr || 'q')) continue;
        cands.push(mv);
      }
      if (cands.length === 1) return cands[0];
    }
    return null;
  };

  /** move(san | {from,to,promotion}) — returns verbose move or null if illegal. */
  Chess.prototype.move = function (input) {
    var m = this._findMove(input);
    if (!m) return null;
    var legal = this._legal();
    var verbose = this._verbose(m, legal);
    verbose.before = this.fen();
    this._make(m);
    this._history[this._history.length - 1].san = verbose.san;
    this._recordPosition();
    verbose.after = this.fen();
    return verbose;
  };

  Chess.prototype.undo = function () {
    if (!this._history.length) return null;
    var key = this._positionKey();
    if (this._positions[key]) { this._positions[key]--; if (!this._positions[key]) delete this._positions[key]; }
    var san = this._history[this._history.length - 1].san;
    var m = this._unmake();
    var v = this._verbose(m, this._legal());
    v.san = san || v.san;
    return v;
  };

  Chess.prototype.history = function (opts) {
    opts = opts || {};
    if (!opts.verbose) return this._history.map(function (h) { return h.san; });
    // Rebuild verbose history by replaying from the start position.
    var g = new Chess(this._startFen), out = [];
    for (var i = 0; i < this._history.length; i++) out.push(g.move(this._history[i].san));
    return out;
  };

  /* ---------------- Game end ---------------- */

  Chess.prototype.isCheckmate = function () { return this.inCheck() && this._legal().length === 0; };
  Chess.prototype.isStalemate = function () { return !this.inCheck() && this._legal().length === 0; };
  Chess.prototype.isInsufficientMaterial = function () {
    var pieces = [], bishops = [];
    for (var i = 0; i < 64; i++) {
      var p = this._board[i];
      if (!p || typeOf(p) === 'k') continue;
      var t = typeOf(p);
      if (t === 'p' || t === 'r' || t === 'q') return false;
      pieces.push(t);
      if (t === 'b') bishops.push(((i >> 3) + (i & 7)) % 2);
    }
    if (pieces.length <= 1) return true;
    if (pieces.length === bishops.length) return bishops.every(function (c) { return c === bishops[0]; });
    return false;
  };
  Chess.prototype.isThreefoldRepetition = function () { return (this._positions[this._positionKey()] || 0) >= 3; };
  Chess.prototype.isFiftyMoves = function () { return this._half >= 100; };
  Chess.prototype.isDraw = function () {
    return this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition() || this.isFiftyMoves();
  };
  Chess.prototype.isGameOver = function () { return this.isCheckmate() || this.isDraw(); };
  Chess.prototype.result = function () {
    if (this.isCheckmate()) return this._turn === 'w' ? '0-1' : '1-0';
    if (this.isDraw()) return '1/2-1/2';
    return '*';
  };
  Chess.prototype.gameOverReason = function () {
    if (this.isCheckmate()) return 'checkmate';
    if (this.isStalemate()) return 'stalemate';
    if (this.isInsufficientMaterial()) return 'insufficient material';
    if (this.isThreefoldRepetition()) return 'threefold repetition';
    if (this.isFiftyMoves()) return 'fifty-move rule';
    return null;
  };

  /* ---------------- PGN ---------------- */

  Chess.prototype.header = function (key, value) {
    if (key === undefined) return Object.assign({}, this._header);
    if (value === undefined) return this._header[key];
    this._header[key] = value;
    return this;
  };

  Chess.prototype.pgn = function () {
    var h = Object.assign({ Event: '?', Site: '?', Date: '????.??.??', Round: '?', White: '?', Black: '?' }, this._header);
    h.Result = this.result() !== '*' ? this.result() : (this._header.Result || '*');
    if (this._startFen !== DEFAULT_FEN) { h.SetUp = '1'; h.FEN = this._startFen; }
    var out = '';
    Object.keys(h).forEach(function (k) { out += '[' + k + ' "' + String(h[k]).replace(/"/g, "'") + '"]\n'; });
    out += '\n';
    var parts = this._startFen.split(' ');
    var num = parseInt(parts[5], 10) || 1, white = parts[1] === 'w', text = [];
    for (var i = 0; i < this._history.length; i++) {
      if (white) text.push(num + '.');
      else if (i === 0) text.push(num + '...');
      text.push(this._history[i].san);
      if (!white) num++;
      white = !white;
    }
    text.push(h.Result);
    // wrap at ~80 chars
    var line = '', lines = [];
    text.forEach(function (tok) {
      if ((line + ' ' + tok).trim().length > 80) { lines.push(line.trim()); line = tok; }
      else line += ' ' + tok;
    });
    if (line.trim()) lines.push(line.trim());
    return out + lines.join('\n') + '\n';
  };

  /** Parse PGN text. Returns {ok, headers, moves (SAN), error, game}. Comments and variations are ignored. */
  Chess.parsePgn = function (pgn) {
    if (typeof pgn !== 'string' || !pgn.trim()) return { ok: false, error: 'The PGN is empty.' };
    var headers = {}, re = /\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/g, m;
    while ((m = re.exec(pgn))) headers[m[1]] = m[2];
    // Keep clock comments ({[%clk 0:09:58.1]}) as markers so time use can be shown; drop all other comments.
    // (Done before removing the [Tag "…"] headers, because a clock comment also contains square brackets.)
    var body = pgn.replace(/\{[^}]*\}/g, function (c) {
      var k = c.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);
      return k ? ' \u00a7CLK' + Math.round((+k[1] * 3600 + +k[2] * 60 + +k[3]) * 10) + ' ' : ' '; // tenths of a second, no dot
    });
    body = body.replace(/\[[^\]]*\]/g, ' ').replace(/;[^\n]*/g, ' ');
    // remove nested variations
    var prev;
    do { prev = body; body = body.replace(/\([^()]*\)/g, ' '); } while (body !== prev);
    body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/\.\.\./g, ' ');
    var raw = body.split(/\s+/).filter(function (t) { return t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t); });
    var tokens = [], clocks = [], anyClock = false;
    raw.forEach(function (t) {
      if (t.indexOf('\u00a7CLK') === 0) { if (tokens.length) { clocks[tokens.length - 1] = parseInt(t.slice(4), 10) / 10; anyClock = true; } }
      else tokens.push(t);
    });
    var startFen = headers.FEN && (headers.SetUp === '1' || headers.SetUp === undefined) ? headers.FEN : DEFAULT_FEN;
    var game;
    try { game = new Chess(startFen); } catch (e) { return { ok: false, error: 'The FEN header is invalid: ' + e.message }; }
    game._header = headers;
    var moves = [];
    for (var i = 0; i < tokens.length; i++) {
      var mv = game.move(tokens[i]);
      if (!mv) {
        var moveNo = Math.floor(i / 2) + 1;
        return { ok: false, error: 'Move ' + (i + 1) + ' ("' + tokens[i] + '", around move ' + moveNo + ') is not legal in this position.', headers: headers, moves: moves, game: game };
      }
      moves.push(mv.san);
    }
    var out = { ok: true, headers: headers, moves: moves, game: game, startFen: startFen };
    if (anyClock) { for (var c = 0; c < moves.length; c++) if (clocks[c] == null) clocks[c] = null; out.clocks = clocks.slice(0, moves.length); }
    return out;
  };

  /** Split a text containing several PGN games (e.g. a chess.com or Lichess download) into single games. */
  Chess.splitPgn = function (text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n'), games = [], cur = [], inMoves = false;
    lines.forEach(function (line) {
      var isHeader = /^\s*\[\w+\s+"/.test(line);
      if (isHeader && inMoves) { games.push(cur.join('\n')); cur = []; inMoves = false; }
      if (!isHeader && line.trim()) inMoves = true;
      cur.push(line);
    });
    if (cur.join('').trim()) games.push(cur.join('\n'));
    return games.map(function (g) { return g.trim(); }).filter(Boolean);
  };

  Chess.prototype.loadPgn = function (pgn) {
    var r = Chess.parsePgn(pgn);
    if (!r.ok) throw new Error(r.error);
    this._board = r.game._board; this._turn = r.game._turn; this._castling = r.game._castling;
    this._ep = r.game._ep; this._half = r.game._half; this._full = r.game._full;
    this._history = r.game._history; this._positions = r.game._positions; this._header = r.headers;
    this._startFen = r.game._startFen;
    return true;
  };

  Chess.prototype.startFen = function () { return this._startFen; };

  /* ---------------- Perft (testing) ---------------- */
  Chess.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    var moves = this._legal(), n = 0;
    if (depth === 1) return moves.length;
    for (var i = 0; i < moves.length; i++) { this._make(moves[i]); n += this.perft(depth - 1); this._unmake(); }
    return n;
  };

  root.CT = root.CT || {};
  root.CT.Chess = Chess;
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
