/*
 * milestones.js — Rating milestones (500 → 1800) as measurable learning goals.
 * A milestone is reached only when you can APPLY the knowledge:
 *   • tactics accuracy on the relevant themes (recent results, not lessons completed),
 *   • a timed skill test without hints,
 *   • results in practice games (no takebacks) and, from 600 up, blunder rate in your analysed games.
 * Milestones are learning goals, not guaranteed ratings. Once reached, a milestone stays reached.
 */
(function (root) {
  'use strict';
  var CT = root.CT;

  var T1 = ['hanging', 'mate1', 'fork', 'pin', 'skewer', 'discovered', 'double-attack', 'mate-patterns'];
  var T2 = ['remove-defender', 'overload', 'back-rank', 'back-rank-combo', 'decoy', 'zwischenzug', 'trapped-piece', 'smothered'];

  var LIST = [
    { id: 'm500', rating: 500, title: 'Stop giving pieces away', focus: 'See hanging pieces (yours and theirs) and one-move mates.',
      test: { themes: ['hanging', 'mate1', 'fork', 'pin'], maxLevel: 1, count: 8, pass: 0.75, secs: 90 },
      reqs: [
        { type: 'themes', themes: ['hanging', 'mate1'], acc: 0.7, min: 5 },
        { type: 'practice', wins: 2, level: 1, styles: ['beginner'] },
        { type: 'test' }
      ] },
    { id: 'm600', rating: 600, title: 'Basic tactics', focus: 'Forks, pins, skewers and discovered attacks; know your first opening moves.',
      test: { themes: T1, maxLevel: 1, count: 10, pass: 0.8, secs: 75 },
      reqs: [
        { type: 'themes', themes: ['fork', 'pin', 'skewer', 'discovered'], acc: 0.7, min: 5 },
        { type: 'openings', count: 4, status: 'learned' },
        { type: 'practice', wins: 2, level: 2 },
        { type: 'games', games: 3, blunders: 3 },
        { type: 'test' }
      ] },
    { id: 'm700', rating: 700, title: 'Two-move combinations', focus: 'Double attacks and mating patterns; spot your opponent\'s threats; handle traps.',
      test: { themes: T1.concat(['back-rank', 'back-rank-combo', 'remove-defender']), maxLevel: 2, count: 10, pass: 0.8, secs: 75 },
      reqs: [
        { type: 'tier', tier: 2 },
        { type: 'themes', themes: ['double-attack', 'mate-patterns'], acc: 0.7, min: 5 },
        { type: 'openings', count: 8, status: 'learned' },
        { type: 'threats', count: 3 },
        { type: 'endgame', drill: 'kq-mate' },
        { type: 'practice', wins: 1, level: 2, styles: ['trapper'] },
        { type: 'practice', wins: 1, level: 2, styles: ['tactical'] },
        { type: 'games', games: 3, blunders: 2.5 },
        { type: 'test' }
      ] },
    { id: 'm800', rating: 800, title: 'Removing defenders', focus: 'Removing the defender, overloads, back-rank weaknesses.',
      test: { themes: T2, maxLevel: 2, count: 8, pass: 0.75, secs: 90 },
      reqs: [
        { type: 'themes', themes: ['remove-defender', 'overload', 'back-rank'], acc: 0.7, min: 4 },
        { type: 'openings', count: 4, status: 'mastered' },
        { type: 'safety', score: 0.9, games: 5 },
        { type: 'endgame', drill: 'stalemate' },
        { type: 'practice', wins: 3, level: 3, distinct: 2 },
        { type: 'games', games: 4, blunders: 2 },
        { type: 'test' }
      ] },
    { id: 'm900', rating: 900, title: 'Plans after the opening', focus: 'Decoys, trapped pieces, in-between moves; improve your worst piece.',
      test: { themes: T1.concat(T2), maxLevel: 3, count: 10, pass: 0.8, secs: 75 },
      reqs: [
        { type: 'themes', themes: ['decoy', 'trapped-piece'], acc: 0.7, min: 4 },
        { type: 'endgame', drill: 'kpk-win' },
        { type: 'openings', count: 8, status: 'mastered' },
        { type: 'practice', wins: 2, level: 4, distinct: 2 },
        { type: 'games', games: 5, blunders: 1.6 },
        { type: 'test' }
      ] },
    { id: 'm1000', rating: 1000, title: 'Three-move combinations', focus: 'Quiet moves and longer combinations; converting a material advantage.',
      test: { themes: T2.concat(['quiet-move', 'decoy']), maxLevel: 3, count: 10, pass: 0.8, secs: 90 },
      reqs: [
        { type: 'tier', tier: 3 },
        { type: 'openings', count: 12, status: 'mastered' },
        { type: 'endgame', drill: 'kr-mate', underMs: 60000 },
        { type: 'endgame', drill: 'kpk-hold' },
        { type: 'convert', passes: 2 },
        { type: 'practice', wins: 1, level: 5, styles: ['solid', 'positional', 'defensive'] },
        { type: 'games', games: 5, blunders: 1.2 },
        { type: 'test' }
      ] },
    { id: 'm1200', rating: 1200, title: 'Quiet moves & defence', focus: 'Quiet moves, defensive resources, pawn structures.',
      test: { themes: ['sacrifice', 'defence', 'quiet-move', 'zwischenzug', 'decoy', 'mating-attack', 'overload', 'remove-defender'], maxLevel: 3, count: 10, pass: 0.8, secs: 120, minLevel: 3, rating: [1350, 1650] },
      reqs: [
        { type: 'openings', count: 18, status: 'mastered' },
        { type: 'convert', passes: 5 },
        { type: 'practice', wins: 3, level: 5, distinct: 3 },
        { type: 'games', games: 6, blunders: 1 },
        { type: 'test' }
      ] },
    { id: 'm1400', rating: 1400, title: 'Sound attacks', focus: 'Attacking the king with sacrifices that actually work.',
      test: { themes: ['sacrifice', 'defence', 'quiet-move', 'zwischenzug', 'decoy', 'mating-attack', 'overload', 'remove-defender'], maxLevel: 4, count: 10, pass: 0.8, secs: 150, minLevel: 3, rating: [1550, 1850] },
      reqs: [
        { type: 'practice', wins: 3, level: 6, distinct: 3 },
        { type: 'games', games: 8, blunders: 0.8 },
        { type: 'test' }
      ] },
    { id: 'm1600', rating: 1600, title: 'Deep calculation', focus: 'Forcing lines 4–5 moves deep; prophylaxis.',
      test: { themes: ['sacrifice', 'defence', 'quiet-move', 'zwischenzug', 'decoy', 'mating-attack', 'overload', 'remove-defender'], maxLevel: 4, count: 10, pass: 0.8, secs: 180, minLevel: 4, rating: [1700, 2000] },
      reqs: [
        { type: 'practice', wins: 2, level: 7, distinct: 2 },
        { type: 'games', games: 8, blunders: 0.6 },
        { type: 'test' }
      ] },
    { id: 'm1800', rating: 1800, title: 'Complete player', focus: 'Complex combinations and deep opening understanding.',
      test: { themes: ['sacrifice', 'defence', 'quiet-move', 'zwischenzug', 'decoy', 'mating-attack', 'overload', 'remove-defender'], maxLevel: 4, count: 12, pass: 0.8, secs: 180, minLevel: 4, rating: [1850, 2150] },
      reqs: [
        { type: 'practice', wins: 1, level: 8 },
        { type: 'games', games: 10, blunders: 0.5 },
        { type: 'test' }
      ] }
  ];

  function byId(id) { return LIST.find(function (m) { return m.id === id; }) || null; }

  /** Puzzles a test may use (composed puzzles only — not positions from your own games). */
  function testPool(m) {
    var t = m.test;
    return CT.Data.puzzles.filter(function (p) {
      if (p.source === 'game' || t.themes.indexOf(p.theme) < 0) return false;
      if (p.source === 'lichess' && t.rating) return p.rating >= t.rating[0] && p.rating <= t.rating[1];
      return p.level <= t.maxLevel && p.level >= (t.minLevel || 1);
    });
  }
  function testAvailable(m) { return testPool(m).length >= m.test.count; }

  /** Pick test puzzles: prefer ones you have seen least, one per family where possible (twins are the same idea). */
  function buildTest(m) {
    var recs = CT.Store.state.puzzles, pool = testPool(m).slice();
    pool.sort(function (a, b) { return ((recs[a.id] || {}).attempts || 0) - ((recs[b.id] || {}).attempts || 0) || Math.random() - 0.5; });
    var out = [], fam = {};
    pool.forEach(function (p) { if (out.length < m.test.count && !fam[p.family || p.id]) { fam[p.family || p.id] = 1; out.push(p); } });
    pool.forEach(function (p) { if (out.length < m.test.count && out.indexOf(p) < 0) out.push(p); });
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = out[i]; out[i] = out[j]; out[j] = x; }
    return out;
  }

  /* ---------- requirement checks ---------- */
  function cleanWins(r) {
    return (CT.Store.state.practice || []).filter(function (g) {
      return g.result === 'win' && !g.takebacks && !(g.safety && g.safety.saves) && g.level >= r.level && g.engine !== 'builtin' && (!r.styles || r.styles.indexOf(g.style) >= 0);
    });
  }

  function check(m, r) {
    var Store = CT.Store, D = CT.Data, Coach = CT.Coach, STY = CT.Opponent ? CT.Opponent.STYLES : {};
    if (r.type === 'themes') {
      var st = Store.themeStats(D.themes);
      // A theme you tested out of (3 harder puzzles, one try, no hints) counts as shown.
      var parts = r.themes.map(function (k) { var s = st[k] || {}; return { k: k, ok: (s.attempts >= r.min && (s.recentAccuracy || 0) >= r.acc) || Store.isMastered(k), acc: s.recentAccuracy, n: s.attempts || 0 }; });
      return { ok: parts.every(function (p) { return p.ok; }), label: Math.round(r.acc * 100) + '%+ recent accuracy on ' + r.themes.map(function (k) { return D.themes[k].name.toLowerCase(); }).join(', ') + ' (at least ' + r.min + ' puzzles each)',
        have: parts.map(function (p) { return D.themes[p.k].name + ': ' + (Store.isMastered(p.k) ? 'tested out ✓' : p.n ? Math.round((p.acc || 0) * 100) + '% of ' + p.n : 'not tried'); }).join(' · '), href: '#/tactics/train/' + (parts.find(function (p) { return !p.ok; }) || parts[0]).k };
    }
    if (r.type === 'tier') {
      var ti = Coach.tierInfo();
      return { ok: ti.tier >= r.tier, label: 'Unlock tactics tier ' + r.tier, have: 'You are on tier ' + ti.tier, href: '#/tactics' };
    }
    if (r.type === 'openings') {
      var lines = D.openingLines.filter(function (l) { return !l.lessonOnly; });
      var n = lines.filter(function (l) { var k = Coach.openingStatus(l).key; return r.status === 'learned' ? k !== 'new' : k === 'mastered'; }).length;
      return { ok: n >= r.count, label: (r.status === 'learned' ? 'Learn ' : 'Master (spaced-repetition box 3+) ') + r.count + ' repertoire lines', have: n + ' of ' + r.count, href: '#/openings' };
    }
    if (r.type === 'threats') {
      var f = Object.keys(Store.state.lab || {}).filter(function (k) { return Store.state.lab[k].defended > 0; }).length;
      return { ok: f >= r.count, label: 'Find and defend ' + r.count + ' hidden threats (Deception Lab)', have: f + ' of ' + r.count, href: '#/lab/threats' };
    }
    if (r.type === 'practice') {
      var wins = cleanWins(r), styles = {};
      wins.forEach(function (g) { styles[g.style] = 1; });
      var distinctN = Object.keys(styles).length;
      var ok = wins.length >= r.wins && (!r.distinct || distinctN >= r.distinct);
      var who = r.styles ? r.styles.map(function (s) { return STY[s] ? STY[s].name : s; }).join(' or ') : r.distinct ? r.distinct + ' different opponents' : 'any opponent';
      return { ok: ok, label: 'Win ' + r.wins + ' practice game' + (r.wins > 1 ? 's' : '') + ' vs ' + who + ' at level ' + r.level + '+ (Stockfish opponent, no takebacks or safety-check take-backs)',
        have: wins.length + ' win' + (wins.length === 1 ? '' : 's') + (r.distinct ? ' vs ' + distinctN + ' style' + (distinctN === 1 ? '' : 's') : ''), href: '#/practice' };
    }
    if (r.type === 'games') {
      var p = CT.Games ? CT.Games.patterns(r.games) : { games: 0 };
      var okG = p.games >= r.games && p.blundersPerGame <= r.blunders;
      return { ok: okG, label: 'At most ' + r.blunders + ' blunders per game in your last ' + r.games + ' analysed games', have: p.games >= r.games ? (Math.round(p.blundersPerGame * 10) / 10) + ' blunders per game' : p.games + ' of ' + r.games + ' games analysed', href: '#/analysis' };
    }
    if (r.type === 'safety') {
      var sc = CT.Safety ? CT.Safety.score(r.games) : { games: 0, score: null };
      return { ok: sc.games >= r.games && sc.score >= r.score, label: 'Safety Score ' + Math.round(r.score * 100) + '%+ over ' + r.games + ' practice games with the safety check on',
        have: sc.games ? Math.round((sc.score || 0) * 100) + '% over ' + sc.games + ' game' + (sc.games > 1 ? 's' : '') : 'No games with the safety check yet', href: '#/practice' };
    }
    if (r.type === 'endgame') {
      var ed = CT.Endgame && CT.Endgame.get(r.drill), er = CT.Endgame && CT.Endgame.rec(r.drill);
      var eok = !!(er && er.passes && (!r.underMs || (er.bestMs && er.bestMs < r.underMs)));
      return { ok: eok, label: 'Endgame: ' + (ed ? ed.name : r.drill) + (r.underMs ? ' in under ' + Math.round(r.underMs / 1000) + ' seconds' : ''),
        have: !er ? 'Not tried' : !er.passes ? 'Not passed yet' : r.underMs ? 'Best ' + Math.round((er.bestMs || 0) / 1000) + 's' : 'Passed', href: '#/endgames/' + r.drill };
    }
    if (r.type === 'convert') {
      var cs = CT.Endgame ? CT.Endgame.convertStats() : { passes: 0, attempts: 0 };
      return { ok: cs.passes >= r.passes, label: 'Convert the Win ' + r.passes + ' times (win a won position, lead never below +2)', have: cs.passes + ' of ' + r.passes + ' (' + cs.attempts + ' tried)', href: '#/endgames' };
    }
    if (r.type === 'test') {
      var t = (Store.state.tests || {})[m.id] || null, avail = testAvailable(m);
      return { ok: !!(t && t.passed), label: 'Pass the ' + m.rating + ' skill test (' + m.test.count + ' puzzles, no hints, ' + m.test.secs + 's each, ' + Math.round(m.test.pass * 100) + '% to pass)',
        have: !avail ? 'Not available yet: the puzzle library does not have enough verified puzzles at this level' : t ? 'Best score ' + Math.round(t.best * 100) + '% (' + t.attempts + ' attempt' + (t.attempts > 1 ? 's' : '') + ')' : 'Not taken', href: avail ? '#/progress/test/' + m.id : null, unavailable: !avail };
    }
    return { ok: false, label: '?', have: '' };
  }

  /** Status of every milestone. A milestone is reached when all requirements hold and the previous one is reached. */
  function status() {
    var Store = CT.Store, reached = Store.state.milestones || (Store.state.milestones = {}), prevOk = true, changed = false;
    var out = LIST.map(function (m) {
      var checks = m.reqs.map(function (r) { return check(m, r); });
      var done = checks.filter(function (c) { return c.ok; }).length;
      var all = done === checks.length;
      if (all && prevOk && !reached[m.id]) { reached[m.id] = Date.now(); changed = true; }
      var isReached = !!reached[m.id];
      var res = { m: m, checks: checks, done: done, total: checks.length, reached: isReached, unlocked: prevOk };
      prevOk = isReached;
      return res;
    });
    if (changed) Store.save();
    var current = out.filter(function (s) { return s.reached; }).pop() || null;
    var next = out.find(function (s) { return !s.reached; }) || null;
    return { list: out, current: current, next: next };
  }

  CT.Milestones = { LIST: LIST, byId: byId, status: status, check: check, testPool: testPool, testAvailable: testAvailable, buildTest: buildTest };
})(typeof window !== 'undefined' ? window : globalThis);
