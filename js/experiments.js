/*
 * The Coach's Lab — training run like the scientific method, on YOUR games.
 *
 *   1. Observe:     every analysed real game (not practice games) is scanned for "symptoms" — pieces left hanging,
 *                   opponent threats missed, mates allowed, tactics missed (by motif), mates missed, early opening
 *                   damage, winning positions not converted, blunders made too fast.
 *   2. Hypothesis:  the symptom that costs you the most winning chances per game (in your last 10 games, seen in
 *                   at least 2 of them) becomes the hypothesis: "this is your biggest leak, and this training fixes it".
 *   3. Experiment:  one training method for that symptom is added to every daily session (method A first).
 *   4. Measure:     games played after the start are compared with the 10 before it. Counts per game are treated as
 *                   Poisson rates with a Gamma posterior; we estimate the chance the rate really went down.
 *   5. Conclude:    after 8+ new games: improved (≥90% sure and at least 25% lower) → keep a small maintenance dose,
 *                   move on to the next leak; no clear change → switch to method B (or, after B, move on);
 *                   still unclear → keep measuring up to 14 games or 28 days.
 *
 * Everything happens automatically. The daily session shows the experiment block with its reason; the full
 * record is in Progress → Coach's notebook.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var MIN_BASE = 5, BASE_N = 10, MIN_TEST = 8, MAX_TEST = 14, EARLY_TEST = 5, MAX_DAYS = 28;
  var COOLDOWN = 30 * 86400000;

  function Store() { return CT.Store; }
  function lab() { var s = Store().state; s.experiments = s.experiments || { active: null, history: [], n: 0 }; return s.experiments; }
  function NAME(k) { return (CT.Analysis && CT.Analysis.MOTIF_NAME[k]) || k; }

  /* ---------------- 1. Observe ---------------- */
  /* Each symptom: what it means, how to count it in one game, and two training methods. */
  var SYMPTOMS = {
    hung: { name: 'Leaving pieces hanging', unit: 'pieces hung',
      why: 'Your move left a piece that could simply be taken for free.',
      methods: [
        { label: 'Blunder-check drill', how: 'two hidden-threat drills a day: before you move, find what your opponent is threatening', href: '#/lab/threats', counter: 'lab', target: [1, 2, 2] },
        { label: 'Free-piece spotting', how: 'puzzles where a piece is hanging — train your eye to see unprotected pieces instantly', href: '#/tactics/train/hanging', counter: 'puzzles', target: [5, 8, 10] }
      ] },
    threats: { name: 'Missing your opponent\'s tactic', unit: 'tactics missed',
      why: 'After your move, your opponent had a fork, pin, skewer or similar that you did not see coming.',
      methods: [
        { label: 'Hidden-threat drill', how: 'find your opponent\'s threat first, then defend', href: '#/lab/threats', counter: 'lab', target: [1, 2, 2] },
        { label: 'Defence puzzles', how: 'puzzles where the right move is the defence', href: '#/tactics/train/defence', counter: 'puzzles', target: [4, 6, 8] }
      ] },
    mated: { name: 'Allowing checkmate', unit: 'mates allowed',
      why: 'Your move allowed a forced checkmate (often on the back rank).',
      methods: [
        { label: 'Back-rank danger drill', how: 'spot which move loses to a mate before you play it', href: '#/tactics/danger', counter: 'lab', target: [3, 4, 5] },
        { label: 'Mating patterns', how: 'learn the mates so you see them coming against you', href: '#/tactics/train/mate-patterns', counter: 'puzzles', target: [4, 6, 8] }
      ] },
    missedMate: { name: 'Missing a checkmate', unit: 'mates missed',
      why: 'You had a forced checkmate and played something else.',
      methods: [
        { label: 'Mate-in-one spotting', how: 'checks first — every move', href: '#/tactics/train/mate1', counter: 'puzzles', target: [5, 8, 10] },
        { label: 'Mating patterns', how: 'longer mates and their typical shapes', href: '#/tactics/train/mate-patterns', counter: 'puzzles', target: [4, 6, 8] }
      ] },
    missed: { name: 'Missing a tactic you had', unit: 'tactics missed', motif: true,
      why: 'You had a winning tactic and did not play it.',
      methods: [
        { label: 'Themed puzzles', how: 'puzzles on exactly this pattern', counter: 'puzzles', target: [5, 8, 10] },
        { label: 'Themed puzzles, bigger dose', how: 'more of this pattern, including harder ones', counter: 'puzzles', target: [8, 12, 15] }
      ] },
    opening: { name: 'Early damage in the opening', unit: 'opening errors',
      why: 'A mistake or blunder in your first 10 moves.',
      methods: [
        { label: 'Repertoire drills', how: 'drill your due opening lines until you play them from memory', href: '#/openings/quiz/all', counter: 'openings', target: [1, 2, 2] },
        { label: 'Trap drills', how: 'the traps in your openings, from both sides', href: '#/lab/drills', counter: 'openings', target: [1, 2, 2] }
      ] },
    conversion: { name: 'Not converting winning positions', unit: 'wins let slip', binary: true,
      why: 'You reached a clearly winning position (85%+ winning chances) and did not win.',
      methods: [
        { label: 'Convert the Win', how: 'win positions where you are ahead, without giving it back', href: '#/endgames/convert', counter: 'endgames', target: [1, 2, 2] },
        { label: 'Endgame technique', how: 'the basic winning endgames', href: '#/endgames', counter: 'endgames', target: [1, 2, 2] }
      ] },
    rushed: { name: 'Blundering too fast', unit: 'fast blunders',
      why: 'A mistake or blunder played in under 5 seconds (needs clock times in the game).',
      methods: [
        { label: 'Slow, safety-checked game', how: 'one 15+10 practice game with Safety check on — name the danger before every move', href: '#/practice', counter: 'games', target: [1, 1, 1] },
        { label: 'Blunder-check drill', how: 'hidden-threat drills to build the pause-and-check habit', href: '#/lab/threats', counter: 'lab', target: [1, 2, 2] }
      ] }
  };
  var MOTIF_OK = { fork: 1, 'double-attack': 1, pin: 1, skewer: 1, discovered: 1, hanging: 1 };

  function isReal(g) { var h = g.headers || {}; return h.Site !== 'Chess Trainer' && !/^Practice/.test(h.Event || ''); }
  /** Analysed real games, newest first. */
  function realGames() {
    return (CT.Games ? CT.Games.list() : []).filter(function (g) { return g.analysis && g.report && g.report.userColor && isReal(g); })
      .sort(function (a, b) { return playedAt(b) - playedAt(a); });
  }
  /** When the game was played (from its headers), falling back to when it was added. */
  function playedAt(g) {
    var h = g.headers || {}, d = (h.UTCDate || h.Date || '').replace(/\./g, '-'), t = h.UTCTime || h.EndTime || '';
    var ms = /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(d + 'T' + (/^\d{2}:\d{2}:\d{2}$/.test(t) ? t : '12:00:00') + 'Z') : NaN;
    return isNaN(ms) ? (g.addedAt || 0) : ms;
  }

  var cache = {};
  /** Symptom counts and costs (winning chances lost) in one game. */
  function measure(g) {
    var key = g.id + ':' + (g.analysis.at || 0);
    if (cache[key]) return cache[key];
    var res = CT.Games.expand(g), me = g.report.userColor, out = { counts: {}, cost: {}, motifs: {} };
    Object.keys(SYMPTOMS).forEach(function (k) { out.counts[k] = 0; out.cost[k] = 0; });
    var add = function (k, loss) { out.counts[k]++; out.cost[k] += loss || 0; };
    var bad = function (m) { return m.cls === 'blunder' || m.cls === 'mistake'; };
    var clocks = g.clocks || null, inc = incOf(g);
    res.moves.forEach(function (m, i) {
      if (m.color !== me) return;
      var mk = m.motif && m.motif.key, tactical = true;
      if (bad(m) && m.lessonKind === 'threat' && mk === 'hanging') add('hung', m.loss);
      else if (bad(m) && m.lessonKind === 'threat' && (mk === 'mate' || mk === 'back-rank' || mk === 'mate-threat' || m.allowsMate)) add('mated', m.loss);
      else if (bad(m) && m.lessonKind === 'threat' && mk) add('threats', m.loss);
      else if (m.missedMate) add('missedMate', m.loss);
      else if (bad(m) && m.lessonKind === 'missed' && MOTIF_OK[mk]) { add('missed', m.loss); out.motifs[mk] = (out.motifs[mk] || 0) + 1; }
      else tactical = false;
      // Opening damage = an early mistake that is not one of the tactical leaks above (those are counted there).
      if (bad(m) && !tactical && m.moveNo <= 10) add('opening', m.loss);
      if (bad(m) && clocks && i >= 2 && clocks[i] != null && clocks[i - 2] != null) {
        var spent = clocks[i - 2] - clocks[i] + inc;
        if (spent >= 0 && spent < 5) add('rushed', m.loss);
      }
    });
    if (g.report.hadWinning) {
      var peak = Math.max.apply(null, res.moves.filter(function (m) { return m.color === me; }).map(function (m) { return m.winAfter; }).concat([0]));
      var outcome = g.report.outcome === 'drew' || g.report.outcome === 'draw' ? 50 : 0;
      add('conversion', Math.max(0, peak - outcome));
    }
    cache[key] = out;
    return out;
  }
  function incOf(g) { var tc = (g.headers || {}).TimeControl || ''; var m = /\+(\d+)/.exec(tc); return m ? +m[1] : 0; }

  /** Per-symptom picture over a set of games. motif = only count that motif (for "missed"). */
  function summarise(games, key, motif) {
    var n = games.length, total = 0, cost = 0, affected = 0;
    games.forEach(function (g) {
      var m = measure(g), c = motif ? (m.motifs[motif] || 0) : m.counts[key];
      if (motif) cost += c ? m.cost[key] * c / Math.max(1, m.counts[key]) : 0; else cost += m.cost[key];
      total += c; if (c) affected++;
    });
    return { games: n, total: total, rate: n ? total / n : 0, costPerGame: n ? cost / n : 0, affected: affected };
  }

  /** The table for the notebook: every symptom (and each missed-tactic motif) over your last 10 real games. */
  function observe() {
    var games = realGames().slice(0, BASE_N), rows = [];
    Object.keys(SYMPTOMS).forEach(function (k) {
      if (SYMPTOMS[k].motif) {
        var motifs = {};
        games.forEach(function (g) { var m = measure(g).motifs; Object.keys(m).forEach(function (x) { motifs[x] = 1; }); });
        Object.keys(motifs).forEach(function (mk) { rows.push(Object.assign({ key: k, motif: mk }, summarise(games, k, mk))); });
      } else rows.push(Object.assign({ key: k, motif: null }, summarise(games, k)));
    });
    rows.sort(function (a, b) { return b.costPerGame - a.costPerGame || b.rate - a.rate; });
    return { games: games.length, rows: rows };
  }

  function label(key, motif) { return motif ? 'Missing ' + (motif === 'hanging' ? 'free pieces' : NAME(motif) + 's') + ' you had' : SYMPTOMS[key].name; }

  /* ---------------- 2. Hypothesis ---------------- */
  function pastFor(key, motif) { return lab().history.filter(function (e) { return e.symptom === key && (e.motif || null) === (motif || null); }); }
  /** Choose the costliest leak that is not recently fixed and still has an untried method. */
  function chooseHypothesis(now) {
    now = now || Date.now();
    var ob = observe();
    if (ob.games < MIN_BASE) return null;
    for (var i = 0; i < ob.rows.length; i++) {
      var r = ob.rows[i];
      if (r.affected < 2 || r.total <= 0) continue;
      if (r.key === 'missed' && !(CT.Data.themes[CT.Analysis.MOTIF_THEME[r.motif]])) continue;
      var past = pastFor(r.key, r.motif);
      var lastOk = past.filter(function (e) { return e.verdict === 'improved'; }).pop();
      if (lastOk && now - lastOk.endedAt < COOLDOWN) continue;
      var fails = past.filter(function (e) { return e.verdict !== 'improved' && (!lastOk || e.endedAt > lastOk.endedAt); });
      if (fails.length >= 2) continue; // both methods tried without a clear effect: move on
      return { symptom: r.key, motif: r.motif, method: fails.length, row: r };
    }
    return null;
  }

  /* ---------------- 3. Experiment ---------------- */
  function method(exp) {
    var m = Object.assign({}, SYMPTOMS[exp.symptom].methods[exp.method]);
    if (exp.symptom === 'missed') m.href = '#/tactics/train/' + CT.Analysis.MOTIF_THEME[exp.motif];
    return m;
  }
  function start(h, now) {
    now = now || Date.now();
    var L = lab(), base = realGames().filter(function (g) { return playedAt(g) < now; }).slice(0, BASE_N);
    var b = summarise(base, h.symptom, h.motif);
    var exp = {
      id: ++L.n, symptom: h.symptom, motif: h.motif || null, method: h.method, start: now,
      baseline: { games: b.games, total: b.total, rate: b.rate, costPerGame: b.costPerGame, ids: base.map(function (g) { return g.id; }) },
      status: 'running'
    };
    var m = method(exp);
    exp.hypothesis = 'Your biggest leak right now is ' + label(exp.symptom, exp.motif).toLowerCase() + ' (' + fmt(b.rate * 10) + ' ' + SYMPTOMS[exp.symptom].unit + ' per 10 games, costing about ' + Math.round(b.costPerGame) + '% winning chances a game). ' +
      'Hypothesis: ' + m.label.toLowerCase() + ' every day (' + m.how + ') will cut it by at least a quarter in your next real games.';
    L.active = exp;
    Store().state.log.push({ t: now, kind: 'experiment', id: exp.id, ok: true });
    Store().save();
    return exp;
  }

  /* ---------------- 4. Measure ---------------- */
  /** Seeded random numbers, so the same data always gives the same verdict. */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function normal(r) { var u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function gamma(shape, r) { // Marsaglia–Tsang
    if (shape < 1) return gamma(shape + 1, r) * Math.pow(r(), 1 / shape);
    var d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) { var x, v; do { x = normal(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; var u = r(); if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
  }
  /** P(test rate < baseline rate) with Gamma(0.5 + count, games) posteriors (Jeffreys prior). */
  function probLower(base, test, seed) {
    var r = rng(seed || 12345), n = 4000, hits = 0;
    for (var i = 0; i < n; i++) { var lb = gamma(0.5 + base.total, r) / base.games, lt = gamma(0.5 + test.total, r) / test.games; if (lt < lb) hits++; }
    return hits / n;
  }
  function testGames(exp) { return realGames().filter(function (g) { return playedAt(g) >= exp.start && exp.baseline.ids.indexOf(g.id) < 0; }); }

  function evaluate(exp, now) {
    now = now || Date.now();
    var games = testGames(exp), t = summarise(games, exp.symptom, exp.motif);
    var res = { games: t.games, total: t.total, rate: t.rate, costPerGame: t.costPerGame, p: null, effect: null, verdict: null };
    if (t.games) {
      res.p = probLower(exp.baseline, t, exp.id * 7919 + t.games);
      res.effect = exp.baseline.rate ? 1 - t.rate / exp.baseline.rate : 0;
    }
    var days = (now - exp.start) / 86400000;
    if (t.games >= EARLY_TEST && res.p >= 0.97 && res.effect >= 0.4) res.verdict = 'improved';
    else if (t.games >= MIN_TEST && res.p >= 0.9 && res.effect >= 0.25) res.verdict = 'improved';
    else if (t.games >= MIN_TEST && res.p <= 0.6) res.verdict = 'no-effect';
    else if (t.games >= MAX_TEST || (days >= MAX_DAYS && t.games >= EARLY_TEST)) res.verdict = res.p >= 0.9 && res.effect >= 0.25 ? 'improved' : 'unclear';
    else if (days >= MAX_DAYS * 2) res.verdict = 'stopped'; // you have hardly played: stop, try again later
    return res;
  }

  /* ---------------- 5. Conclude, then the next hypothesis ---------------- */
  function conclude(exp, res, now) {
    var L = lab();
    exp.status = 'done'; exp.verdict = res.verdict; exp.endedAt = now || Date.now(); exp.result = res;
    L.history.push(exp); L.active = null;
    Store().state.log.push({ t: exp.endedAt, kind: 'experiment-end', id: exp.id, ok: res.verdict === 'improved' });
    Store().save();
    return exp;
  }

  /** Run after new games are analysed (and on start): measure, conclude, start the next experiment. */
  function update(now) {
    now = now || Date.now();
    var L = lab(), events = [];
    if (L.active) {
      var res = evaluate(L.active, now);
      if (res.verdict) events.push({ kind: 'concluded', exp: conclude(L.active, res, now) });
    }
    if (!L.active) {
      var h = chooseHypothesis(now);
      if (h) events.push({ kind: 'started', exp: start(h, now) });
    }
    return events;
  }

  /** Toast for a finished experiment, in plain words. */
  function verdictText(exp) {
    var r = exp.result || {}, name = label(exp.symptom, exp.motif);
    if (exp.verdict === 'improved') return '🔬 Experiment #' + exp.id + ' worked: ' + name.toLowerCase() + ' went from ' + fmt(exp.baseline.rate * 10) + ' to ' + fmt(r.rate * 10) + ' per 10 games (' + Math.round((r.p || 0) * 100) + '% sure it is real).';
    if (exp.verdict === 'no-effect') return '🔬 Experiment #' + exp.id + ': ' + method(exp).label + ' did not reduce ' + name.toLowerCase() + '. Trying a different method next.';
    if (exp.verdict === 'unclear') return '🔬 Experiment #' + exp.id + ': no clear change in ' + name.toLowerCase() + ' — moving on for now.';
    return '🔬 Experiment #' + exp.id + ' paused: not enough new games to measure.';
  }

  /* ---------------- Daily session hook ---------------- */
  /** The experiment's block for today's session (or a maintenance block after a success). */
  function sessionBlock(size) {
    var L = lab(), exp = L.active;
    if (exp) {
      var m = method(exp), r = evaluate(exp);
      return { key: 'experiment', icon: '🔬', title: 'Experiment: ' + m.label, href: m.href, counter: m.counter, target: m.target[size], core: true,
        reason: 'Fixing your biggest leak: ' + label(exp.symptom, exp.motif).toLowerCase() + ' (' + fmt(exp.baseline.rate * 10) + ' per 10 games before). Measuring in your real games: ' + r.games + '/' + MIN_TEST + ' so far.' };
    }
    var won = L.history.filter(function (e) { return e.verdict === 'improved' && Date.now() - e.endedAt < 21 * 86400000; }).pop();
    if (won && size > 0) {
      var mm = method(won);
      return { key: 'maintain', icon: '🔬', title: 'Keep it fixed: ' + mm.label, href: mm.href, counter: mm.counter, target: 1,
        reason: 'Experiment #' + won.id + ' worked — a small dose keeps ' + label(won.symptom, won.motif).toLowerCase() + ' from coming back.' };
    }
    return null;
  }

  function status() {
    var L = lab(), exp = L.active;
    if (!exp) return { active: null, games: realGames().length, needed: MIN_BASE };
    var r = evaluate(exp);
    return { active: exp, measured: r.games, needed: MIN_TEST, interim: r, title: label(exp.symptom, exp.motif), method: method(exp) };
  }

  function fmt(x) { return (Math.round(x * 10) / 10).toString(); }

  /* ---------------- Background analysis of new games ---------------- */
  var job = null, queueRunning = false;
  function idleRoute() { var h = root.location ? root.location.hash || '#/' : '#/'; return h === '#/' || h === '' || h === '#' || /^#\/progress(\/notebook)?$/.test(h) || h === '#/session'; }
  /** Analyse up to `max` unanalysed real games (newest first) with Stockfish while you are on a quiet screen. */
  function analyseQueue(max, onDone) {
    if (queueRunning || !CT.Games || !CT.Analyzer || !CT.Stockfish) return;
    var todo = CT.Games.list().filter(function (g) { return !g.analysis && g.userColor && isReal(g) && g.moves && g.moves.length >= 10; })
      .sort(function (a, b) { return playedAt(b) - playedAt(a); }).slice(0, max || 3);
    if (!todo.length || !idleRoute()) return;
    queueRunning = true;
    var done = 0;
    (function next(i) {
      if (i >= todo.length || !idleRoute()) { queueRunning = false; finishQueue(done, onDone); return; }
      CT.Analyzer.pick(true).then(function (an) {
        if (an.source !== 'stockfish') throw new Error('no-stockfish'); // the small built-in engine is too weak for measuring
        if (!idleRoute()) throw new Error('left');
        var g = todo[i];
        job = CT.Analysis.analyseGame({ startFen: g.startFen, moves: g.moves, headers: g.headers }, { analyzer: an, depth: 14 });
        return job.then(function (res) { job = null; CT.Games.saveAnalysis(g.id, res); done++; next(i + 1); });
      }).catch(function () { job = null; queueRunning = false; finishQueue(done, onDone); });
    })(0);
  }
  function finishQueue(done, onDone) {
    if (!done) return;
    var ev = update();
    ev.forEach(function (e) { if (e.kind === 'concluded' && CT.UI) CT.UI.toast(verdictText(e.exp)); else if (e.kind === 'started' && CT.UI) CT.UI.toast('🔬 New experiment: ' + label(e.exp.symptom, e.exp.motif).toLowerCase()); });
    if (onDone) onDone(done);
  }
  function stopQueue() { if (job && job.cancel) { try { job.cancel(); } catch (e) { /* ignore */ } } job = null; }
  function pendingAnalysis() { return CT.Games ? CT.Games.list().filter(function (g) { return !g.analysis && g.userColor && isReal(g) && g.moves && g.moves.length >= 10; }).length : 0; }

  if (root.addEventListener && root.document) {
    root.addEventListener('hashchange', function () { if (!idleRoute()) stopQueue(); else setTimeout(function () { analyseQueue(3, rerenderIfIdle); }, 1500); });
  }
  function rerenderIfIdle() { if (CT.App && idleRoute()) CT.App.rerender(); }

  CT.Experiments = {
    SYMPTOMS: SYMPTOMS, MIN_BASE: MIN_BASE, MIN_TEST: MIN_TEST, MAX_TEST: MAX_TEST,
    measure: measure, observe: observe, label: label, chooseHypothesis: chooseHypothesis, start: start, evaluate: evaluate, conclude: conclude,
    update: update, verdictText: verdictText, sessionBlock: sessionBlock, status: status, method: method, probLower: probLower,
    realGames: realGames, playedAt: playedAt, analyseQueue: analyseQueue, pendingAnalysis: pendingAnalysis, lab: lab, fmt: fmt,
    _clearCache: function () { cache = {}; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
