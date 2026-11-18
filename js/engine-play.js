/*
 * engine-play.js — The stronger built-in engine ("Trainer Engine"), used when Stockfish can't load:
 * for computer opponents and as the fallback for game review.
 *
 * It is separate from engine.js on purpose: engine.js is the exact, simple checker that verifies puzzles
 * and traps (forced mates, material wins). This file plays chess: it understands piece placement, pawn
 * structure, king safety and open files, and searches deeper with standard techniques:
 *   iterative deepening · alpha-beta (PVS) · transposition table · null-move pruning ·
 *   late-move reductions · killer/history move ordering · check extensions · quiescence search.
 * It is still far weaker than Stockfish (see PROGRESS.md for measured results).
 *
 * think(game, {timeMs, maxDepth, multipv}) → {best, depth, nodes, moves:[{san, score, mate}]}
 * Scores are centipawns from the side to move's point of view; mate = ±(MATE - plies).
 */
(function (root) {
  'use strict';
  var MATE = 100000, INF = 1e9;
  var TYPE = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
  var MG = [82, 337, 365, 477, 1025, 0], EG = [94, 281, 297, 512, 936, 0];
  var PHASE = [0, 1, 1, 2, 4, 0];
  var SEE_VAL = [100, 320, 330, 500, 900, 20000];

  /* Piece-square tables from White's point of view, index 0 = a8 … 63 = h1 (as in the board array). */
  var PST_MG = [
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 22, 22, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  ];
  var PST_EG = [
    [0, 0, 0, 0, 0, 0, 0, 0, 80, 80, 80, 80, 80, 80, 80, 80, 50, 50, 50, 50, 50, 50, 50, 50, 30, 30, 30, 30, 30, 30, 30, 30, 15, 15, 15, 15, 15, 15, 15, 15, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PST_MG[1], PST_MG[2],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    PST_MG[4],
    [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  ];
  var PASSED = [5, 10, 20, 35, 60, 100]; // by ranks advanced from the pawn's start rank (0 = not yet moved)

  function isW(p) { return p < 'a'; }

  /* ---------------- evaluation ---------------- */
  function evaluate(g) {
    var b = g._board, mg = [0, 0], eg = [0, 0], phase = 0, bishops = [0, 0];
    var pawnFiles = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]];
    var pawnSq = [[], []], rooks = [[], []], kingSq = [0, 0];
    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (!p) continue;
      var c = isW(p) ? 0 : 1, t = TYPE[p.toLowerCase()], idx = c === 0 ? i : i ^ 56;
      mg[c] += MG[t] + PST_MG[t][idx];
      eg[c] += EG[t] + PST_EG[t][idx];
      phase += PHASE[t];
      if (t === 0) { pawnFiles[c][i & 7]++; pawnSq[c].push(i); }
      else if (t === 2) bishops[c]++;
      else if (t === 3) rooks[c].push(i);
      else if (t === 5) kingSq[c] = i;
    }
    for (c = 0; c < 2; c++) {
      var o = 1 - c;
      if (bishops[c] >= 2) { mg[c] += 30; eg[c] += 45; }
      // Pawn structure
      for (var f = 0; f < 8; f++) if (pawnFiles[c][f] > 1) { mg[c] -= 12 * (pawnFiles[c][f] - 1); eg[c] -= 20 * (pawnFiles[c][f] - 1); }
      pawnSq[c].forEach(function (sq) {
        var file = sq & 7, row = sq >> 3;
        var left = file > 0 ? pawnFiles[c][file - 1] : 0, right = file < 7 ? pawnFiles[c][file + 1] : 0;
        if (!left && !right) { mg[c] -= 10; eg[c] -= 15; }
        // Passed pawn: no enemy pawn ahead on this or adjacent files
        var passed = true;
        for (var k = 0; k < pawnSq[o].length && passed; k++) {
          var e = pawnSq[o][k], ef = e & 7, er = e >> 3;
          if (Math.abs(ef - file) <= 1 && (c === 0 ? er < row : er > row)) passed = false;
        }
        if (passed) { var adv = c === 0 ? 6 - row : row - 1; mg[c] += PASSED[adv] / 2; eg[c] += PASSED[adv]; }
      });
      // Rooks on open / half-open files
      rooks[c].forEach(function (sq) {
        var file = sq & 7;
        if (!pawnFiles[c][file]) { mg[c] += pawnFiles[o][file] ? 10 : 20; eg[c] += 10; }
      });
      // King shelter (middlegame): pawns in front of a castled king
      var ks = kingSq[c], kf = ks & 7, kr = ks >> 3;
      if ((c === 0 && kr >= 6) || (c === 1 && kr <= 1)) {
        if (kf <= 2 || kf >= 5) {
          var dir = c === 0 ? -1 : 1, shelter = 0;
          for (var df = -1; df <= 1; df++) {
            var ff = kf + df; if (ff < 0 || ff > 7) continue;
            var p1 = b[(kr + dir) * 8 + ff], p2 = (kr + 2 * dir >= 0 && kr + 2 * dir < 8) ? b[(kr + 2 * dir) * 8 + ff] : null;
            var own = c === 0 ? 'P' : 'p';
            if (p1 === own) shelter += 2; else if (p2 === own) shelter += 1; else mg[c] -= 18;
          }
          mg[c] += shelter * 4;
        } else mg[c] -= 15; // uncastled king in the centre with queens around
      }
    }
    if (phase > 24) phase = 24;
    var mgS = mg[0] - mg[1], egS = eg[0] - eg[1];
    var s = Math.round((mgS * phase + egS * (24 - phase)) / 24);
    // Drawish: no pawns and a minor-piece advantage only
    s = g._turn === 'w' ? s : -s;
    return s + 10; // tempo
  }

  /* ---------------- hashing (Zobrist, two 32-bit halves) ---------------- */
  var ZOB = (function () {
    var seed = 0x2545F491;
    function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
    var t = { pieces: {}, side: [rnd(), rnd()], castle: {}, ep: [] };
    'PNBRQKpnbrqk'.split('').forEach(function (p) { t.pieces[p] = []; for (var i = 0; i < 64; i++) t.pieces[p].push([rnd(), rnd()]); });
    ['K', 'Q', 'k', 'q'].forEach(function (k) { t.castle[k] = [rnd(), rnd()]; });
    for (var f = 0; f < 8; f++) t.ep.push([rnd(), rnd()]);
    return t;
  })();
  function hash(g) {
    var h1 = 0, h2 = 0, b = g._board;
    for (var i = 0; i < 64; i++) { var p = b[i]; if (p) { var z = ZOB.pieces[p][i]; h1 ^= z[0]; h2 ^= z[1]; } }
    if (g._turn === 'b') { h1 ^= ZOB.side[0]; h2 ^= ZOB.side[1]; }
    var cs = g._castling;
    for (var k in cs) if (cs[k]) { h1 ^= ZOB.castle[k][0]; h2 ^= ZOB.castle[k][1]; }
    if (g._ep >= 0) { h1 ^= ZOB.ep[g._ep & 7][0]; h2 ^= ZOB.ep[g._ep & 7][1]; }
    return [h1, h2];
  }

  /* ---------------- transposition table ---------------- */
  var TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var ttKey = new Int32Array(TT_SIZE), ttCheck = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE),
    ttFlag = new Int8Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE);
  var EXACT = 1, LOWER = 2, UPPER = 3;
  function code(m) { return m.from | (m.to << 6) | ((m.promotion ? 'nbrq'.indexOf(m.promotion.toLowerCase()) + 1 : 0) << 12); }
  function toTT(s, ply) { return s > MATE - 1000 ? s + ply : s < -MATE + 1000 ? s - ply : s; }
  function fromTT(s, ply) { return s > MATE - 1000 ? s - ply : s < -MATE + 1000 ? s + ply : s; }

  function Search(g, deadline, maxNodes) {
    this.g = g; this.deadline = deadline; this.maxNodes = maxNodes || Infinity; this.nodes = 0; this.stop = false;
    this.killers = []; this.history = {}; this.path = [];
  }

  Search.prototype.timeUp = function () {
    if ((this.nodes & 1023) === 0 && (Date.now() > this.deadline || this.nodes > this.maxNodes)) this.stop = true;
    return this.stop;
  };

  Search.prototype.order = function (moves, ttm, ply) {
    var k = this.killers[ply] || [], hist = this.history;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], c = code(m), s;
      if (c === ttm) s = 1e7;
      else if (m.captured) s = 1e6 + SEE_VAL[TYPE[m.captured.toLowerCase()]] * 10 - SEE_VAL[TYPE[m.piece.toLowerCase()]];
      else if (m.promotion) s = 9e5;
      else if (c === k[0]) s = 8e5; else if (c === k[1]) s = 7e5;
      else s = hist[c] || 0;
      m._s = s;
    }
    return moves.sort(function (a, b) { return b._s - a._s; });
  };

  Search.prototype.qsearch = function (alpha, beta, ply, qd) {
    var g = this.g;
    this.nodes++;
    if (this.timeUp()) return 0;
    var inCheck = g.inCheck();
    var stand = inCheck ? -INF : evaluate(g);
    if (!inCheck) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (qd > 8) return stand;
    } else if (qd > 10) return evaluate(g);
    var moves = g._pseudo(), us = g._turn, any = false;
    if (!inCheck) moves = moves.filter(function (m) { return m.captured || m.promotion; });
    this.order(moves, 0, 63);
    var best = inCheck ? -INF : stand;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (!inCheck && m.captured && stand + SEE_VAL[TYPE[m.captured.toLowerCase()]] + 200 < alpha && !m.promotion) continue; // delta pruning
      g._make(m);
      if (g._attacked(g._kingSq(us), g._turn)) { g._unmake(); continue; }
      any = true;
      var v = -this.qsearch(-beta, -alpha, ply + 1, qd + 1);
      g._unmake();
      if (this.stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (inCheck && !any) return -MATE + ply;
    return best;
  };

  Search.prototype.hasPieces = function (us) {
    var b = this.g._board;
    for (var i = 0; i < 64; i++) { var p = b[i]; if (p && (us === 'w') === isW(p) && 'nbrqNBRQ'.indexOf(p) >= 0) return true; }
    return false;
  };

  Search.prototype.negamax = function (depth, alpha, beta, ply, allowNull) {
    var g = this.g;
    if (this.timeUp()) return 0;
    var h = hash(g), slot = h[0] & TT_MASK;
    // Repetition inside the search line, or fifty-move rule → draw
    if (ply > 0) {
      if (g._half >= 100) return 0;
      for (var r = this.path.length - 2; r >= 0 && r >= this.path.length - g._half - 1; r -= 2) {
        if (this.path[r][0] === h[0] && this.path[r][1] === h[1]) return 0;
      }
    }
    var inCheck = g.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.qsearch(alpha, beta, ply, 0);
    this.nodes++;
    var pvNode = beta - alpha > 1, ttm = 0;
    if (ttKey[slot] === h[0] && ttCheck[slot] === h[1]) {
      ttm = ttMove[slot];
      if (!pvNode && ttDepth[slot] >= depth) {
        var ts = fromTT(ttScore[slot], ply), tf = ttFlag[slot];
        if (tf === EXACT || (tf === LOWER && ts >= beta) || (tf === UPPER && ts <= alpha)) return ts;
      }
    }
    var us = g._turn;
    // Null-move pruning
    if (allowNull && !pvNode && !inCheck && depth >= 3 && this.hasPieces(us) && evaluate(g) >= beta) {
      var ep = g._ep; g._ep = -1; g._turn = us === 'w' ? 'b' : 'w';
      this.path.push(h);
      var nv = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      this.path.pop();
      g._turn = us; g._ep = ep;
      if (this.stop) return 0;
      if (nv >= beta && nv < MATE - 1000) return beta;
    }
    var moves = this.order(g._pseudo(), ttm, ply);
    var best = -INF, bestCode = 0, legal = 0, a0 = alpha;
    this.path.push(h);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      g._make(m);
      if (g._attacked(g._kingSq(us), g._turn)) { g._unmake(); continue; }
      legal++;
      var quiet = !m.captured && !m.promotion, v;
      if (legal === 1) v = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = 0;
        if (quiet && depth >= 3 && legal > 4 && !inCheck && !g.inCheck()) red = legal > 10 ? 2 : 1;
        v = -this.negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (!this.stop && v > alpha && (red || v < beta)) v = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      g._unmake();
      if (this.stop) { this.path.pop(); return 0; }
      if (v > best) { best = v; bestCode = code(m); }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (quiet) {
          var k = this.killers[ply] || (this.killers[ply] = [0, 0]);
          if (k[0] !== bestCode) { k[1] = k[0]; k[0] = bestCode; }
          this.history[bestCode] = (this.history[bestCode] || 0) + depth * depth;
        }
        break;
      }
    }
    this.path.pop();
    if (!legal) return inCheck ? -MATE + ply : 0;
    ttKey[slot] = h[0]; ttCheck[slot] = h[1]; ttDepth[slot] = depth; ttMove[slot] = bestCode;
    ttScore[slot] = toTT(best, ply);
    ttFlag[slot] = best >= beta ? LOWER : best > a0 ? EXACT : UPPER;
    return best;
  };

  /**
   * Think about the position. Returns scores for the top `multipv` root moves (exact, full window),
   * from the deepest iteration that finished within the time limit.
   */
  function think(game, opts) {
    opts = opts || {};
    var Chess = game.constructor, g = new Chess(game.fen());
    var timeMs = opts.timeMs || 1000, maxDepth = opts.maxDepth || 30, K = opts.multipv || 1;
    var deadline = Date.now() + timeMs, s = new Search(g, deadline, opts.maxNodes);
    var us = g._turn, roots = [];
    g._pseudo().forEach(function (m) { g._make(m); if (!g._attacked(g._kingSq(us), g._turn)) roots.push({ m: m, score: -INF }); g._unmake(); });
    if (!roots.length) return { best: null, depth: 0, nodes: 0, moves: [] };
    var legalList = roots.map(function (r) { return r.m; });
    roots.forEach(function (r) { r.san = g._san(r.m, legalList); });
    // Order roots by a quick static look before the first iteration.
    s.order(legalList, 0, 0);
    roots.sort(function (a, b) { return b.m._s - a.m._s; });
    var done = null, depth;
    for (depth = 1; depth <= maxDepth; depth++) {
      var scores = [], kth = -INF;
      s.path = [];
      for (var i = 0; i < roots.length; i++) {
        var r = roots[i], v;
        g._make(r.m);
        if (i < K) v = -s.negamax(depth - 1, -INF, INF, 1, true);
        else {
          v = -s.negamax(depth - 1, -kth - 1, -kth, 1, true);
          if (!s.stop && v > kth) v = -s.negamax(depth - 1, -INF, INF, 1, true);
        }
        g._unmake();
        if (s.stop) break;
        scores.push({ r: r, v: v });
        if (scores.length >= K) kth = scores.map(function (x) { return x.v; }).sort(function (a, b) { return b - a; })[K - 1];
      }
      if (s.stop && depth > 1) break;
      scores.forEach(function (x) { x.r.score = x.v; });
      roots.sort(function (a, b) { return b.score - a.score; });
      done = { depth: depth, roots: roots.map(function (r) { return { san: r.san, score: r.score }; }) };
      if (s.stop) break;
      if (Math.abs(roots[0].score) > MATE - 1000 && depth >= 4) break; // mate found
      if (Date.now() > deadline - timeMs * 0.45 && depth >= 2) break;    // next iteration would not finish
    }
    if (!done) done = { depth: 0, roots: roots.map(function (r) { return { san: r.san, score: r.score === -INF ? 0 : r.score }; }) };
    var list = done.roots.slice(0, Math.max(K, 1)).map(function (x) {
      return { san: x.san, score: x.score, mate: Math.abs(x.score) > MATE - 1000 ? (x.score > 0 ? Math.ceil((MATE - x.score) / 2) : -Math.ceil((MATE + x.score) / 2)) : null };
    });
    return { best: list[0].san, depth: done.depth, nodes: s.nodes, moves: list };
  }

  root.CT = root.CT || {};
  root.CT.EnginePlay = { think: think, evaluate: evaluate, MATE: MATE, name: 'Trainer Engine' };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CT.EnginePlay;
})(typeof window !== 'undefined' ? window : globalThis);
