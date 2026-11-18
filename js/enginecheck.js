/*
 * enginecheck.js — Re-verifies every repertoire line with Stockfish, in your browser.
 *
 * For each of YOUR moves in each line, Stockfish scores two things FROM THE SAME POSITION AND DEPTH:
 *   1. its own best move, and
 *   2. the lesson's move (using the UCI "searchmoves" option, which makes it search only that move).
 * Comparing two separate searches (before the move vs after the move) is unreliable at browser depths —
 * the extra half-move of depth alone shifts the score — so it produced many false alarms. Comparing like
 * with like removes that noise.
 *
 * A move is flagged only if it is clearly worse (≥ FLAG_WIN winning-chance points AND ≥ FLAG_CP centipawns),
 * and the flag survives a deeper confirmation search. Flags are never silently "corrected" — they are shown
 * in the lesson so the content can be reviewed.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var VERSION = 2;          // results from older, noisier versions of the check are ignored
  var FLAG_WIN = 8;         // winning-chance points
  var FLAG_CP = 70;         // centipawns (0.70 pawns)
  var CONFIRM_EXTRA = 6;    // extra depth for the confirmation search
  var MATE = 10000;
  var running = null;

  function results() {
    var r = CT.Store.state.engineCheck;
    return r && r.version === VERSION ? r : null;
  }

  function issuesFor(lineId) {
    var r = results();
    return r && r.lines[lineId] ? r.lines[lineId].issues : null;
  }
  function issueAt(lineId, ply) {
    var list = issuesFor(lineId);
    return list ? list.find(function (i) { return i.ply === ply; }) || null : null;
  }

  /** Score of an analyse() result, side-to-move point of view, mates folded into big numbers. */
  function score(r) {
    var l = (r && r.lines && r.lines[1]) || {};
    if (l.mate != null) return l.mate > 0 ? MATE - l.mate : -MATE - l.mate;
    return l.cp || 0;
  }
  function win(cp) { return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function fmt(cp) {
    if (Math.abs(cp) > MATE - 1000) return (cp > 0 ? '#' : '#-') + (MATE - Math.abs(cp));
    return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2);
  }

  function toUci(fen, san) {
    var g = new CT.Chess(fen), m = g.move(san);
    return m ? m.from + m.to + (m.promotion || '') : null;
  }

  /** Compare the lesson move with Stockfish's best at one depth. Resolves {loss, winLoss, best, bestCp, moveCp}. */
  function compare(fen, uci, depth, cache) {
    var key = fen + '|' + depth;
    var bestP = cache[key] || (cache[key] = CT.Stockfish.analyse(fen, { depth: depth }));
    return bestP.then(function (b) {
      if (b.bestmove === uci) return { same: true };
      return CT.Stockfish.analyse(fen, { depth: depth, searchmoves: [uci] }).then(function (m) {
        var bc = score(b), mc = score(m);
        return { same: false, best: CT.Analyzer.uciToSan(fen, b.bestmove), bestCp: bc, moveCp: mc, loss: bc - mc, winLoss: win(bc) - win(mc) };
      });
    });
  }
  function bad(c) { return c && !c.same && c.loss >= FLAG_CP && c.winLoss >= FLAG_WIN; }

  /** Run the check. onProgress(done, total, lineName). Resolves with the results object. */
  function run(depth, onProgress) {
    if (running) return running;
    var D = CT.Data, cache = {};
    var lines = D.openingLines.filter(function (l) { return l.kind !== 'trap-avoid'; });
    var jobs = [];
    lines.forEach(function (l) {
      var g = new CT.Chess();
      l.moves.forEach(function (pair, i) {
        var mine = (i % 2 === 0 ? 'w' : 'b') === l.side;
        var punish = l.mistakePly !== undefined && i === l.mistakePly + 1;
        var tooFar = l.mistakePly !== undefined && i > l.mistakePly + 1;
        if (mine && !tooFar && (!l.lessonOnly || punish)) jobs.push({ line: l, ply: i, move: pair[0], fen: g.fen(), gambit: (l.gambitPlies || []).indexOf(i) >= 0 });
        g.move(pair[0]);
      });
    });
    var out = { version: VERSION, at: Date.now(), depth: depth, engine: '', lines: {}, checked: 0, total: jobs.length, complete: false };
    var stopped = false;
    function save() { CT.Store.state.engineCheck = out; CT.Store.save(); }

    running = CT.Stockfish.init().then(function (ok) {
      if (!ok) throw new Error('Stockfish is not available, so the check cannot run. (The built-in engine is too shallow to verify opening theory.)');
      out.engine = CT.Stockfish.status().name || 'Stockfish';
      var i = 0;
      function next() {
        if (stopped) { save(); return out; }
        if (i >= jobs.length) { out.complete = true; out.at = Date.now(); save(); return out; }
        var j = jobs[i++];
        var rec = out.lines[j.line.id] = out.lines[j.line.id] || { issues: [], checked: 0 };
        var uci = toUci(j.fen, j.move);
        var work = !uci ? Promise.resolve() : compare(j.fen, uci, depth, cache).then(function (c) {
          if (!bad(c)) return null;
          // Looks bad at the normal depth: confirm with a deeper search before raising a flag.
          return compare(j.fen, uci, depth + CONFIRM_EXTRA, cache).then(function (c2) {
            if (!bad(c2)) return;
            rec.issues.push({ ply: j.ply, move: j.move, best: c2.best, diff: Math.round(c2.winLoss), loss: c2.loss, gambit: j.gambit, bestEval: fmt(c2.bestCp), moveEval: fmt(c2.moveCp) });
          });
        });
        return work.then(function () {
          rec.checked++; out.checked++;
          if (onProgress) onProgress(i, jobs.length, j.line.name);
          save();
          return next();
        });
      }
      return next();
    }).then(function (r) { running = null; return r; }, function (e) { running = null; throw e; });
    running.stop = function () { stopped = true; CT.Stockfish.stop(); };
    return running;
  }

  CT.EngineCheck = {
    run: run, results: results, issuesFor: issuesFor, issueAt: issueAt,
    isRunning: function () { return !!running; },
    stop: function () { if (running && running.stop) running.stop(); },
    _score: score, _win: win, VERSION: VERSION
  };
})(typeof window !== 'undefined' ? window : globalThis);
