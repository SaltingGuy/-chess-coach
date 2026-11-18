/* Endgame Academy (level 1) and "Convert the Win" — the training logic, no UI.
 *
 * Drills are played against the exact 3-piece solver (js/tablebase.js), so every verdict is exact:
 *   kq-mate   King + Queen v King: mate within the move limit, never stalemate.
 *   kr-mate   King + Rook v King: the "box" method; timed (milestone: under 60 seconds).
 *   stalemate Don't stalemate!: positions where natural queen moves stalemate. Find a move that keeps the win.
 *   kpk-win   King + Pawn v King (attacker): use the opposition and promote.
 *   kpk-hold  King v King + Pawn (defender): take the opposition and hold the draw.
 * Convert the Win: start a real game a piece or more up (from a real Lichess game) against a defensive or tactical bot.
 * Pass = win without letting your lead drop below +2.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  function S() { return CT.Store; }
  function TB() { return CT.Tablebase; }

  var DRILLS = [
    { id: 'kq-mate', name: 'Queen checkmate', icon: '♛', type: 'Q', color: 'w', minPlies: 11, maxPlies: 19, slack: 10, sets: 1,
      goal: 'Checkmate the lone king with king and queen.',
      teach: [
        'Use the queen like a fence: put it a knight\'s move away from the enemy king, then follow the king as it moves. Each step the box gets smaller.',
        'When the king is on the edge, STOP shrinking the box. Bring your own king up until it protects the mating square.',
        'Before every queen move ask: does the enemy king still have a legal move? If not and it is not in check, it is stalemate — a draw.'
      ] },
    { id: 'stalemate', name: 'Don\'t stalemate!', icon: '⚠', type: 'Q', color: 'w', quiz: 5,
      goal: 'Five positions where an obvious queen move stalemates. Find a move that keeps the win (mate is best).',
      teach: [
        'Stalemate = the side to move has no legal move and is NOT in check. It is a draw, even if you have a queen.',
        'It happens most when the enemy king is in a corner and your queen takes away its last squares without giving check.',
        'Habit: before you play a quiet queen move near a cornered king, count the king\'s squares. Zero squares and no check = stalemate.'
      ] },
    { id: 'kr-mate', name: 'Rook checkmate', icon: '♜', type: 'R', color: 'w', minPlies: 19, maxPlies: 31, slack: 14, timed: true,
      goal: 'Checkmate with king and rook. Milestone 1000 asks for it in under 60 seconds.',
      teach: [
        'Cut the king off with the rook along a rank or file, making a box.',
        'Walk your king towards the enemy king. When the kings face each other with one square between (opposition), check with the rook to push it back one line.',
        'If the enemy king attacks your rook, move the rook far away along the same line. Never give a check that lets the king out of the box.'
      ] },
    { id: 'kpk-win', name: 'King + pawn: win it', icon: '♙', type: 'P', color: 'w', kpk: 'win',
      goal: 'Promote the pawn safely. Every move is checked: one wrong king move can turn a win into a draw.',
      teach: [
        'Put your king IN FRONT of the pawn, not behind it. The king clears the way; the pawn follows.',
        'The opposition: kings on the same file with one square between. Whoever does NOT have to move holds the opposition — the other king must step aside.',
        'Key squares: if your king reaches two squares in front of the pawn (for a pawn on the 2nd–4th rank), the pawn queens no matter what.'
      ] },
    { id: 'kpk-hold', name: 'King v pawn: hold the draw', icon: '♔', type: 'P', color: 'b', kpk: 'draw',
      goal: 'Defend: block the pawn with your king and take the opposition. Hold the draw for 10 moves or capture the pawn.',
      teach: [
        'Stand directly in front of the pawn. Keep your king there or one square diagonally back.',
        'When the attacking king comes up, step straight back in front of it so the kings face each other — take the opposition.',
        'If the pawn reaches the 7th rank with your king in front of it, the attacker must stalemate you or give up the pawn.'
      ] }
  ];
  var BY = {}; DRILLS.forEach(function (d) { BY[d.id] = d; });
  var INTERVALS = [0, 1, 3, 7, 16, 35].map(function (d) { return d * 86400000; });

  function recs() { return S().state.endgames || (S().state.endgames = {}); }
  function rec(id) { return recs()[id] || null; }

  /** Record a finished drill. result: { pass, ms, moves, stars } */
  function record(id, result) {
    var all = recs(), r = all[id] || { attempts: 0, passes: 0, box: 0, due: 0, bestMs: null, bestStars: 0 };
    r.attempts++; r.lastAt = Date.now(); r.lastPass = !!result.pass;
    if (result.pass) {
      r.passes++; r.box = Math.min(r.box + 1, INTERVALS.length - 1);
      if (result.ms && (!r.bestMs || result.ms < r.bestMs)) r.bestMs = result.ms;
      r.bestStars = Math.max(r.bestStars || 0, result.stars || 1);
    } else r.box = 0;
    r.due = Date.now() + (result.pass ? INTERVALS[r.box] : 10 * 60000);
    all[id] = r;
    S().bumpDay('endgames');
    return r;
  }

  /** Next drill: never passed (in curriculum order), then due for review, then the weakest. */
  function next() {
    var all = recs(), now = Date.now();
    var fresh = DRILLS.filter(function (d) { return !all[d.id] || !all[d.id].passes; })[0];
    if (fresh) return { drill: fresh, href: '#/endgames/' + fresh.id, label: (all[fresh.id] ? 'Try again: ' : 'New: ') + fresh.name };
    var due = DRILLS.filter(function (d) { return all[d.id].due <= now; }).sort(function (a, b) { return all[a.id].box - all[b.id].box; })[0];
    if (due) return { drill: due, href: '#/endgames/' + due.id, label: 'Review: ' + due.name };
    var c = convertStats();
    return { drill: null, href: '#/endgames/convert', label: 'Convert the Win' + (c.attempts ? ' (' + c.passes + '/' + c.attempts + ' converted)' : '') };
  }

  /* ---------- positions ---------- */
  function onlyMoves(fen, keep) {
    var ms = TB().moves(fen);
    return { all: ms, good: ms.filter(function (m) { return m.result === keep; }) };
  }

  /** A fresh starting position for a drill. */
  function position(id, rand) {
    var d = BY[id], T = TB();
    rand = rand || Math.random;
    T.build(d.type);
    if (d.id === 'kq-mate' || d.id === 'kr-mate') {
      // Not trivially close: kings at least 3 apart, so the technique is needed.
      return T.randomPosition(d.type, { minPlies: d.minPlies, maxPlies: d.maxPlies, rand: rand, filter: function (wk, x, bk) { return cheb(wk, bk) >= 3; } });
    }
    if (d.id === 'stalemate') {
      for (var i = 0; i < 400; i++) {
        var fen = T.randomPosition('Q', { minPlies: 1, maxPlies: 5, rand: rand, filter: function (wk, x, bk) { return edge(bk) && cheb(wk, bk) === 2; } });
        if (!fen) continue;
        var ms = T.moves(fen), stale = ms.filter(function (m) { return m.stalemate; });
        if (stale.length >= 2 && stale.some(function (m) { return /^Q/.test(m.san); })) return fen;
      }
      return null;
    }
    if (d.kpk === 'win') {
      for (var j = 0; j < 600; j++) {
        var f1 = T.randomPosition('P', { minPlies: 9, maxPlies: 60, rand: rand, filter: function (wk, x, bk) { return pr(x) >= 1 && pr(x) <= 4 && cheb(wk, x) <= 2 && cheb(bk, x) <= 3 && pf(x) > 0 && pf(x) < 7; } });
        if (!f1) continue;
        var om = onlyMoves(f1, 'win');
        if (om.good.length <= 2 && om.all.length >= 4) return f1; // the critical choice: only one or two moves win
      }
      return null;
    }
    if (d.kpk === 'draw') {
      for (var k = 0; k < 600; k++) {
        var f2 = T.randomPosition('P', { blackToMove: true, result: 'draw', rand: rand, filter: function (wk, x, bk) { return pr(x) >= 2 && pr(x) <= 4 && pf(x) > 0 && pf(x) < 7 && cheb(wk, x) <= 2 && cheb(bk, x) <= 3 && pr(bk) > pr(x); } });
        if (!f2) continue;
        var od = onlyMoves(f2, 'draw');
        if (od.good.length <= 2 && od.all.length >= 3) return f2;
      }
      return null;
    }
    return null;
  }
  function cheb(a, b) { return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3))); }
  function edge(s) { return (s & 7) === 0 || (s & 7) === 7 || (s >> 3) === 0 || (s >> 3) === 7; }
  function pr(s) { return s >> 3; } function pf(s) { return s & 7; }

  /** Judge one move in a drill. fenBefore: position before your move. Returns { ok, best, result, plies, stalemate, bestSan } */
  function judge(id, fenBefore, san) {
    var d = BY[id], ms = TB().moves(fenBefore);
    var mine = ms.filter(function (m) { return m.san === san; })[0];
    if (!mine) return null;
    var want = d.kpk === 'draw' ? 'draw' : 'win';
    var best = ms[0];
    var ok = mine.result === want || (want === 'draw' && mine.result === 'win');
    return { ok: ok, best: best.result === mine.result && best.plies === mine.plies, result: mine.result, plies: mine.plies, stalemate: mine.stalemate, bestSan: best.san,
      keepers: ms.filter(function (m) { return m.result === best.result; }).map(function (m) { return m.san; }) };
  }

  /** Material in pawns (1/3/3/5/9) for each colour. */
  function material(fen) {
    var V = { p: 1, n: 3, b: 3, r: 5, q: 9 }, out = { w: 0, b: 0 };
    String(fen).split(' ')[0].split('').forEach(function (ch) { var l = ch.toLowerCase(); if (V[l]) out[ch === l ? 'b' : 'w'] += V[l]; });
    return out;
  }
  function lead(fen, color) { var m = material(fen); return color === 'w' ? m.w - m.b : m.b - m.w; }

  /* ---------- Convert the Win: positions from the end of real-game puzzles ---------- */
  var convertCache = null;
  function convertPositions() {
    if (convertCache) return convertCache;
    convertCache = [];
    if (!CT.Pack) return convertCache;
    var Chess = CT.Chess;
    CT.Pack.all().forEach(function (p) {
      if (p.goal === 'mate' || (p.lichessThemes || []).indexOf('crushing') < 0) return;
      try {
        var g = new Chess(p.rawFen);
        for (var i = 0; i < p.uci.length; i++) {
          var u = p.uci[i];
          if (!g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) return;
        }
        if (g.isGameOver() || g.inCheck()) return;
        var me = g.turn() === 'w' ? 'b' : 'w', fen = g.fen(), l = lead(fen, me), m = material(fen);
        if (l < 3 || l > 6 || m.w + m.b < 14) return;
        // Skip if the opponent can win material straight back (an undefended piece or a cheap capture of a big piece).
        var V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }, risky = g.moves({ verbose: true }).some(function (mv) {
          if (!mv.captured) return false;
          var h = new Chess(fen); h.move(mv.san);
          var defended = h.moves({ verbose: true }).some(function (x) { return x.to === mv.to; });
          return !defended || V[mv.captured] > V[mv.piece];
        });
        if (risky) return;
        convertCache.push({ id: p.id, fen: fen, color: me, lead: l, rating: p.rating, opening: p.opening });
      } catch (e) { /* skip */ }
    });
    convertCache.sort(function (a, b) { return a.rating - b.rating; });
    return convertCache;
  }

  function convertStats() {
    var c = S().state.convert || { attempts: 0, passes: 0, history: [] };
    return { attempts: c.attempts, passes: c.passes, history: c.history || [] };
  }
  function pickConvert(rand) {
    rand = rand || Math.random;
    var list = convertPositions(), done = {};
    (convertStats().history || []).forEach(function (h) { done[h.id] = true; });
    var R = S().puzzleRating(), fresh = list.filter(function (p) { return !done[p.id]; });
    var near = fresh.filter(function (p) { return Math.abs(p.rating - R) <= 300; });
    var pool = near.length ? near : fresh.length ? fresh : list;
    return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
  }
  function recordConvert(pos, pass, info) {
    var c = S().state.convert || (S().state.convert = { attempts: 0, passes: 0, history: [] });
    c.attempts++; if (pass) c.passes++;
    c.history.push({ id: pos.id, t: Date.now(), pass: !!pass, result: info && info.result, minLead: info && info.minLead });
    if (c.history.length > 200) c.history = c.history.slice(-200);
    S().bumpDay('endgames');
    S().save();
  }

  CT.Endgame = {
    DRILLS: DRILLS, get: function (id) { return BY[id]; }, rec: rec, record: record, next: next, position: position, judge: judge,
    material: material, lead: lead, convertPositions: convertPositions, convertStats: convertStats, pickConvert: pickConvert, recordConvert: recordConvert
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CT.Endgame;
})(typeof window !== 'undefined' ? window : globalThis);
