/*
 * safety.js — The "Real Chess" safety check (after Dan Heisman's "Hope Chess vs Real Chess").
 *
 * Before a move is played, ask: after this move, what are my opponent's checks, captures and threats —
 * and can I meet them? CT.Safety.check() answers that with the engine so the app can test you on it:
 *   - it compares the position before your move (your best play) with the position after it,
 *   - a move is UNSAFE if it throws away at least 1.5 pawns and 15% winning chances, or allows mate,
 *   - and it returns the opponent's punishing reply plus a few other forcing replies to choose from.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  var CP_LOSS = 150, WIN_LOSS = 15;

  function analyzer() {
    return CT.Stockfish && CT.Stockfish.status().state === 'ready' ? CT.Analyzer.stockfish : CT.Analyzer.builtin;
  }

  /** Pure verdict from two White-POV evaluations (before the move, after it) for the player `color`. */
  function verdict(evBefore, evAfter, color) {
    var s = color === 'w' ? 1 : -1;
    var clamp = function (cp) { return Math.max(-1500, Math.min(1500, cp)); };
    var before = clamp(s * evBefore.cp), after = clamp(s * evAfter.cp);
    var wB = CT.Analysis.winPct(evBefore), wA = CT.Analysis.winPct(evAfter);
    if (color === 'b') { wB = 100 - wB; wA = 100 - wA; }
    var allowsMate = evAfter.mate != null && s * evAfter.mate < 0;
    var loss = before - after, winLoss = wB - wA;
    return { unsafe: allowsMate || (loss >= CP_LOSS && winLoss >= WIN_LOSS), loss: Math.max(0, loss), winLoss: Math.max(0, winLoss), allowsMate: allowsMate };
  }

  /** Forcing replies (checks and captures) for the side to move, most dangerous-looking first. */
  function forcing(game) {
    return game.moves({ verbose: true }).filter(function (m) { return m.captured || /[+#]/.test(m.san); })
      .sort(function (a, b) { return (/#/.test(b.san) ? 100 : 0) - (/#/.test(a.san) ? 100 : 0) || (VAL[b.captured] || 0) - (VAL[a.captured] || 0) || (/\+/.test(b.san) ? 1 : 0) - (/\+/.test(a.san) ? 1 : 0); });
  }

  /**
   * Check a move. fenBefore: position before your move; san: your move.
   * Resolves { unsafe, loss, winLoss, allowsMate, reply:{san,from,to}|null, options:[san…], engine }.
   */
  function check(fenBefore, san) {
    var A = analyzer(), depth = A === CT.Analyzer.stockfish ? 10 : null;
    var g = new CT.Chess(fenBefore), color = g.turn();
    var mv = g.move(san);
    if (!mv) return Promise.reject(new Error('illegal move'));
    var afterFen = g.fen();
    return Promise.all([A.evaluate(fenBefore, depth), A.evaluate(afterFen, depth)]).then(function (ev) {
      var v = verdict(ev[0], ev[1], color);
      var reply = null;
      if (ev[1].best) { var r = new CT.Chess(afterFen).move(ev[1].best); if (r) reply = { san: r.san, from: r.from, to: r.to }; }
      var opts = forcing(new CT.Chess(afterFen)).map(function (m) { return m.san; });
      var pool = [];
      if (v.unsafe && reply) pool.push(reply.san);
      opts.forEach(function (s) { if (pool.length < 3 && pool.indexOf(s) < 0) pool.push(s); });
      if (!v.unsafe && reply && pool.length < 3 && pool.indexOf(reply.san) < 0) pool.push(reply.san);
      // shuffle so the dangerous reply is not always first
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      v.reply = reply; v.options = pool; v.engine = A.source; v.afterFen = afterFen;
      return v;
    });
  }

  /** Safety Score over recent practice games that used the check: share of answers that were right. */
  function score(lastN) {
    var games = (CT.Store.state.practice || []).filter(function (g) { return g.safety && g.safety.checks >= 3; }).slice(-(lastN || 5));
    var checks = 0, correct = 0;
    games.forEach(function (g) { checks += g.safety.checks; correct += g.safety.correct; });
    return { games: games.length, checks: checks, score: checks ? correct / checks : null };
  }

  CT.Safety = { check: check, verdict: verdict, forcing: forcing, score: score, CP_LOSS: CP_LOSS, WIN_LOSS: WIN_LOSS };
})(typeof window !== 'undefined' ? window : globalThis);
