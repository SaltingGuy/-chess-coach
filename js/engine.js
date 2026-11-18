/*
 * engine.js — A small built-in search engine ("mini-engine").
 * Purpose: verify training content (forced mates, material-winning tactics) and give quick,
 * shallow feedback in the browser. It is NOT Stockfish: it searches a few moves deep and
 * counts material. Deep evaluation uses Stockfish (js/stockfish.js) when available.
 */
(function (root) {
  'use strict';
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var MATE = 100000;
  // Small centralisation bonus so that equal-material moves are ordered sensibly.
  var CENTER = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 2, 4, 6, 6, 4, 2, 0,
    0, 4, 8, 10, 10, 8, 4, 0,
    0, 6, 10, 14, 14, 10, 6, 0,
    0, 6, 10, 14, 14, 10, 6, 0,
    0, 4, 8, 10, 10, 8, 4, 0,
    0, 2, 4, 6, 6, 4, 2, 0,
    0, 0, 0, 0, 0, 0, 0, 0
  ];

  function lower(p) { return p.toLowerCase(); }
  function isWhite(p) { return p !== p.toLowerCase(); }

  function evaluate(g) {
    var s = 0, b = g._board;
    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (!p) continue;
      var t = lower(p), v = VAL[t] + (t === 'n' || t === 'b' || t === 'p' ? CENTER[i] : 0);
      s += isWhite(p) ? v : -v;
    }
    return g._turn === 'w' ? s : -s;
  }

  function orderMoves(moves) {
    return moves.sort(function (a, b) { return score(b) - score(a); });
    function score(m) {
      var s = 0;
      if (m.captured) s += 10 * VAL[lower(m.captured)] - VAL[lower(m.piece)];
      if (m.promotion) s += VAL[lower(m.promotion)];
      return s;
    }
  }

  function Searcher(maxNodes) { this.nodes = 0; this.maxNodes = maxNodes || 2e6; this.aborted = false; }

  Searcher.prototype.qsearch = function (g, alpha, beta, ply, qd) {
    this.nodes++;
    var inCheck = g.inCheck();
    var moves = g._legal();
    if (!moves.length) return inCheck ? -MATE + ply : 0;
    var stand = evaluate(g);
    if (!inCheck) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      moves = moves.filter(function (m) { return m.captured || m.promotion; });
    }
    if (qd > 6) return stand;
    orderMoves(moves);
    for (var i = 0; i < moves.length; i++) {
      g._make(moves[i]);
      var v = -this.qsearch(g, -beta, -alpha, ply + 1, qd + 1);
      g._unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  };

  Searcher.prototype.search = function (g, depth, alpha, beta, ply) {
    if (this.nodes > this.maxNodes) { this.aborted = true; return evaluate(g); }
    var moves = g._legal();
    if (!moves.length) return g.inCheck() ? -MATE + ply : 0;
    if (depth <= 0) return this.qsearch(g, alpha, beta, ply, 0);
    this.nodes++;
    orderMoves(moves);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      g._make(moves[i]);
      var v = -this.search(g, depth - 1, -beta, -alpha, ply + 1);
      g._unmake();
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };

  /**
   * Score every legal move in the position (from the mover's point of view, in centipawns).
   * depth = plies searched after the root move (plus capture search).
   */
  function analyseAll(g, depth, maxNodes) {
    var s = new Searcher(maxNodes), legal = g._legal(), out = [];
    for (var i = 0; i < legal.length; i++) {
      var san = g._san(legal[i], legal);
      g._make(legal[i]);
      var v = -s.search(g, depth, -Infinity, Infinity, 1);
      g._unmake();
      out.push({ san: san, score: v, mate: Math.abs(v) > MATE - 1000 });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return { moves: out, nodes: s.nodes, aborted: s.aborted };
  }

  /** Best move with a single search (cheaper than analyseAll). */
  function bestMove(g, depth, maxNodes) {
    var s = new Searcher(maxNodes), legal = orderMoves(g._legal()), best = null, alpha = -Infinity;
    for (var i = 0; i < legal.length; i++) {
      g._make(legal[i]);
      var v = -s.search(g, depth, -Infinity, -alpha, 1);
      g._unmake();
      if (v > alpha || !best) { alpha = v; best = legal[i]; }
    }
    if (!best) return null;
    return { san: g._san(best, g._legal()), score: alpha, nodes: s.nodes };
  }

  /** Can the side to move force checkmate within n of its own moves? (exact, exhaustive) */
  function mateIn(g, n) {
    var moves = g._legal();
    // Try checking moves first: much faster to find mates.
    moves.sort(function (a, b) { return givesCheck(g, b) - givesCheck(g, a); });
    for (var i = 0; i < moves.length; i++) {
      if (moveForcesMate(g, moves[i], n)) return true;
    }
    return false;
  }

  function givesCheck(g, m) { g._make(m); var c = g.inCheck() ? 1 : 0; g._unmake(); return c; }

  // After playing internal move m, is mate forced within n moves (counting m as move 1)?
  function moveForcesMate(g, m, n) {
    g._make(m);
    var replies = g._legal(), result;
    if (!replies.length) result = g.inCheck();
    else if (n <= 1) result = false;
    else {
      result = true;
      for (var j = 0; j < replies.length && result; j++) {
        g._make(replies[j]);
        if (!mateIn(g, n - 1)) result = false;
        g._unmake();
      }
    }
    g._unmake();
    return result;
  }

  /** List SAN of every move that forces mate within n moves. */
  function matingMoves(g, n) {
    var legal = g._legal(), out = [];
    for (var i = 0; i < legal.length; i++) if (moveForcesMate(g, legal[i], n)) out.push(g._san(legal[i], legal));
    return out;
  }

  /** Does playing `san` (a legal move) keep a forced mate within n moves? */
  function sanForcesMate(g, san, n) {
    var m = g._findMove(san);
    return !!m && moveForcesMate(g, m, n);
  }

  /** Opponent's longest-resisting defence when they are being mated (falls back to first legal). */
  function stubbornDefence(g, n) {
    var legal = g._legal();
    if (!legal.length) return null;
    // Prefer the reply after which the attacker needs the most moves to mate.
    var best = null, bestNeed = -1;
    for (var j = 0; j < legal.length; j++) {
      g._make(legal[j]);
      var need = n + 1;
      for (var d = 1; d <= n; d++) if (mateIn(g, d)) { need = d; break; }
      g._unmake();
      if (need > bestNeed) { bestNeed = need; best = legal[j]; }
    }
    return g._san(best, legal);
  }

  /** The opponent's strongest reply after the user plays `san`, with the material swing. Used to explain wrong moves. */
  function refute(g, san, depth) {
    var m = g._findMove(san);
    if (!m) return null;
    g._make(m);
    if (!g._legal().length) { g._unmake(); return null; }
    var reply = bestMove(g, depth || 2, 3e5);
    g._unmake();
    return reply;
  }

  root.CT = root.CT || {};
  root.CT.Engine = {
    VAL: VAL, MATE: MATE, evaluate: evaluate, analyseAll: analyseAll, bestMove: bestMove,
    mateIn: mateIn, matingMoves: matingMoves, sanForcesMate: sanForcesMate,
    stubbornDefence: stubbornDefence, refute: refute
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CT.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
