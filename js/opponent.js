/*
 * opponent.js — Computer opponents with playing styles.
 *
 * How a move is chosen:
 *   1. Stockfish lists its top moves with scores (MultiPV). If Stockfish is unavailable, the built-in
 *      engine scores every legal move instead (weaker, clearly labelled in the UI).
 *   2. The LEVEL decides how far from the best move the opponent may stray (its "window") and how often
 *      it makes a human-like slip (a wider window, as if it missed your idea). Slips are taken only from
 *      engine-listed candidate moves, so the opponent does not play random nonsense or sacrifice pieces for show.
 *      Only the Blunder-Prone Beginner may leave a piece simply hanging.
 *   3. The STYLE adds preferences among the moves inside that window (the Attacker likes checks and moves
 *      near your king, the Defender likes trades and safety, the Trap Setter likes moves that leave bait, …).
 *   4. Opening books: in opening practice the opponent follows your repertoire tree (including common mistakes
 *      for you to punish); the Trap Setter steers toward known traps from the Deception Lab.
 *
 * Each move returns notes (traps set, deliberate slips with the punishing reply) for the after-game summary.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  var MATE = 10000;

  /* Approximate playing strength per level. These are rough guides, not measured ratings. */
  var LEVELS = [null,
    { elo: 400, depth: 5, win: 220, slip: 0.22, slipW: 700 },
    { elo: 600, depth: 6, win: 160, slip: 0.15, slipW: 500 },
    { elo: 800, depth: 7, win: 120, slip: 0.10, slipW: 350 },
    { elo: 1000, depth: 8, win: 85, slip: 0.06, slipW: 250 },
    { elo: 1200, depth: 10, win: 55, slip: 0.04, slipW: 180 },
    { elo: 1400, depth: 11, win: 35, slip: 0.02, slipW: 130 },
    { elo: 1700, depth: 12, win: 20, slip: 0.01, slipW: 90 },
    { elo: 2000, depth: 14, win: 8, slip: 0, slipW: 0 }
  ];

  var STYLES = {
    aggressive: {
      name: 'The Aggressive Attacker', icon: '🔥',
      short: 'Goes straight for your king: checks, pawn storms and attacking moves, even when slightly risky.',
      teaches: 'Defending calmly. Count attackers and defenders around your king, trade off its attacking pieces, and punish the attack when it runs out of steam.',
      w: { check: 35, kingZone: 12, forward: 6, attack: 12, capture: 5, trade: -15, retreat: -25 }, risk: 45, win: 1, slip: 1
    },
    defensive: {
      name: 'The Defensive Player', icon: '🛡',
      short: 'Castles early, trades pieces, keeps its king safe and waits for you to over-push.',
      teaches: 'Creating an attack from nothing: improve your worst piece, open a file, find a weakness, and avoid trades when you are the attacker.',
      w: { trade: 25, castle: 45, develop: 10, forward: -6, check: -5, shelter: -40, retreat: 4 }, win: 1, slip: 0.8
    },
    trapper: {
      name: 'The Trap Setter', icon: '🪤',
      short: 'Leaves bait. Plays into known opening traps and makes moves where your "free" capture loses.',
      teaches: 'Checking before you grab. Before taking anything, ask: why did they allow this? What does their next move threaten?',
      w: { trap: 90, check: 10, attack: 8 }, book: true, win: 1.1, slip: 0.9
    },
    positional: {
      name: 'The Positional Player', icon: '♟',
      short: 'Develops, controls the centre, avoids weaknesses and squeezes slowly.',
      teaches: 'Playing with a plan: good piece placement, pawn structure, and when to strike with a tactic against a slow opponent.',
      w: { develop: 22, center: 12, castle: 30, earlyQueen: -30, shelter: -25, retreat: -5 }, win: 0.9, slip: 0.9
    },
    tactical: {
      name: 'The Tactical Player', icon: '⚡',
      short: 'Hunts for tactics. If you leave something loose, it finds the fork, pin or combination.',
      teaches: 'Blunder-checking. Before every move: what are all their checks, captures and threats after it?',
      w: { check: 15, capture: 12, attack: 15 }, punisher: true, win: 1, slip: 0.7
    },
    beginner: {
      name: 'The Blunder-Prone Beginner', icon: '🐣',
      short: 'Grabs material, gives early checks, brings the queen out — and sometimes simply leaves pieces hanging.',
      teaches: 'Punishing mistakes. Spot the free piece, the undefended queen, the unprotected king — and take it.',
      w: { capture: 35, check: 30, earlyQueen: 25, develop: -5 }, hang: true, win: 1.5, slip: 1.6
    },
    solid: {
      name: 'The Solid, Careful Opponent', icon: '🧱',
      short: 'Rarely makes mistakes. Safe moves, no loose pieces, trades when ahead.',
      teaches: 'Patience and accuracy. You will not get gifts; you must build small advantages and convert them.',
      w: { castle: 30, trade: 10, develop: 12, shelter: -30 }, win: 0.5, slip: 0.3
    }
  };
  var STYLE_ORDER = ['beginner', 'trapper', 'aggressive', 'tactical', 'defensive', 'positional', 'solid'];

  function levelFor(rating) {
    var best = 1;
    for (var i = 1; i < LEVELS.length; i++) if (LEVELS[i].elo <= (rating || 450) + 50) best = i;
    return best;
  }

  /* ---------------- move features (what kind of move is this?) ---------------- */
  function sqFile(s) { return s.charCodeAt(0) - 97; }
  function sqRank(s) { return +s[1]; }
  function dist(a, b) { return Math.max(Math.abs(sqFile(a) - sqFile(b)), Math.abs(sqRank(a) - sqRank(b))); }
  function kingSquare(g, color) {
    var b = g.board();
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = b[r][c]; if (p && p.type === 'k' && p.color === color) return String.fromCharCode(97 + c) + (8 - r); }
    return null;
  }

  function features(fen, san) {
    var g = new CT.Chess(fen), me = g.turn(), them = me === 'w' ? 'b' : 'w';
    var ply = (+fen.split(' ')[5] - 1) * 2 + (me === 'b' ? 1 : 0);
    var m = g.move(san);
    if (!m) return null;
    var f = { check: g.inCheck() ? 1 : 0, capture: m.captured ? VAL[m.captured] : 0 };
    f.trade = m.captured && m.captured !== 'p' && VAL[m.captured] === VAL[m.piece] ? 1 : 0;
    var ek = kingSquare(g, them), ok = kingSquare(g, me);
    f.kingZone = m.piece !== 'k' && ek ? Math.max(0, 4 - dist(m.to, ek)) : 0;
    var dir = me === 'w' ? 1 : -1, adv = (sqRank(m.to) - sqRank(m.from)) * dir;
    f.forward = m.piece !== 'k' ? Math.max(0, Math.min(2, adv)) : 0;
    f.retreat = m.piece !== 'k' && m.piece !== 'p' && adv < 0 ? 1 : 0;
    f.castle = /[kq]/.test(m.flags) ? 1 : 0;
    var home = me === 'w' ? '1' : '8';
    f.develop = (m.piece === 'n' || m.piece === 'b') && m.from[1] === home && ply < 24 ? 1 : 0;
    f.center = /^[de][45]$/.test(m.to) ? 1 : /^[cf][3-6]$|^[de][36]$/.test(m.to) ? 0.4 : 0;
    f.earlyQueen = m.piece === 'q' && ply < 14 ? 1 : 0;
    // Pawn moves in front of your own castled king weaken it.
    f.shelter = m.piece === 'p' && ok && Math.abs(sqFile(m.from) - sqFile(ok)) <= 1 && (sqFile(ok) >= 6 || sqFile(ok) <= 1) && ply > 8 ? 1 : 0;
    // Valuable enemy pieces now attacked by the moved piece.
    var attacked = 0, toIdx = (8 - sqRank(m.to)) * 8 + sqFile(m.to);
    g._pieceAttacks(toIdx).forEach(function (i) {
      var s = String.fromCharCode(97 + (i & 7)) + (8 - (i >> 3)), p = g.get(s);
      if (p && p.color === them && p.type !== 'p' && p.type !== 'k') attacked++;
    });
    f.attack = Math.min(2, attacked);
    // Obvious hang: the moved piece can be taken and is undefended (or attacked by something cheaper).
    var val = VAL[m.piece];
    if (val >= 3) {
      var atk = g.attackers(m.to, them), def = g.attackers(m.to, me);
      var cheapest = atk.reduce(function (mn, s) { return Math.min(mn, VAL[g.get(s).type] || 99); }, 99);
      f.hang = atk.length && (!def.length || cheapest < val) ? 1 : 0;
    } else f.hang = 0;
    f.edgeKnight = m.piece === 'n' && /^[ah]/.test(m.to) ? 1 : 0;
    f.kingWalk = m.piece === 'k' && !f.castle && ply < 50 ? 1 : 0;
    f.rookEarly = m.piece === 'r' && ply < 20 ? 1 : 0;
    f.flankPawn = m.piece === 'p' && /^[abgh]/.test(m.from) && ply < 16 ? 1 : 0;
    f.piece = m.piece; f.from = m.from; f.to = m.to; f.uci = m.from + m.to + (m.promotion || '');
    return f;
  }

  /* Opening sense for the old material-only engine (only used if engine-play.js is missing). */
  var BASIC = { develop: 30, center: 18, castle: 40, earlyQueen: -25, edgeKnight: -50, kingWalk: -45, rookEarly: -30, flankPawn: -20, shelter: -20 };

  function styleBonus(style, f, basic) {
    var w = style.w, s = 0;
    Object.keys(w).forEach(function (k) { if (k !== 'trap' && f[k]) s += w[k] * f[k]; });
    if (basic) Object.keys(BASIC).forEach(function (k) { if (f[k]) s += BASIC[k] * f[k]; });
    return s;
  }

  /* ---------------- candidate moves ---------------- */
  function normCp(line) {
    if (line.mate != null) return line.mate > 0 ? MATE - line.mate * 10 : -MATE - line.mate * 10;
    return line.cp || 0;
  }

  function stockfishCandidates(fen, depth) {
    return CT.Stockfish.analyse(fen, { depth: depth, multipv: 8 }).then(function (r) {
      var g = new CT.Chess(fen), out = [];
      Object.keys(r.lines).forEach(function (k) {
        var l = r.lines[k];
        if (!l.pv || !l.pv.length) return;
        var san = CT.Analyzer.uciToSan(fen, l.pv[0]);
        if (!san) return;
        out.push({ san: san, cp: normCp(l), pvSan: CT.Analyzer.pvToSan(fen, l.pv, 4) });
      });
      if (!out.length && r.bestmove) { var s = CT.Analyzer.uciToSan(fen, r.bestmove); if (s) out.push({ san: s, cp: 0, pvSan: [s] }); }
      out.sort(function (a, b) { return b.cp - a.cp; });
      return { list: out, engine: 'stockfish', legalCount: g.moves().length };
    });
  }

  /* Thinking time and depth cap per level for the built-in Trainer Engine (used when Stockfish can't load). */
  var BUILTIN_TIME = [0, 150, 200, 300, 400, 600, 800, 1000, 1500];
  var BUILTIN_DEPTH = [0, 3, 4, 5, 6, 7, 8, 10, 30];

  /** Run the Trainer Engine (in a background thread when possible). */
  function ept(fen, opts) {
    if (CT.EngineWorker) return CT.EngineWorker.think(fen, opts);
    return Promise.resolve(CT.EnginePlay.think(new CT.Chess(fen), opts));
  }

  function playCp(m) { return m.mate != null ? (m.mate > 0 ? MATE - m.mate * 10 : -MATE - m.mate * 10) : m.score; }

  function builtinCandidates(fen, level) {
    var g = new CT.Chess(fen);
    if (CT.EnginePlay) {
      return ept(fen, { timeMs: BUILTIN_TIME[level], maxDepth: BUILTIN_DEPTH[level], multipv: 8 }).then(function (th) {
        return { list: th.moves.map(function (m) { return { san: m.san, cp: playCp(m), pvSan: [m.san] }; }), engine: 'builtin', legalCount: g.moves().length };
      });
    }
    var r = CT.Engine.analyseAll(g, level <= 3 ? 1 : 2, level <= 3 ? 30000 : 80000);
    var out = r.moves.map(function (m) {
      var cp = m.mate ? (m.score > 0 ? MATE : -MATE) : m.score;
      return { san: m.san, cp: cp, pvSan: [m.san] };
    });
    return Promise.resolve({ list: out, engine: 'builtin', legalCount: out.length });
  }

  /** Best reply for the side to move with the built-in engine (used to explain slips and traps). */
  function quickBest(fen) {
    var g = new CT.Chess(fen);
    if (g.isGameOver()) return Promise.resolve(null);
    if (CT.EnginePlay) return ept(fen, { timeMs: 150, maxDepth: 6 }).then(function (th) { return th.moves[0] || null; });
    var r = CT.Engine.analyseAll(g, 2, 40000);
    return Promise.resolve(r.moves[0] || null);
  }

  /** Does this move leave bait? (Your most tempting capture afterwards loses at least 1.5 pawns.) */
  function capturesIfPassed(fen) {
    // Captures the other side would have if it were their move now (a "null move") — so we can tell
    // which captures the candidate move newly offers as bait.
    var parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w'; parts[3] = '-';
    var out = {};
    try {
      var g = new CT.Chess(parts.join(' '));
      if (g.inCheck()) return null;
      g.moves({ verbose: true }).forEach(function (v) { if (v.captured) out[v.from + v.to] = 1; });
    } catch (e) { return null; }
    return out;
  }

  function trapAfter(fen, san) {
    var g = new CT.Chess(fen);
    var m = g.move(san);
    if (!m || g.isGameOver()) return Promise.resolve(null);
    var before = capturesIfPassed(fen) || {}, afterFen = g.fen();
    var scored = CT.EnginePlay ? ept(afterFen, { timeMs: 150, maxDepth: 5, multipv: 60 }).then(function (th) { return th.moves.map(function (x) { return { san: x.san, score: playCp(x) }; }); })
      : Promise.resolve(CT.Engine.analyseAll(g, 2, 25000).moves);
    return scored.then(function (moves) {
      if (!moves.length) return null;
      var best = moves[0].score, byS = {};
      g.moves({ verbose: true }).forEach(function (v) { byS[v.san] = v; });
      var tempting = moves.filter(function (x) {
        var v = byS[x.san];
        return v && v.captured && v.captured !== 'k' && (v.to === m.to || !before[v.from + v.to]);
      }).sort(function (a, b) { return VAL[byS[b.san].captured] - VAL[byS[a.san].captured]; }).slice(0, 3);
      for (var i = 0; i < tempting.length; i++) {
        var t = tempting[i];
        if (t.score <= best - 150 && t.san !== moves[0].san) {
          var after = new CT.Chess(afterFen); after.move(t.san);
          var info = { bait: t.san, safe: moves[0].san, punish: null, loss: Math.round((best - t.score) / 100 * 10) / 10 };
          return quickBest(after.fen()).then(function (pun) { info.punish = pun ? pun.san : null; return info; });
        }
      }
      return null;
    });
  }

  /**
   * Stockfish version of trapAfter: scores your newly-offered captures from the same position and depth.
   * userBest = your best score after the candidate (= minus the candidate's score for the opponent).
   */
  function trapAfterSF(fen, san, depth, userBest) {
    var g = new CT.Chess(fen);
    var m = g.move(san);
    if (!m || g.isGameOver()) return Promise.resolve(null);
    var before = capturesIfPassed(fen) || {};
    var caps = g.moves({ verbose: true }).filter(function (v) { return v.captured && v.captured !== 'k' && (v.to === m.to || !before[v.from + v.to]); })
      .sort(function (a, b) { return VAL[b.captured] - VAL[a.captured]; }).slice(0, 3);
    if (!caps.length) return Promise.resolve(null);
    var afterFen = g.fen();
    return CT.Stockfish.analyse(afterFen, { depth: depth, multipv: caps.length, searchmoves: caps.map(function (v) { return v.from + v.to + (v.promotion || ''); }) }).then(function (r) {
      var worst = null;
      Object.keys(r.lines).forEach(function (k) {
        var l = r.lines[k]; if (!l.pv || !l.pv.length) return;
        var sc = normCp(l);
        if (sc <= userBest - 150 && (!worst || sc < worst.sc)) worst = { sc: sc, l: l };
      });
      if (!worst) return null;
      var pv = CT.Analyzer.pvToSan(afterFen, worst.l.pv, 3);
      return { bait: pv[0], punish: pv[1] || null, loss: Math.round((userBest - worst.sc) / 10) / 10 };
    }, function () { return null; });
  }

  /* ---------------- opening books ---------------- */
  function trapBook() {
    var D = CT.Data, out = [];
    (D.traps || []).forEach(function (t) { out.push({ id: t.id, name: t.name, setter: t.setter, moves: t.moves.map(function (x) { return x[0]; }), victim: t.mistakePly, soundness: t.soundness, href: '#/lab/trap/' + t.id }); });
    var linked = (D.linkedTraps || []).map(function (x) { return x.id; });
    (D.openingLines || []).forEach(function (l) {
      var isTrap = l.kind === 'trap' || l.kind === 'trap-avoid' || linked.indexOf(l.id) >= 0;
      if (!isTrap) return;
      var setter = l.kind === 'trap-avoid' ? (l.side === 'w' ? 'b' : 'w') : l.side;
      var victim = l.kind === 'trap-avoid' ? l.moves.length - 2 : l.mistakePly;
      if (victim == null) return;
      out.push({ id: l.id, name: l.name, setter: setter, moves: l.moves.map(function (x) { return x[0]; }), victim: victim, soundness: l.soundness || 'conditional', href: '#/openings/' + l.id + '/learn' });
    });
    return out;
  }

  function bookTrapMove(history, color, level) {
    var p = history.length, opts = [];
    trapBook().forEach(function (t) {
      if (t.setter !== color || p >= t.victim || !t.moves[p]) return;
      if (t.soundness === 'unsound' && level > 3) return;
      if (t.soundness === 'conditional' && level > 6) return;
      for (var i = 0; i < p; i++) if (t.moves[i] !== history[i]) return;
      opts.push(t);
    });
    if (!opts.length) return null;
    var t = opts[Math.floor(Math.random() * opts.length)];
    return { san: t.moves[p], trap: t };
  }

  function repertoireMove(repId, history) {
    if (!repId || !CT.OpeningTree) return null;
    var tree = CT.OpeningTree.build(repId), kids = CT.OpeningTree.childList(tree, history.join(' '));
    if (!kids.length) return null;
    var weights = kids.map(function (k) { return k.mistake ? 0.5 : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total;
    for (var i = 0; i < kids.length; i++) { r -= weights[i]; if (r <= 0) return kids[i]; }
    return kids[kids.length - 1];
  }

  /* ---------------- choosing a move ---------------- */
  function gauss() { var u = Math.random() || 1e-9, v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /**
   * Pick a move from a candidate list. Pure function of its inputs plus `rand` (for tests).
   * ctx: {style, level, fen, trapInfo: {san: info}, rand}
   */
  function pick(cands, ctx) {
    var style = STYLES[ctx.style], L = LEVELS[ctx.level], rand = ctx.rand || Math.random;
    var best = cands[0], second = cands[1];
    var W = L.win * style.win;
    var slipping = rand() < L.slip * style.slip;
    if (slipping) W = Math.max(W, L.slipW * (style.slip > 1 ? 1.2 : 1));
    if (slipping && style.hang && ctx.level <= 2) W = Infinity; // a real beginner misses even mate threats
    // "Punish my blunders" mode: whatever the style, a clearly winning reply (≥1.5 pawns better than the next move) is always found.
    if (ctx.punishAll && second && best.cp - second.cp >= 150) return { cand: best, slip: false };
    // The Tactical Player almost never misses a clear tactic.
    if (style.punisher && second && best.cp - second.cp >= 150 && rand() < (ctx.level >= 2 ? 0.95 : 0.7)) return { cand: best, slip: false };
    var pool = cands.filter(function (c) {
      var extra = style.risk && c.f && (c.f.check || c.f.kingZone >= 2) ? style.risk : 0;
      if (best.cp - c.cp > W + extra) return false;
      if (c.f && c.f.hang && !style.hang && c !== best) return false;
      return true;
    });
    if (!pool.length) pool = [best];
    var temp = 12 + Math.min(W, 400) * 0.15;
    var top = null, topU = -Infinity;
    pool.forEach(function (c) {
      var u = -(best.cp - c.cp) + (c.f ? styleBonus(style, c.f, ctx.basic) : 0) + gauss() * temp;
      if (ctx.trapInfo && ctx.trapInfo[c.san]) u += style.w.trap || 0;
      if (u > topU) { topU = u; top = c; }
    });
    return { cand: top, slip: slipping };
  }

  /**
   * Choose the opponent's move.
   * opts: {fen, history:[san], style, level, color, repertoire, useStockfish}
   * Resolves {san, engine, notes:[…]}.
   */
  function move(opts) {
    var fen = opts.fen, style = STYLES[opts.style], level = opts.level, notes = [];
    // 1) Opening practice: follow the repertoire tree.
    var rm = repertoireMove(opts.repertoire, opts.history);
    if (rm) return Promise.resolve({ san: rm.san, engine: 'book', notes: rm.mistake ? [{ kind: 'book-mistake', ply: opts.history.length, san: rm.san }] : [] });
    // 2) Trap Setter: steer into a known trap.
    if (style.book && Math.random() < 0.85) {
      var bt = bookTrapMove(opts.history, opts.color, level);
      if (bt) return Promise.resolve({ san: bt.san, engine: 'book', notes: [{ kind: 'book-trap', ply: opts.history.length, san: bt.san, trap: { id: bt.trap.id, name: bt.trap.name, victimPly: bt.trap.victim, victimMove: bt.trap.moves[bt.trap.victim], soundness: bt.trap.soundness, href: bt.trap.href } }] });
    }
    var L = LEVELS[level];
    var useSF = opts.useStockfish !== false && CT.Stockfish && CT.Stockfish.status().state === 'ready';
    var getC = useSF ? stockfishCandidates(fen, L.depth) : builtinCandidates(fen, level);
    return getC.then(function (c) {
      var cands = c.list;
      if (!cands.length) throw new Error('No legal moves');
      cands.forEach(function (x) { x.f = features(fen, x.san); });
      var trapInfo = {}, checks = [];
      if (style.w.trap) {
        cands.slice(0, 4).forEach(function (x) {
          if (cands[0].cp - x.cp > LEVELS[level].win * style.win + 30) return;
          if (c.engine === 'stockfish') checks.push(trapAfterSF(fen, x.san, Math.min(L.depth, 10), -x.cp).then(function (t) { if (t) trapInfo[x.san] = t; }));
          else checks.push(trapAfter(fen, x.san).then(function (t) { if (t) trapInfo[x.san] = t; }));
        });
      }
      return Promise.all(checks).then(function () { return finish(c, cands, trapInfo); });
    });
    function finish(c, cands, trapInfo) {
      var res = pick(cands, { style: opts.style, level: level, fen: fen, trapInfo: trapInfo, basic: c.engine === 'builtin' && !CT.EnginePlay, punishAll: !!opts.punishAll });
      var ch = res.cand, loss = cands[0].cp - ch.cp;
      if (trapInfo[ch.san]) notes.push({ kind: 'trap', ply: opts.history.length, san: ch.san, bait: trapInfo[ch.san].bait, punish: trapInfo[ch.san].punish, loss: trapInfo[ch.san].loss, quick: c.engine === 'builtin' });
      var quick = c.engine === 'builtin', done = { san: ch.san, engine: c.engine, notes: notes, eval: ch.cp };
      if (loss >= (quick ? 200 : 100) && Math.abs(cands[0].cp) < MATE - 1000) {
        var after = new CT.Chess(fen); after.move(ch.san);
        var slip = { kind: 'slip', ply: opts.history.length, san: ch.san, best: cands[0].san, loss: Math.round(loss / 10) / 10, punish: null, quick: quick };
        notes.push(slip);
        if (ch.pvSan && ch.pvSan[1]) { slip.punish = ch.pvSan[1]; return done; }
        return quickBest(after.fen()).then(function (q) { slip.punish = q ? q.san : null; return done; });
      }
      return done;
    }
  }

  CT.Opponent = {
    STYLES: STYLES, STYLE_ORDER: STYLE_ORDER, LEVELS: LEVELS, levelFor: levelFor,
    move: move, pick: pick, features: features, trapAfter: trapAfter, trapAfterSF: trapAfterSF, trapBook: trapBook, bookTrapMove: bookTrapMove
  };
})(typeof window !== 'undefined' ? window : globalThis);
