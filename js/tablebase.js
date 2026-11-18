/* Exact 3-piece endgame solver: King + Queen / Rook / Pawn against a lone King.
 *
 * Built in the browser by retrograde-style iteration (no download, no external service). Each table holds,
 * for every legal position, the exact number of half-moves to checkmate with best play, or "draw".
 * KQK and KRK take well under a second to build; KPK reuses them for promotions.
 *
 * probe(fen)     → { result: 'win' | 'loss' | 'draw', plies } from the side to move's point of view, or null.
 * moves(fen)     → every legal move with its exact outcome, best first.
 * Works in Node (tests) and the browser (window.CT.Tablebase).
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};

  var N = 262144; // 64 (white king) × 64 (white piece) × 64 (black king)
  var DRAW = 255, ILLEGAL = 254; // any other value v > 0 means "mate in v-1 plies"
  var KM = [], DIRQ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], DIRR = DIRQ.slice(0, 4);
  var RAY = { Q: [], R: [] }; // RAY[t][sq] = list of rays, each a list of squares
  var LINE = new Int8Array(64 * 64).fill(-1); // direction index from a to b if aligned
  function f(s) { return s & 7; } function r(s) { return s >> 3; }
  function cheb(a, b) { return Math.max(Math.abs(f(a) - f(b)), Math.abs(r(a) - r(b))); }
  (function init() {
    for (var s = 0; s < 64; s++) {
      KM[s] = [];
      for (var df = -1; df <= 1; df++) for (var dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        var ff = f(s) + df, rr = r(s) + dr;
        if (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) KM[s].push(rr * 8 + ff);
      }
      ['Q', 'R'].forEach(function (t) {
        RAY[t][s] = (t === 'Q' ? DIRQ : DIRR).map(function (d) {
          var out = [], ff = f(s) + d[0], rr = r(s) + d[1];
          while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { out.push(rr * 8 + ff); ff += d[0]; rr += d[1]; }
          return out;
        });
      });
      DIRQ.forEach(function (d, i) {
        var ff = f(s) + d[0], rr = r(s) + d[1];
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) { LINE[s * 64 + rr * 8 + ff] = i; ff += d[0]; rr += d[1]; }
      });
    }
  })();

  function idx(wk, x, bk) { return (wk << 12) | (x << 6) | bk; }

  /** Does white's piece on x (type t) attack square s? The white king on wk blocks lines; the black king never does. */
  function attacks(t, x, s, wk) {
    if (t === 'P') return r(s) === r(x) + 1 && Math.abs(f(s) - f(x)) === 1;
    var d = LINE[x * 64 + s];
    if (d < 0 || (t === 'R' && d > 3)) return false;
    return !(LINE[x * 64 + wk] === d && cheb(x, wk) < cheb(x, s));
  }

  function whiteChildren(t, wk, x, bk, out) {
    // Returns list of [table, index] for black-to-move positions after each legal white move.
    out.length = 0;
    for (var i = 0; i < KM[wk].length; i++) {
      var k = KM[wk][i];
      if (k === x || k === bk || cheb(k, bk) <= 1) continue;
      out.push(t, idx(k, x, bk));
    }
    if (t === 'P') {
      var one = x + 8;
      if (one !== wk && one !== bk) {
        if (r(one) === 7) { out.push('Q', idx(wk, one, bk)); out.push('R', idx(wk, one, bk)); }
        else {
          out.push('P', idx(wk, one, bk));
          var two = x + 16;
          if (r(x) === 1 && two !== wk && two !== bk) out.push('P', idx(wk, two, bk));
        }
      }
      return out;
    }
    var rays = RAY[t][x];
    for (var a = 0; a < rays.length; a++) {
      var ray = rays[a];
      for (var j = 0; j < ray.length; j++) {
        var s = ray[j];
        if (s === wk || s === bk) break;
        out.push(t, idx(wk, s, bk));
      }
    }
    return out;
  }

  var tables = {};

  function build(t) {
    if (tables[t]) return tables[t];
    if (t === 'P') { build('Q'); build('R'); }
    var W = new Uint8Array(N), B = new Uint8Array(N);
    var tb = tables[t] = { W: W, B: B, type: t };
    var wk, x, bk, i, unkW = [], unkB = [], bChildren = {};
    // 1. Legality, mates, stalemates and "black captures the lone piece" draws.
    for (wk = 0; wk < 64; wk++) for (x = 0; x < 64; x++) for (bk = 0; bk < 64; bk++) {
      i = idx(wk, x, bk);
      var bad = wk === x || wk === bk || x === bk || cheb(wk, bk) <= 1 || (t === 'P' && (r(x) === 0 || r(x) === 7));
      if (bad) { W[i] = ILLEGAL; B[i] = ILLEGAL; continue; }
      // White to move: black must not be in check.
      if (attacks(t, x, bk, wk)) W[i] = ILLEGAL; else unkW.push(i);
      // Black to move.
      var kids = [], escape = false;
      for (var m = 0; m < KM[bk].length; m++) {
        var s = KM[bk][m];
        if (s === wk || cheb(s, wk) <= 1) continue;
        if (s === x) { if (cheb(x, wk) > 1) escape = true; continue; }
        if (attacks(t, x, s, wk)) continue;
        kids.push(idx(wk, x, s));
      }
      if (escape) { B[i] = DRAW; continue; }
      if (!kids.length) { B[i] = attacks(t, x, bk, wk) ? 1 : DRAW; continue; }
      bChildren[i] = kids; unkB.push(i);
    }
    // 2. Iterate ply by ply: white wins if ANY move reaches a lost black position; black is lost if ALL moves do.
    var buf = [], L = 1, quiet = 0;
    while (quiet < 2 && L < 250) {
      var added = 0;
      if (L % 2) {
        var keepW = [];
        for (var a = 0; a < unkW.length; a++) {
          i = unkW[a]; wk = i >> 12; x = (i >> 6) & 63; bk = i & 63;
          whiteChildren(t, wk, x, bk, buf);
          var hit = false;
          for (var c = 0; c < buf.length; c += 2) {
            var tab = buf[c] === t ? B : tables[buf[c]].B, v = tab[buf[c + 1]];
            if (v === L) { hit = true; break; }
          }
          if (hit) { W[i] = L + 1; added++; } else keepW.push(i);
        }
        unkW = keepW;
      } else {
        var keepB = [];
        for (var b = 0; b < unkB.length; b++) {
          i = unkB[b];
          var ks = bChildren[i], all = true;
          for (var k = 0; k < ks.length; k++) { var w = W[ks[k]]; if (!w || w >= ILLEGAL) { all = false; break; } }
          if (all) { B[i] = L + 1; added++; delete bChildren[i]; } else keepB.push(i);
        }
        unkB = keepB;
      }
      quiet = added ? 0 : quiet + 1;
      L++;
    }
    unkW.forEach(function (j) { W[j] = DRAW; });
    unkB.forEach(function (j) { B[j] = DRAW; });
    return tb;
  }

  /* ---------- FEN interface ---------- */
  function sqIndex(name) { return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97); }
  function sqName(s) { return 'abcdefgh'[f(s)] + (r(s) + 1); }

  /** Parse a FEN with exactly two kings and one Q/R/P. Returns a normalised description (strong side = white). */
  function parse(fen) {
    var parts = String(fen).trim().split(/\s+/), rows = parts[0].split('/');
    if (rows.length !== 8) return null;
    var pcs = [];
    for (var rr = 0; rr < 8; rr++) {
      var file = 0;
      for (var ch of rows[rr]) {
        if (/\d/.test(ch)) file += +ch;
        else { pcs.push({ p: ch, s: (7 - rr) * 8 + file }); file++; }
      }
    }
    if (pcs.length !== 3) return null;
    var extra = pcs.filter(function (q) { return !/k/i.test(q.p); })[0];
    if (!extra || !/^[QRPqrp]$/.test(extra.p)) return null;
    var strongWhite = extra.p === extra.p.toUpperCase();
    var flip = function (s) { return strongWhite ? s : (7 - r(s)) * 8 + f(s); };
    var K = pcs.filter(function (q) { return q.p === (strongWhite ? 'K' : 'k'); })[0], k = pcs.filter(function (q) { return q.p === (strongWhite ? 'k' : 'K'); })[0];
    if (!K || !k) return null;
    var stm = parts[1] === 'b' ? 'b' : 'w';
    return { type: extra.p.toUpperCase(), wk: flip(K.s), x: flip(extra.s), bk: flip(k.s), strongToMove: (stm === 'w') === strongWhite, strongColor: strongWhite ? 'w' : 'b' };
  }

  function probe(fen) {
    var d = parse(fen);
    if (!d) return null;
    var tb = build(d.type), i = idx(d.wk, d.x, d.bk);
    var v = d.strongToMove ? tb.W[i] : tb.B[i];
    if (v === ILLEGAL) return null;
    if (v === DRAW) return { result: 'draw', plies: null, type: d.type, strongColor: d.strongColor };
    return { result: d.strongToMove ? 'win' : 'loss', plies: v - 1, type: d.type, strongColor: d.strongColor };
  }

  /** Exact outcome of a position after a move: score from the mover's side. */
  function outcomeAfter(game) {
    if (game.isCheckmate()) return { result: 'win', plies: 0 };
    if (game.isStalemate() || game.isDraw()) return { result: 'draw', plies: null };
    var p = probe(game.fen());
    if (!p) return { result: 'draw', plies: null }; // e.g. the lone piece was captured: K v K
    return { result: p.result === 'win' ? 'loss' : p.result === 'loss' ? 'win' : 'draw', plies: p.plies == null ? null : p.plies + 1 };
  }

  /** Every legal move with its exact result for the side playing it. Best first (fast wins, then draws, then slow losses). */
  function moves(fen) {
    var Chess = CT.Chess, g, out = [];
    try { g = new Chess(fen); } catch (e) { return out; }
    g.moves({ verbose: true }).forEach(function (m) {
      var h = new Chess(fen);
      h.move(m.san);
      var o = outcomeAfter(h);
      out.push({ san: h.history().slice(-1)[0], from: m.from, to: m.to, promotion: m.promotion, result: o.result, plies: o.plies, stalemate: h.isStalemate() });
    });
    var rank = function (m) { return m.result === 'win' ? 1e4 - m.plies : m.result === 'draw' ? 0 : -1e4 + (m.plies || 0); };
    out.sort(function (a, b) { return rank(b) - rank(a); });
    return out;
  }

  /** The defender's choice: the move that lasts longest (draws if one exists). Ties broken at random. */
  function defend(fen) {
    var list = moves(fen);
    if (!list.length) return null;
    var best = list[0], same = list.filter(function (m) { return m.result === best.result && m.plies === best.plies; });
    return same[Math.floor(Math.random() * same.length)];
  }

  /** Random legal position of the given type and side to move with the exact result/plies window. */
  function randomPosition(type, opts) {
    opts = opts || {};
    var tb = build(type), tries = 0;
    var minP = opts.minPlies == null ? 0 : opts.minPlies, maxP = opts.maxPlies == null ? 250 : opts.maxPlies;
    var rand = opts.rand || Math.random;
    while (tries++ < 200000) {
      var wk = Math.floor(rand() * 64), x = Math.floor(rand() * 64), bk = Math.floor(rand() * 64);
      if (opts.filter && !opts.filter(wk, x, bk)) continue;
      var i = idx(wk, x, bk), v = opts.blackToMove ? tb.B[i] : tb.W[i];
      if (v === ILLEGAL) continue;
      if (opts.result === 'draw') { if (v !== DRAW) continue; }
      else if (v === DRAW || v - 1 < minP || v - 1 > maxP) continue;
      return toFen(type, wk, x, bk, opts.blackToMove ? 'b' : 'w');
    }
    return null;
  }
  function toFen(type, wk, x, bk, stm) {
    var board = [];
    for (var s = 0; s < 64; s++) board[s] = s === wk ? 'K' : s === x ? type : s === bk ? 'k' : null;
    var rows = [];
    for (var rr = 7; rr >= 0; rr--) {
      var row = '', e = 0;
      for (var ff = 0; ff < 8; ff++) { var pc = board[rr * 8 + ff]; if (pc) { if (e) { row += e; e = 0; } row += pc; } else e++; }
      if (e) row += e;
      rows.push(row);
    }
    return rows.join('/') + ' ' + stm + ' - - 0 1';
  }

  CT.Tablebase = { build: build, probe: probe, moves: moves, defend: defend, outcomeAfter: outcomeAfter, randomPosition: randomPosition, toFen: toFen, sqName: sqName, sqIndex: sqIndex, built: function (t) { return !!tables[t]; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = CT.Tablebase;
})(typeof window !== 'undefined' ? window : globalThis);
