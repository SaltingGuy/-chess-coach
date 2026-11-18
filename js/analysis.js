/*
 * analysis.js — Game analysis and the personal coaching report.
 *
 * CT.Analyzer  — evaluates positions with Stockfish when available, otherwise the built-in engine.
 * CT.Analysis  — reviews a whole game: per-move evaluation, mistake classification (by the drop in
 *                winning chances, the same idea Lichess uses), tactic detection, plain-language
 *                explanations, and the 9-part coaching report.
 * Works in the browser and in Node (tests use the built-in engine).
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  var NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var MATE = 100000;

  /* ===================== Analyzer (engine abstraction) ===================== */
  function Chess() { return CT.Chess; }

  function uciToSan(fen, uci) {
    if (!uci) return null;
    var g = new (Chess())(fen);
    var m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return m ? m.san : null;
  }
  function pvToSan(fen, pv, max) {
    var g = new (Chess())(fen), out = [];
    for (var i = 0; i < pv.length && i < (max || 8); i++) {
      var m = g.move({ from: pv[i].slice(0, 2), to: pv[i].slice(2, 4), promotion: pv[i][4] });
      if (!m) break;
      out.push(m.san);
    }
    return out;
  }

  /** Evaluation from WHITE's point of view: {cp, mate (moves, + = White mates), best (SAN), pv (SAN[])} */
  function terminal(g) {
    if (g.isCheckmate()) return { cp: g.turn() === 'w' ? -MATE : MATE, mate: 0, best: null, pv: [], terminal: 'checkmate' };
    if (g.isDraw()) return { cp: 0, mate: null, best: null, pv: [], terminal: 'draw' };
    return null;
  }

  var builtin = {
    name: 'Built-in engine', source: 'builtin',
    evaluate: function (fen, depth) {
      var g = new (Chess())(fen), t = terminal(g);
      if (t) return Promise.resolve(t);
      if (CT.EnginePlay) {
        // The stronger built-in engine: about a quarter of a second per position (in a background thread when possible).
        var job = CT.EngineWorker ? CT.EngineWorker.think(fen, { timeMs: 250, maxDepth: 12 }) : Promise.resolve(CT.EnginePlay.think(g, { timeMs: 250, maxDepth: 12 }));
        return job.then(function (th) {
          var sc = th.moves[0].score, sg = g.turn() === 'w' ? 1 : -1;
          var mt = th.moves[0].mate != null ? sg * th.moves[0].mate : null;
          var cpv = mt != null ? (mt > 0 ? MATE - Math.abs(th.moves[0].mate) : -MATE + Math.abs(th.moves[0].mate)) : sg * sc;
          return { cp: cpv, mate: mt, best: th.best, pv: [th.best], depth: th.depth };
        });
      }
      var r = CT.Engine.bestMove(g, depth || 2, 4e5);
      var sign = g.turn() === 'w' ? 1 : -1, mate = null;
      if (Math.abs(r.score) > CT.Engine.MATE - 1000) {
        var plies = CT.Engine.MATE - Math.abs(r.score);
        mate = sign * (r.score > 0 ? 1 : -1) * Math.ceil(plies / 2);
      }
      return Promise.resolve({ cp: sign * r.score, mate: mate, best: r.san, pv: [r.san] });
    }
  };

  var stockfish = {
    name: 'Stockfish', source: 'stockfish',
    evaluate: function (fen, depth) {
      var g = new (Chess())(fen), t = terminal(g);
      if (t) return Promise.resolve(t);
      return CT.Stockfish.analyse(fen, { depth: depth || 12 }).then(function (r) {
        var l = r.lines[1] || {}, sign = g.turn() === 'w' ? 1 : -1;
        var mate = l.mate != null ? sign * l.mate : null;
        var cp = l.mate != null ? sign * (l.mate > 0 ? MATE - l.mate : -MATE - l.mate) : sign * (l.cp || 0);
        var best = uciToSan(fen, r.bestmove);
        return { cp: cp, mate: mate, best: best, pv: pvToSan(fen, l.pv || [r.bestmove]), depth: r.depth };
      });
    }
  };

  CT.Analyzer = {
    builtin: builtin, stockfish: stockfish,
    /** Resolve the best available analyzer. */
    pick: function (preferStockfish) {
      if (preferStockfish === false || !CT.Stockfish) return Promise.resolve(builtin);
      return CT.Stockfish.init().then(function (ok) { return ok ? stockfish : builtin; });
    },
    uciToSan: uciToSan, pvToSan: pvToSan
  };

  /* ===================== Scoring helpers ===================== */
  /** Winning chances (0–100) for White from a White-POV evaluation. */
  function winPct(ev) {
    if (ev.mate != null) return ev.mate > 0 ? 100 : ev.mate < 0 ? 0 : (ev.cp > 0 ? 100 : 0);
    var cp = Math.max(-1500, Math.min(1500, ev.cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }
  function moveAccuracy(loss) { return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)); }
  function classify(loss) { return loss >= 30 ? 'blunder' : loss >= 20 ? 'mistake' : loss >= 10 ? 'inaccuracy' : 'good'; }
  var SYMBOL = { blunder: '??', mistake: '?', inaccuracy: '?!', good: '', best: '' };
  function fmtEval(ev) {
    if (ev.mate != null && ev.mate !== 0) return (ev.mate > 0 ? '+' : '-') + 'M' + Math.abs(ev.mate);
    if (ev.mate === 0) return '#';
    var p = ev.cp / 100;
    return (p > 0 ? '+' : '') + p.toFixed(1);
  }

  /* ===================== Tactic (motif) detection ===================== */
  var MOTIF_THEME = { fork: 'fork', 'double-attack': 'double-attack', hanging: 'hanging', pin: 'pin', skewer: 'skewer', discovered: 'discovered', 'back-rank': 'back-rank', mate: 'mate1', 'mate-threat': 'mate-patterns' };
  var MOTIF_NAME = { fork: 'fork', 'double-attack': 'double attack', hanging: 'free (hanging) piece', pin: 'pin', skewer: 'skewer', discovered: 'discovered attack', 'back-rank': 'back-rank mate', mate: 'checkmate', 'mate-threat': 'mating attack' };

  function sqIdx(s) { return Chess().sqIndex(s); }
  function sqNm(i) { return Chess().sqName(i); }
  function pieceAt(g, i) { var p = g._board[i]; return p ? { t: p.toLowerCase(), c: p === p.toUpperCase() ? 'w' : 'b', i: i } : null; }
  function defended(g, i, byColor) { return g.attackers(sqNm(i), byColor).length > 0; }

  /** What tactic does playing `san` in `fen` carry out? Returns {key, text} or null. */
  function motifOf(fen, san) {
    var C = Chess(), g = new C(fen), us = g.turn(), them = us === 'w' ? 'b' : 'w';
    var before = new C(fen);
    var mv = g.move(san);
    if (!mv) return null;
    if (g.isCheckmate()) {
      var ki = g._kingSq(them), kr = ki >> 3, backRank = them === 'w' ? 7 : 0;
      if ((mv.piece === 'r' || mv.piece === 'q') && kr === backRank) return { key: 'back-rank', text: 'back-rank checkmate' };
      return { key: 'mate', text: 'checkmate' };
    }
    var to = sqIdx(mv.to);
    // Capture of a piece that was undefended or worth more than the capturer.
    if (mv.captured) {
      var capturedDefended = defended(before, to, them);
      if (!capturedDefended || VAL[mv.captured] > VAL[mv.piece]) {
        return { key: 'hanging', text: 'it wins the ' + NAMES[mv.captured] + ' on ' + mv.to + (capturedDefended ? ' (worth more than the piece taking it)' : ', which had no defender') };
      }
    }
    // Fork / double attack: the moved piece attacks two worthwhile targets.
    var targets = g._pieceAttacks(to).map(function (i) { return pieceAt(g, i); }).filter(function (p) {
      if (!p || p.c !== them) return false;
      if (p.t === 'k') return true;
      return VAL[p.t] > VAL[mv.piece] || (!defended(g, p.i, them) && VAL[p.t] >= 3);
    });
    if (targets.length >= 2) {
      var names = targets.map(function (p) { return p.t === 'k' ? 'king' : NAMES[p.t] + ' on ' + sqNm(p.i); });
      return { key: mv.piece === 'q' ? 'double-attack' : 'fork', text: (mv.piece === 'n' ? 'a knight fork' : mv.piece === 'q' ? 'a double attack' : 'a fork') + ' — it attacks the ' + names.join(' and the ') };
    }
    // Discovered attack: another piece of ours suddenly attacks the king or a valuable piece.
    for (var i = 0; i < 64; i++) {
      var own = pieceAt(g, i);
      if (!own || own.c !== us || i === to || ['b', 'r', 'q'].indexOf(own.t) < 0) continue;
      var nowAtt = g._pieceAttacks(i), wasAtt = before._board[i] ? before._pieceAttacks(i) : [];
      for (var k = 0; k < nowAtt.length; k++) {
        var tp = pieceAt(g, nowAtt[k]);
        if (tp && tp.c === them && wasAtt.indexOf(nowAtt[k]) < 0 && (tp.t === 'k' || VAL[tp.t] >= 5 || (VAL[tp.t] >= 3 && !defended(g, tp.i, them))))
          return { key: 'discovered', text: 'a discovered attack — moving it uncovers your ' + NAMES[own.t] + ' on ' + sqNm(i) + ' against the ' + (tp.t === 'k' ? 'king' : NAMES[tp.t]) };
      }
    }
    // Pin / skewer along the moved slider's lines.
    if (['b', 'r', 'q'].indexOf(mv.piece) >= 0) {
      var dirs = mv.piece === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : mv.piece === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < dirs.length; d++) {
        var r = (to >> 3) + dirs[d][0], c = (to & 7) + dirs[d][1], first = null;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          var p = pieceAt(g, r * 8 + c);
          if (p) {
            if (!first) { if (p.c !== them) break; first = p; }
            else {
              if (p.c === them) {
                if (VAL[p.t] > VAL[first.t] && VAL[first.t] >= 3) return { key: 'pin', text: 'a pin — the ' + NAMES[first.t] + ' on ' + sqNm(first.i) + ' cannot move without exposing the ' + (p.t === 'k' ? 'king' : NAMES[p.t]) };
                if ((first.t === 'k' || first.t === 'q') && VAL[p.t] >= 3 && VAL[p.t] < VAL[first.t]) return { key: 'skewer', text: 'a skewer — the ' + (first.t === 'k' ? 'king' : 'queen') + ' must move and the ' + NAMES[p.t] + ' on ' + sqNm(p.i) + ' behind it falls' };
              }
              break;
            }
          }
          r += dirs[d][0]; c += dirs[d][1];
        }
      }
    }
    return null;
  }

  /* ===================== Whole-game analysis ===================== */
  /**
   * analyseGame({startFen, moves:[SAN]}, {analyzer, depth, onProgress}) → Promise<result>
   * result.moves[i]: {ply, moveNo, color, san, from, to, fenBefore, evalBefore, evalAfter, best, bestPv, loss, cls, ...}
   */
  function analyseGame(game, opts) {
    opts = opts || {};
    var C = Chess(), analyzer = opts.analyzer || builtin, depth = opts.depth;
    var g = new C(game.startFen || C.DEFAULT_FEN), fens = [g.fen()], played = [];
    game.moves.forEach(function (san) { var m = g.move(san); if (!m) throw new Error('Illegal move in game: ' + san); played.push(m); fens.push(g.fen()); });
    var evals = new Array(fens.length);
    var i = 0, cancelled = false;
    function step() {
      if (cancelled) return Promise.reject(new Error('cancelled'));
      if (i >= fens.length) return Promise.resolve();
      return analyzer.evaluate(fens[i], depth).then(function (ev) {
        evals[i] = ev; i++;
        if (opts.onProgress) opts.onProgress(i, fens.length);
        // Yield so the page stays responsive.
        return new Promise(function (res) { setTimeout(res, 0); }).then(step);
      });
    }
    var promise = step().then(function () { return build(game, played, fens, evals, analyzer); });
    promise.cancel = function () { cancelled = true; if (CT.Stockfish) CT.Stockfish.stop(); };
    return promise;
  }

  function build(game, played, fens, evals, analyzer) {
    var moves = played.map(function (m, ply) {
      var color = ply % 2 === 0 ? (fens[0].split(' ')[1]) : (fens[0].split(' ')[1] === 'w' ? 'b' : 'w');
      color = m.color;
      var eb = evals[ply], ea = evals[ply + 1];
      var wb = winPct(eb), wa = winPct(ea);
      var moverBefore = color === 'w' ? wb : 100 - wb, moverAfter = color === 'w' ? wa : 100 - wa;
      var isBest = eb.best && eb.best.replace(/[+#]/g, '') === m.san.replace(/[+#]/g, '');
      var loss = isBest ? 0 : Math.max(0, moverBefore - moverAfter);
      var sgn = color === 'w' ? 1 : -1;
      var hadMate = eb.mate != null && eb.mate * sgn > 0;
      var keepsMate = ea.mate != null && ea.mate * sgn > 0 || (ea.mate === 0 && ea.terminal === 'checkmate' && ((ea.cp > 0) === (color === 'w')));
      var allowsMate = ea.mate != null && ea.mate * sgn < 0 && !(eb.mate != null && eb.mate * sgn < 0);
      var cls = isBest ? 'best' : classify(loss);
      if (hadMate && !keepsMate && cls === 'good') cls = 'inaccuracy';
      return {
        ply: ply, moveNo: Math.floor(ply / 2) + parseInt(fens[0].split(' ')[5] || '1', 10), color: color, san: m.san, from: m.from, to: m.to,
        fenBefore: fens[ply], fenAfter: fens[ply + 1], evalBefore: eb, evalAfter: ea, best: eb.best, bestPv: eb.pv,
        winBefore: moverBefore, winAfter: moverAfter, loss: loss, cls: cls, symbol: SYMBOL[cls] || '',
        missedMate: hadMate && !keepsMate, allowsMate: allowsMate, reply: ea.best, replyPv: ea.pv
      };
    });
    moves.forEach(function (mv) { if (mv.cls !== 'best' && mv.cls !== 'good') explain(mv); });
    var acc = { w: [], b: [] };
    moves.forEach(function (mv) { acc[mv.color].push(moveAccuracy(mv.loss)); });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
    return {
      engine: analyzer.name, source: analyzer.source,
      headers: game.headers || {}, startFen: fens[0], moves: moves, evals: evals,
      accuracy: { w: avg(acc.w), b: avg(acc.b) },
      counts: count(moves)
    };
  }

  function count(moves) {
    var c = { w: { blunder: 0, mistake: 0, inaccuracy: 0 }, b: { blunder: 0, mistake: 0, inaccuracy: 0 } };
    moves.forEach(function (m) { if (c[m.color][m.cls] !== undefined) c[m.color][m.cls]++; });
    return c;
  }

  function pieceName(fen, sq) { var g = new (Chess())(fen), p = g.get(sq); return p ? NAMES[p.type] : 'piece'; }

  /** Plain-language explanation of a mistake, written for a beginner. */
  function explain(mv) {
    var pct = function (x) { return Math.round(x) + '%'; };
    var chances = 'Your winning chances went from ' + pct(mv.winBefore) + ' to ' + pct(mv.winAfter) + '.';
    var text = '', motif = null;
    if (mv.allowsMate) {
      text = 'This allows a forced checkmate: your opponent can start with ' + (mv.reply || 'a check') + '. Before every move, look at all of your opponent\'s checks.';
      motif = { key: 'mate-threat', text: 'mating attack' };
      mv.lessonKind = 'threat';
    } else if (mv.missedMate) {
      text = 'You had a forced checkmate starting with ' + mv.best + '! ' + 'Always look for checks first — especially when the enemy king has few escape squares.';
      motif = motifOf(mv.fenBefore, mv.best) || { key: 'mate', text: 'checkmate' };
      mv.lessonKind = 'missed';
    } else {
      var punish = mv.reply ? motifOf(mv.fenAfter, mv.reply) : null;
      var missed = mv.best ? motifOf(mv.fenBefore, mv.best) : null;
      if (punish && (mv.cls === 'blunder' || mv.cls === 'mistake')) {
        motif = punish;
        mv.lessonKind = 'threat';
        text = 'This move lets your opponent play ' + mv.reply + ': ' + punish.text + '. ' + chances;
      } else if (missed) {
        motif = missed;
        mv.lessonKind = 'missed';
        text = 'You missed ' + mv.best + ': ' + missed.text + '. ' + chances;
      } else {
        mv.lessonKind = 'positional';
        text = 'This move made your position worse. ' + chances + ' A better move was ' + mv.best + '.';
      }
    }
    if (mv.best && text.indexOf(mv.best) < 0) text += ' Better was ' + mv.best + '.';
    mv.motif = motif;
    mv.explanation = text;
  }

  /* ===================== Coaching report ===================== */
  function repertoireCheck(result, userColor) {
    if (!CT.Data || !CT.Data.repertoires || !CT.OpeningTree) return null;
    var sans = result.moves.map(function (m) { return m.san; });
    var best = null;
    CT.Data.repertoires.filter(function (r) { return r.side === userColor; }).forEach(function (r) {
      var tree = CT.OpeningTree.build(r.id), path = [], depth = 0, info = null;
      for (var i = 0; i < sans.length; i++) {
        var kids = CT.OpeningTree.childList(tree, path.join(' '));
        if (!kids.length) { info = { kind: 'end', ply: i }; break; }
        var match = kids.find(function (k) { return k.san === sans[i]; });
        var yours = (i % 2 === 0 ? 'w' : 'b') === userColor;
        if (!match) {
          info = yours ? { kind: 'you', ply: i, expected: kids[0].san, line: kids[0].lines[0] } : { kind: 'them', ply: i };
          break;
        }
        path.push(sans[i]); depth = i + 1;
      }
      if (depth > 0 && (!best || depth > best.depth)) best = { rep: r, depth: depth, info: info || { kind: 'end', ply: sans.length } };
    });
    return best;
  }

  /**
   * report(result, userColor) → the 9-part coaching report.
   */
  function report(result, userColor) {
    var them = userColor === 'w' ? 'b' : 'w';
    var mine = result.moves.filter(function (m) { return m.color === userColor; });
    var theirs = result.moves.filter(function (m) { return m.color === them; });
    var byLoss = function (a, b) { return b.loss - a.loss; };
    var userErrors = mine.filter(function (m) { return m.loss >= 10 || m.missedMate; }).sort(byLoss);
    var oppErrors = theirs.filter(function (m) { return m.loss >= 10; }).sort(byLoss);
    var h = result.headers || {};
    var res = h.Result || '*';
    var outcome = res === '1-0' ? (userColor === 'w' ? 'won' : 'lost') : res === '0-1' ? (userColor === 'b' ? 'won' : 'lost') : res === '1/2-1/2' ? 'drew' : 'played';
    var acc = result.accuracy[userColor], oacc = result.accuracy[them];
    var c = result.counts[userColor];

    // Where was the game decided? First ply after which the eval stays beyond ±70% for one side.
    var decided = null;
    for (var i = 0; i < result.moves.length; i++) {
      var w = winPct(result.moves[i].evalAfter);
      if (w > 85 || w < 15) {
        var stays = result.moves.slice(i).every(function (m) { var x = winPct(m.evalAfter); return w > 85 ? x > 70 : x < 30; });
        if (stays) { decided = result.moves[i]; break; }
      }
    }

    var summary = 'You ' + outcome + (h.White && h.Black ? ' (' + h.White + ' vs ' + h.Black + ')' : '') + '. Your accuracy: ' + fmtPct(acc) + ' (opponent ' + fmtPct(oacc) + '). ' +
      'You made ' + c.blunder + ' blunder' + (c.blunder === 1 ? '' : 's') + ', ' + c.mistake + ' mistake' + (c.mistake === 1 ? '' : 's') + ' and ' + c.inaccuracy + ' inaccurac' + (c.inaccuracy === 1 ? 'y' : 'ies') + '.' +
      (decided ? ' The game turned decisively at move ' + decided.moveNo + ' (' + decided.san + ').' : ' The game stayed balanced for a long time.');

    // Missed opportunity: the user's error where the best move carried a tactic or mate (or punished an opponent error).
    var opp = mine.filter(function (m) {
      if (m.loss < 10 && !m.missedMate) return false;
      var prev = result.moves[m.ply - 1];
      return m.missedMate || m.lessonKind === 'missed' || (prev && prev.loss >= 20);
    }).sort(byLoss)[0] || null;
    var biggest = userErrors[0] || null;
    if (opp && biggest && opp.ply === biggest.ply && userErrors[1]) {
      var alt = mine.filter(function (m) { return m !== biggest && (m.missedMate || m.lessonKind === 'missed'); }).sort(byLoss)[0];
      if (alt) opp = alt;
    }

    // Tactical pattern: the most common motif among your errors.
    var motifCounts = {};
    userErrors.forEach(function (m) { if (m.motif) motifCounts[m.motif.key] = (motifCounts[m.motif.key] || 0) + 1; });
    var topMotif = Object.keys(motifCounts).sort(function (a, b) { return motifCounts[b] - motifCounts[a]; })[0] || null;
    var pattern = topMotif ? {
      key: topMotif, theme: MOTIF_THEME[topMotif], count: motifCounts[topMotif],
      text: 'The pattern that cost you most: ' + MOTIF_NAME[topMotif] + ' (' + motifCounts[topMotif] + ' time' + (motifCounts[topMotif] > 1 ? 's' : '') + ' in this game). ' + patternAdvice(topMotif)
    } : { key: null, theme: 'hanging', text: 'No single tactical pattern stood out. Keep the habit: before every move, check what your move leaves undefended and what your opponent\'s last move attacks.' };

    // Opening lesson.
    var rep = repertoireCheck(result, userColor), opening;
    var earlyErr = mine.filter(function (m) { return m.moveNo <= 12 && m.loss >= 10; }).sort(byLoss)[0];
    if (rep && rep.info.kind === 'you') {
      var mvNo = Math.floor(rep.info.ply / 2) + 1;
      opening = { text: 'You left your ' + rep.rep.name + ' repertoire at move ' + mvNo + ': you played ' + result.moves[rep.info.ply].san + ', but your repertoire move is ' + rep.info.expected + '. Review the line and drill it.', line: rep.info.line };
    } else if (rep && rep.info.kind === 'them') {
      opening = { text: 'You followed your ' + rep.rep.name + ' preparation for ' + rep.depth + ' half-moves; then your opponent played ' + result.moves[rep.info.ply].san + ', which is not in your lines yet. ' + (earlyErr ? 'Your first real slip came at move ' + earlyErr.moveNo + ' (' + earlyErr.san + ').' : 'You handled the new position well.'), line: null };
    } else if (rep) {
      opening = { text: 'You played your ' + rep.rep.name + ' preparation to the end of the prepared line — well done. ' + (earlyErr ? 'After that, move ' + earlyErr.moveNo + ' (' + earlyErr.san + ') was the first slip.' : ''), line: null };
    } else if (earlyErr) {
      opening = { text: 'This opening is not in your repertoire yet. The first serious slip came at move ' + earlyErr.moveNo + ' (' + earlyErr.san + '): ' + earlyErr.explanation, line: null };
    } else {
      opening = { text: 'This opening is not in your repertoire yet, but you came out of it without serious errors. Develop pieces, castle, and control the centre — you did that.', line: null };
    }

    // Middlegame lesson (moves 13+).
    var mid = mine.filter(function (m) { return m.moveNo > 12 && m.loss >= 10; }).sort(byLoss)[0];
    var middlegame = mid ? { move: mid, text: middlegameAdvice(mid) } : { move: null, text: 'No serious middlegame errors. Keep improving your worst-placed piece and checking your opponent\'s threats every move.' };

    // Something you did well.
    var well = goodThing(result, userColor);

    // Three exercises from your own mistakes.
    var exercises = userErrors.filter(function (m) { return m.best; }).slice(0, 3).map(function (m) { return exerciseFrom(result, m); });

    return {
      userColor: userColor, outcome: outcome, summary: summary, accuracy: acc, oppAccuracy: oacc,
      biggestMistake: biggest, opponentMistake: oppErrors[0] || null, missedOpportunity: opp,
      pattern: pattern, opening: opening, middlegame: middlegame, didWell: well, exercises: exercises,
      motifCounts: motifCounts,
      hadWinning: mine.some(function (m) { return m.winAfter >= 85; }) && outcome !== 'won',
      missedThreats: mine.filter(function (m) { return m.lessonKind === 'threat' && m.loss >= 20; }).length
    };
  }

  function fmtPct(x) { return x == null ? '—' : Math.round(x) + '%'; }

  function patternAdvice(key) {
    return {
      fork: 'Before moving, look at every square an enemy knight (or queen) can jump to next move — would it hit two of your pieces?',
      'double-attack': 'Queens love double attacks against loose pieces. Keep your pieces defended.',
      hanging: 'Blunder-check every move: "What does my move leave undefended? What did my opponent\'s last move attack?"',
      pin: 'Avoid putting pieces on the same line as your king or queen when an enemy bishop or rook can reach it.',
      skewer: 'Keep your king and queen off the same line as enemy rooks, bishops and queen.',
      discovered: 'Watch the pieces BEHIND your opponent\'s pieces — moving the front one can unleash the back one.',
      'back-rank': 'Give your king an escape square (h3/h6 or g3/g6) once the position opens up.',
      mate: 'Look at every check — for both sides — before choosing a move.',
      'mate-threat': 'When your king is short of defenders, every opponent check is dangerous. Count escape squares.'
    }[key] || '';
  }

  function middlegameAdvice(m) {
    if (m.lessonKind === 'threat') return 'Move ' + m.moveNo + ' (' + m.san + '): ' + m.explanation + ' Lesson: before every move, ask what your opponent\'s best reply would be — especially checks and captures.';
    if (m.lessonKind === 'missed') return 'Move ' + m.moveNo + ' (' + m.san + '): ' + m.explanation + ' Lesson: every move, scan for your own checks, captures and threats first.';
    return 'Move ' + m.moveNo + ' (' + m.san + '): ' + m.explanation + ' Lesson: when nothing tactical is happening, improve your worst-placed piece and keep your pieces protecting each other.';
  }

  function goodThing(result, userColor) {
    var moves = result.moves, mine = moves.filter(function (m) { return m.color === userColor; });
    // Punished an opponent blunder?
    for (var i = 1; i < moves.length; i++) {
      var prev = moves[i - 1], m = moves[i];
      if (m.color === userColor && prev.loss >= 25 && m.loss < 5) return { move: m, text: 'At move ' + m.moveNo + ' you punished your opponent\'s mistake (' + prev.san + ') with ' + m.san + ' — exactly what a tactical player does.' };
    }
    // Longest run of accurate moves.
    var run = 0, bestRun = 0, start = null, bestStart = null;
    mine.forEach(function (m) { if (m.loss < 5) { if (!run) start = m; run++; if (run > bestRun) { bestRun = run; bestStart = start; } } else run = 0; });
    if (bestRun >= 5) return { move: bestStart, text: 'From move ' + bestStart.moveNo + ' you played ' + bestRun + ' accurate moves in a row. Solid, careful chess.' };
    var bestMove = mine.filter(function (m) { return m.cls === 'best'; })[0];
    if (bestMove) return { move: bestMove, text: 'Move ' + bestMove.moveNo + ' (' + bestMove.san + ') was the engine\'s top choice. Trust your calculation.' };
    return { move: null, text: 'You finished the game — every game you review makes the next one better.' };
  }

  function exerciseFrom(result, m) {
    var h = result.headers || {};
    var mate = m.evalBefore.mate != null ? Math.abs(m.evalBefore.mate) : null;
    var motif = m.motif || motifOf(m.fenBefore, m.best);
    var theme = motif && MOTIF_THEME[motif.key] ? MOTIF_THEME[motif.key] : 'game';
    var mateGoal = m.missedMate && mate && mate <= 2;
    var vs = (m.color === 'w' ? h.Black : h.White) || 'opponent';
    return {
      id: 'g-' + simpleHash(m.fenBefore + m.best), source: 'game', theme: theme, level: mateGoal ? mate : 2,
      goal: mateGoal ? 'mate' : 'material', mateIn: mateGoal ? mate : undefined,
      title: 'From your game vs ' + vs + ' (move ' + m.moveNo + ')', fen: m.fenBefore, line: [m.best],
      prompt: (m.color === 'w' ? 'White' : 'Black') + ' to move. In your game you played ' + m.san + '. Find the stronger move.',
      hint: motif ? 'Look for ' + MOTIF_NAME[motif.key] + '.' : 'Check every check, capture and threat.',
      explain: 'The engine\'s move was ' + m.best + (m.bestPv && m.bestPv.length > 1 ? ' (main line: ' + m.bestPv.slice(0, 5).join(' ') + ')' : '') + '. ' + (motif ? 'Idea: ' + motif.text + '.' : ''),
      pitfalls: 'Your game move ' + m.san + ': ' + (m.explanation || 'it was weaker.'),
      engine: result.engine
    };
  }

  function simpleHash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }

  CT.Analysis = {
    analyseGame: analyseGame, report: report, motifOf: motifOf, winPct: winPct, classify: classify,
    moveAccuracy: moveAccuracy, fmtEval: fmtEval, MOTIF_THEME: MOTIF_THEME, MOTIF_NAME: MOTIF_NAME, SYMBOL: SYMBOL, hash: simpleHash
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Analysis: CT.Analysis, Analyzer: CT.Analyzer };
})(typeof window !== 'undefined' ? window : globalThis);
