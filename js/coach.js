/*
 * coach.js — Decides what to train next and builds the daily plan.
 *  1. Spaced-repetition reviews that are due (missed ideas come back — preferably in a mirrored twin
 *     position, so you prove you understand the idea rather than remembering one board).
 *  2. Themes you recently got wrong: another, different position from that theme.
 *  3. New puzzles from your weakest themes, at the highest level you have unlocked.
 * Tiers unlock by performance (accuracy on your current tier), never by puzzle count alone.
 */
(function (root) {
  'use strict';
  var CT = root.CT, Store = CT.Store, D = CT.Data;
  var UNLOCK_ACC = 0.7, UNLOCK_MIN = 8;
  var CHECKIN_GAP = 10 * 86400000; // a theme you tested out of comes back once every ~10 days as a check-in
  var TESTOUT = { count: 3, secs: 120, pass: 1 };

  function puzzleById(id) { return D.puzzles.find(function (p) { return p.id === id; }); }
  function lineById(id) { return D.openingLines.find(function (l) { return l.id === id; }) || (D.traps || []).find(function (l) { return l.id === id; }); }

  /** Worked example for a theme: the mirrored twin of its first mirrorable puzzle (kept out of training). */
  var examples = null;
  function exampleFor(theme) {
    if (!examples) {
      examples = {};
      D.puzzles.forEach(function (p) { if (p.twin && !examples[p.theme]) examples[p.theme] = p; });
    }
    return examples[theme] || null;
  }
  function isExample(p) { return exampleFor(p.theme) === p; }
  function twinOf(p) {
    var t = D.puzzles.find(function (x) { return x !== p && x.family === p.family; });
    return t && !isExample(t) ? t : null;
  }

  function tierInfo() {
    var tier = 1, last = { n: 0, acc: 0 };
    for (var t = 1; t <= 3; t++) {
      var events = Store.state.log.filter(function (e) {
        if (e.kind !== 'puzzle') return false;
        var p = puzzleById(e.id); return p && p.level === t;
      }).slice(-12);
      var acc = events.length ? events.filter(function (e) { return e.ok; }).length / events.length : 0;
      last = { n: events.length, acc: acc };
      if (events.length >= UNLOCK_MIN && acc >= UNLOCK_ACC) tier = t + 1; else break;
    }
    return {
      tier: tier, recentAtTier: last.n, accuracyAtTier: last.acc,
      recentTier1: last.n, tier1Accuracy: last.acc,
      need: tier < 4 ? 'Unlock tier ' + (tier + 1) + ' with 70%+ first-try accuracy over at least 8 recent tier-' + tier + ' puzzles.' : ''
    };
  }

  /* ---------- Test out of a theme ----------
   * 3 harder puzzles from the theme, one try each, no hints, 2 minutes each. Pass all 3 and the theme is "mastered":
   * it stops appearing in the Daily Mix except for a check-in about every 10 days. Miss a check-in and it comes back.
   * Mistakes in your own games still override this — if your games show the theme, you get it anyway. */
  function gamePressure(theme) { return CT.Games ? (CT.Games.themePressure()[theme] || 0) : 0; }
  function lastAttemptAt(theme) {
    for (var i = Store.state.log.length - 1; i >= 0; i--) { var e = Store.state.log[i]; if (e.kind === 'puzzle' && e.theme === theme) return e.t; }
    return 0;
  }
  function masteredInfo(theme) {
    var m = (Store.state.mastered || {})[theme];
    if (!m) return null;
    var last = Math.max(m.at || 0, lastAttemptAt(theme));
    return { at: m.at, checkins: m.checkins || 0, nextCheckin: last + CHECKIN_GAP, checkinDue: Date.now() - last >= CHECKIN_GAP, fromGames: gamePressure(theme) };
  }
  /** Themes kept out of normal training (tested out and not showing up in your games). They return only as check-ins. */
  function restingThemes() {
    var out = {};
    Object.keys(Store.state.mastered || {}).forEach(function (k) { if (!gamePressure(k)) out[k] = true; });
    return out;
  }
  function testOutPool(theme) {
    return D.puzzles.filter(function (p) { return p.theme === theme && !p.woodpecker && p.source !== 'game' && !isExample(p); });
  }
  function testOutAvailable(theme) { return testOutPool(theme).length >= TESTOUT.count; }
  /** Unseen puzzles first, then the ones a bit above your puzzle rating (about +250), one per mirrored family. */
  function buildTestOut(theme, rand) {
    rand = rand || Math.random;
    var R = Store.puzzleRating(), recs = Store.state.puzzles, target = R + 250;
    var pool = testOutPool(theme).map(function (p) {
      var r = Store.puzzleRatingOf(p), seen = (recs[p.id] || {}).attempts || 0;
      var hard = r >= R + 50 ? Math.abs(r - target) : 2000 + (R + 50 - r);
      return { p: p, k: seen * 100000 + hard + rand() * 40 };
    }).sort(function (a, b) { return a.k - b.k; });
    var out = [], fam = {};
    pool.forEach(function (x) { if (out.length < TESTOUT.count && !fam[x.p.family || x.p.id]) { fam[x.p.family || x.p.id] = 1; out.push(x.p); } });
    pool.forEach(function (x) { if (out.length < TESTOUT.count && out.indexOf(x.p) < 0) out.push(x.p); });
    return out;
  }

  function weakestThemes() {
    var stats = Store.themeStats(D.themes);
    // Themes linked to mistakes in your real games get extra priority.
    var pressure = CT.Games ? CT.Games.themePressure() : {};
    return Object.keys(D.themes).map(function (k) {
      var s = stats[k];
      var acc = s.recentAccuracy == null ? 0.55 : s.recentAccuracy;
      acc -= Math.min(0.4, 0.08 * (pressure[k] || 0));
      if (Store.isMastered(k) && !(pressure[k] > 0)) acc += 1; // tested out: last in line
      return { theme: k, name: D.themes[k].name, attempts: s.attempts, accuracy: s.recentAccuracy, score: acc, fromGames: pressure[k] || 0, mastered: Store.isMastered(k) };
    }).sort(function (a, b) { return a.score - b.score || a.attempts - b.attempts; });
  }

  function nextPuzzle(opts) {
    opts = opts || {};
    var now = Date.now(), tier = tierInfo().tier, recs = Store.state.puzzles;
    var R = Store.puzzleRating(), resting = restingThemes();
    var pool = D.puzzles.filter(function (p) {
      if (p.id === opts.exclude || isExample(p)) return false;
      if (p.woodpecker) return false; // the Woodpecker set is trained in its own cycles
      if (opts.theme) return p.theme === opts.theme;
      if (resting[p.theme]) return false; // tested out: only check-ins (below)
      if (p.source === 'lichess') return true; // chosen by rating below
      return p.level <= tier || p.source === 'game';
    });
    if (!pool.length) return null;
    var lastFamily = opts.exclude ? (puzzleById(opts.exclude) || {}).family : null;

    // Warm-up (Play days): easy, unlabelled puzzles well below your rating, so you start the game sharp but relaxed.
    if (opts.warmup) {
      var easy = pool.filter(function (p) { return p.source === 'lichess' && !recs[p.id] && p.family !== lastFamily; });
      var lo = Math.max(400, R - 450), hi = Math.max(650, R - 150);
      var band = easy.filter(function (p) { return p.rating >= lo && p.rating <= hi; });
      if (!band.length) band = easy.filter(function (p) { return p.rating <= R; });
      if (band.length) return { puzzle: band[Math.floor(Math.random() * band.length)], reason: 'Warm-up — easier puzzles to get your eye in before you play.', mix: true };
    }

    // 1. Due reviews. If you missed a puzzle and its twin is fresh, test the idea in the twin instead.
    var due = pool.filter(function (p) { var r = recs[p.id]; return r && r.due <= now && r.box < 5 && p.family !== lastFamily; })
      .sort(function (a, b) { return recs[a.id].box - recs[b.id].box || recs[a.id].due - recs[b.id].due; });
    if (due.length) {
      var d = due[0], tw = twinOf(d);
      if (recs[d.id].box === 0 && tw && !recs[tw.id] && pool.indexOf(tw) >= 0) return { puzzle: tw, reason: 'Review: you missed this idea before — same pattern, new position.' };
      return { puzzle: d, reason: recs[d.id].box === 0 ? 'Review: you missed this one before.' : 'Spaced review — keeping it fresh.' };
    }
    // 2. A theme you just got wrong: another position from it.
    if (!opts.theme) {
      var recentMiss = Store.state.log.slice(-6).reverse().find(function (e) { return e.kind === 'puzzle' && !e.ok; });
      if (recentMiss && D.themes[recentMiss.theme]) {
        var again = pool.filter(function (p) { return p.theme === recentMiss.theme && !recs[p.id] && p.family !== lastFamily; });
        if (again.length) return { puzzle: again[0], reason: 'Same theme as a recent miss (' + D.themes[recentMiss.theme].name + '), different position.' };
      }
    }
    // 3. Your own games come first: positions where you actually went wrong.
    var own = pool.filter(function (p) { return p.source === 'game' && !recs[p.id]; });
    if (own.length) return { puzzle: own[0], reason: 'From your own game — find the move you missed.' };
    // 3b. Check-in on a theme you tested out of (about every 10 days): one fresh puzzle a bit above your rating.
    if (!opts.theme) {
      var dueTheme = Object.keys(Store.state.mastered || {}).find(function (k) { var m = masteredInfo(k); return m && m.checkinDue && !m.fromGames; });
      if (dueTheme) {
        var ci = testOutPool(dueTheme).filter(function (p) { return p.id !== opts.exclude && p.family !== lastFamily; })
          .sort(function (a, b) { return (recs[a.id] ? 1 : 0) - (recs[b.id] ? 1 : 0) || Math.abs(Store.puzzleRatingOf(a) - R - 100) - Math.abs(Store.puzzleRatingOf(b) - R - 100); });
        if (ci.length) return { puzzle: ci[0], reason: 'Check-in on a theme you tested out of (revealed after you solve it). Miss it and the theme comes back into training.', mix: true, checkin: true };
      }
    }
    // 4. Daily Mix (no theme chosen): unlabelled puzzles near your puzzle rating, like real games.
    //    About 2 in 5 are aimed at your costliest weakness; the theme is revealed only after you solve it.
    if (!opts.theme) {
      var mixed = mixPick(pool, recs, R, lastFamily);
      if (mixed) return mixed;
    }
    // 5. New puzzles from your weakest themes. Strong themes get harder puzzles first.
    var order = weakestThemes();
    var rank = order.map(function (w) { return w.theme; });
    var strong = {}; order.forEach(function (w) { strong[w.theme] = w.accuracy != null && w.accuracy >= 0.8; });
    var fresh = pool.filter(function (p) { return !recs[p.id] && p.family !== lastFamily; })
      .sort(function (a, b) {
        return (b.source === 'game' ? 1 : 0) - (a.source === 'game' ? 1 : 0) || rank.indexOf(a.theme) - rank.indexOf(b.theme) ||
          // in a theme: hand-written lessons first, then Lichess puzzles closest to your puzzle rating
          (a.source === 'lichess' ? 1 : 0) - (b.source === 'lichess' ? 1 : 0) ||
          (a.source === 'lichess' && b.source === 'lichess' ? Math.abs(a.rating - R - 50) - Math.abs(b.rating - R - 50) : 0) ||
          (strong[a.theme] ? b.level - a.level : a.level - b.level) || (a.twin ? 1 : 0) - (b.twin ? 1 : 0);
      });
    if (fresh.length) {
      var w = order.find(function (x) { return x.theme === fresh[0].theme; });
      var why = fresh[0].source === 'game' ? 'From your own game — find the move you missed.' : w && w.fromGames ? 'Priority from your games: ' + w.name + '.' : w && w.accuracy != null && w.accuracy < 0.7 ? 'Weak area: ' + w.name + '.' : 'New puzzle: ' + D.themes[fresh[0].theme].name + '.';
      return { puzzle: fresh[0], reason: why };
    }
    var shaky = pool.filter(function (p) { return recs[p.id] && recs[p.id].box < Store.MASTERED_BOX; })
      .sort(function (a, b) { return recs[a.id].box - recs[b.id].box; });
    if (shaky.length && opts.allowEarly) return { puzzle: shaky[0], reason: 'Extra practice (not due yet).' };
    return null;
  }

  /** Daily Mix choice. Pure apart from Math.random (tests pass their own pool). */
  function mixPick(pool, recs, R, lastFamily, rand) {
    rand = rand || Math.random;
    var n = Store.state.mixN = (Store.state.mixN || 0) + 1;
    var fresh = pool.filter(function (p) { return !recs[p.id] && p.family !== lastFamily && p.source !== 'game'; });
    function win(lo, hi) { return fresh.filter(function (p) { var r = Store.puzzleRatingOf(p); return r >= R + lo && r <= R + hi; }); }
    function any(list) { return list[Math.floor(rand() * list.length)]; }
    if (n % 5 === 1 || n % 5 === 3) {
      var weak = weakestThemes().filter(function (w) { return w.theme !== 'game' && (w.fromGames > 0 || (w.attempts >= 3 && w.accuracy != null && w.accuracy < 0.7)); });
      for (var i = 0; i < Math.min(2, weak.length); i++) {
        var c = win(-250, 150).filter(function (p) { return p.theme === weak[i].theme; });
        if (c.length) return { puzzle: any(c), reason: 'Daily Mix — aimed at one of your weak spots (revealed after you solve it).', mix: true, target: weak[i].theme };
      }
    }
    var tries = [[-150, 150], [-300, 250], [-600, 400], [-3000, 3000]];
    for (var t = 0; t < tries.length; t++) {
      var c2 = win(tries[t][0], tries[t][1]);
      if (c2.length) return { puzzle: any(c2), reason: 'Daily Mix — no theme shown, just like a real game.', mix: true };
    }
    return null;
  }

  /* ---------- Woodpecker cycles: one fixed set of easy puzzles, solved again and again, faster each time ---------- */
  function woodpecker() {
    var set = CT.Pack ? CT.Pack.woodpeckerSet() : [];
    var w = Store.state.woodpecker || (Store.state.woodpecker = { cycle: 1, startedAt: null, done: {}, history: [] });
    var solved = set.filter(function (p) { return w.done[p.id]; });
    var correct = solved.filter(function (p) { return w.done[p.id].ok; }).length;
    var ms = solved.reduce(function (a, p) { return a + (w.done[p.id].ms || 0); }, 0);
    var prev = w.history[w.history.length - 1] || null;
    var lastFinished = prev ? prev.finishedAt : null;
    var restDay = lastFinished && !solved.length && Date.now() - lastFinished < 20 * 3600 * 1000;
    return {
      set: set, cycle: w.cycle, solved: solved.length, total: set.length, correct: correct, ms: ms, history: w.history, prev: prev,
      targetMs: prev ? Math.round(prev.ms / 2) : null, restDay: restDay,
      next: set.find(function (p) { return !w.done[p.id]; }) || null
    };
  }
  function recordWoodpecker(p, ok, ms) {
    var w = Store.state.woodpecker || (Store.state.woodpecker = { cycle: 1, startedAt: null, done: {}, history: [] });
    if (w.done[p.id]) return;
    if (!w.startedAt) w.startedAt = Date.now();
    w.done[p.id] = { ok: !!ok, ms: Math.min(ms || 0, 10 * 60 * 1000) };
    Store.bumpDay('wp');
    var info = woodpecker();
    if (info.solved >= info.total && info.total) {
      w.history.push({ cycle: w.cycle, accuracy: info.correct / info.total, ms: info.ms, finishedAt: Date.now(), startedAt: w.startedAt });
      w.cycle++; w.done = {}; w.startedAt = null;
    }
    Store.save();
  }

  function openingStatus(line) {
    var r = Store.state.openings[line.id];
    if (!r || !r.learned) return { key: 'new', label: 'New' };
    if (line.lessonOnly) return { key: 'mastered', label: 'Studied' };
    if (r.box >= Store.MASTERED_BOX && r.due > Date.now()) return { key: 'mastered', label: 'Mastered' };
    if (r.due <= Date.now()) return { key: 'due', label: 'Drill due' };
    return { key: 'learning', label: 'Learning' };
  }

  function nextOpening() {
    var lines = D.openingLines.filter(function (l) { return !l.lessonOnly; });
    var due = lines.filter(function (l) { return openingStatus(l).key === 'due'; });
    if (due.length) return { line: due[0], mode: 'drill' };
    var fresh = lines.filter(function (l) { return openingStatus(l).key === 'new'; });
    if (fresh.length) return { line: fresh[0], mode: 'learn' };
    return null;
  }

  function nextLab() {
    var seen = Store.state.lab || {};
    var t = (D.threats || []).find(function (h) { return !seen[h.id]; });
    if (t) return { href: '#/lab/threats', label: 'Hidden threat: ' + t.title };
    var tr = (D.traps || []).find(function (x) { return !(Store.state.openings[x.id] && Store.state.openings[x.id].learned); });
    if (tr) return { href: '#/lab/trap/' + tr.id, label: 'Trap: ' + tr.name };
    return { href: '#/lab', label: 'Review the trap library' };
  }

  /* ---------- practice games ---------- */
  function practiceStats() {
    var out = {};
    (Store.state.practice || []).forEach(function (g) {
      var s = out[g.style] = out[g.style] || { games: 0, w: 0, l: 0, d: 0, best: 0, recent: [] };
      s.games++; s[g.result === 'win' ? 'w' : g.result === 'loss' ? 'l' : 'd']++;
      if (g.result === 'win' && !g.takebacks) s.best = Math.max(s.best, g.level);
      s.recent.push(g);
    });
    return out;
  }

  /** Suggested level vs a style: start from your rating; two clean wins in a row → up, two losses → down. */
  function suggestedLevel(style) {
    var O = CT.Opponent, base = O.levelFor(Store.state.profile.rating);
    var games = (Store.state.practice || []).filter(function (g) { return g.style === style && !g.takebacks; });
    if (!games.length) {
      // Use results against other styles if any.
      var any = (Store.state.practice || []).filter(function (g) { return !g.takebacks; });
      if (!any.length) return base;
      return Math.max(1, Math.min(8, any[any.length - 1].level - (style === 'solid' || style === 'tactical' ? 1 : 0)));
    }
    var last = games[games.length - 1], lvl = last.level;
    var atLvl = games.filter(function (g) { return g.level === lvl; }).slice(-2);
    if (atLvl.length === 2 && atLvl.every(function (g) { return g.result === 'win'; })) lvl++;
    else if (atLvl.length === 2 && atLvl.every(function (g) { return g.result === 'loss'; })) lvl--;
    return Math.max(1, Math.min(8, lvl));
  }

  /** Which opponent should you play next, and why? Driven by your actual mistakes. */
  function practicePick() {
    var O = CT.Opponent, recent = (Store.state.practice || []).slice(-6);
    var pat = CT.Games ? CT.Games.patterns(10) : { insights: [] };
    var keys = pat.insights.map(function (i) { return i.key; });
    var fell = recent.reduce(function (n, g) { return n + (g.trapsFell || 0); }, 0);
    var missed = recent.reduce(function (n, g) { return n + (g.slipsMissed || 0); }, 0);
    var tactical = ['fork', 'double', 'hanging', 'pin', 'skewer', 'discovered'].some(function (k) { return keys.indexOf(k) >= 0; });
    var pick;
    if (fell >= 2) pick = { style: 'trapper', reason: 'You fell for ' + fell + ' traps in your recent practice games. Learn to ask "why did they allow this?" before grabbing material.' };
    else if (keys.indexOf('threats') >= 0 || tactical) pick = { style: 'tactical', reason: 'Your analysed games show missed threats or tactics. The Tactical Player punishes loose pieces — blunder-check every move.' };
    else if (missed >= 3) pick = { style: 'beginner', reason: 'You let ' + missed + ' opponent mistakes go unpunished recently. Practise spotting and taking free material.' };
    else if (keys.indexOf('conversion') >= 0) pick = { style: 'defensive', reason: 'You reached winning positions but did not win. Practise converting against a stubborn defender.' };
    else {
      var st = practiceStats();
      var style = ['trapper', 'beginner', 'aggressive', 'tactical', 'defensive', 'positional', 'solid'].sort(function (a, b) { return ((st[a] || {}).games || 0) - ((st[b] || {}).games || 0); })[0];
      pick = { style: style, reason: 'Variety: you have played ' + ((st[style] || {}).games || 0) + ' games against ' + O.STYLES[style].name + '. Each style trains a different skill.' };
    }
    pick.level = suggestedLevel(pick.style);
    return pick;
  }

  /* ---------- Daily plan: alternating Play days and Study days ----------
   * Play day:  short easy warm-up → one rapid game (15+10, Safety check on) → review that game.
   * Study day: Woodpecker set → Daily Mix → endgame technique → traps in your own openings → hidden-threat / lab work.
   * Opening study is kept to roughly 10–15% of the time — at 400–1000, tactics, safety and endgames win more games.
   */
  function dayType() {
    var k = Store.dayKey(), o = Store.state.dayType;
    if (o && o.date === k) return o.type;
    // Alternate by calendar day; if yesterday had no game, today is a Play day so games never stop.
    var y = Store.state.days[Store.dayKey(Date.now() - 86400000)] || {};
    var n = Math.floor(new Date(k + 'T12:00:00').getTime() / 86400000);
    var type = n % 2 ? 'play' : 'study';
    if (type === 'study' && !(y.games) && !(Store.state.days[k] || {}).games) {
      var y2 = Store.state.days[Store.dayKey(Date.now() - 2 * 86400000)] || {};
      if (!y2.games && (Store.state.practice || []).length) type = 'play';
    }
    return type;
  }
  function setDayType(type) { Store.state.dayType = { date: Store.dayKey(), type: type }; Store.save(); }

  function dailyPlan() {
    var mins = Store.state.profile.sessionMinutes || 45;
    var size = mins <= 30 ? 0 : mins <= 45 ? 1 : 2;
    var d = Store.today();
    var resting = restingThemes();
    var reviewsDue = D.puzzles.filter(function (p) { var r = Store.state.puzzles[p.id]; return r && r.due <= Date.now() && !resting[p.theme]; }).length;
    var openingsDue = D.openingLines.filter(function (l) { return openingStatus(l).key === 'due'; }).length;
    var type = dayType();
    var wp = CT.Pack ? woodpecker() : null;
    var openingsDone = (d.drills || 0) + Math.floor((d.quiz || 0) / 4) + (d.trapDrills || 0);
    var nextOp = nextOpening();
    var pick = CT.Opponent ? practicePick() : null;
    var items = [];
    var mixDone = Math.max(0, (d.puzzles || 0) - (d.wp || 0) - (d.warmup || 0));

    if (type === 'play') {
      var warm = [5, 8, 10][size];
      items.push({ key: 'warmup', icon: '☀', title: 'Warm-up', sub: (d.warmup || 0) + ' / ' + warm + ' easy puzzles — get your eye in', target: warm, done: d.warmup || 0, href: '#/tactics/warmup', cta: 'Start', mins: [5, 7, 8][size] });
      items.push({ key: 'game', icon: '♟', title: 'Rapid game (15+10)', sub: pick ? 'vs ' + CT.Opponent.STYLES[pick.style].name + ', level ' + pick.level + ' — Safety check on' : 'Safety check on', target: 1, done: d.games || 0, href: '#/practice', cta: 'Play', mins: 30 });
      items.push({ key: 'review', icon: '⌕', title: 'Review the game', sub: 'Engine review + coaching report — your mistakes become tomorrow\'s puzzles', target: 1, done: Math.min(d.reviews || 0, d.games || 0), href: '#/analysis/games', cta: 'Review', mins: [5, 8, 10][size], needs: 'game' });
      if (size === 2) items.push({ key: 'openings', icon: '♘', title: 'Opening refresh', sub: nextOp ? 'next: ' + nextOp.line.name : 'quiz on your repertoire', target: 1, done: openingsDone, href: nextOp ? '#/openings/' + nextOp.line.id + '/' + nextOp.mode : '#/openings/quiz/all', cta: 'Go', mins: 7 });
    } else {
      if (wp && wp.total && !wp.restDay) {
        var wpT = [8, 12, 15][size];
        items.push({ key: 'woodpecker', icon: '⟳', title: 'Woodpecker set', sub: 'Cycle ' + wp.cycle + ' · ' + wp.solved + ' / ' + wp.total + (wp.targetMs ? ' · goal: twice as fast as last cycle' : ' · same puzzles, faster each cycle'), target: wpT, done: d.wp || 0, href: '#/tactics/woodpecker/go', cta: (d.wp ? 'Continue' : 'Start'), mins: [8, 10, 12][size] });
      }
      var mixT = [8, 10, 14][size] + (wp && wp.restDay ? 5 : 0);
      items.push({ key: 'mix', icon: '⚔', title: 'Daily Mix', sub: mixDone + ' / ' + mixT + ' puzzles — no theme shown, like a real game' + (reviewsDue ? ' · ' + reviewsDue + ' review' + (reviewsDue > 1 ? 's' : '') + ' due' : ''), target: mixT, done: mixDone, href: '#/tactics/train', cta: mixDone ? 'Continue' : 'Start', mins: [10, 15, 18][size] });
      if (CT.Endgame) {
        var eg = CT.Endgame.next();
        items.push({ key: 'endgame', icon: '♚', title: 'Endgame technique', sub: eg ? eg.label : 'Review your endgame drills', target: [1, 2, 3][size], done: d.endgames || 0, href: eg ? eg.href : '#/endgames', cta: 'Go', mins: [5, 10, 12][size] });
      }
      var trapNext = CT.TrapDrills ? CT.TrapDrills.next() : null;
      items.push(trapNext ?
        { key: 'traps', icon: '⚑', title: 'Traps in your openings', sub: trapNext.label, target: [1, 2, 2][size], done: (d.trapDrills || 0) + (d.drills || 0), href: trapNext.href, cta: 'Go', mins: [5, 7, 8][size] } :
        { key: 'openings', icon: '♘', title: 'Openings', sub: nextOp ? 'next: ' + nextOp.line.name : 'quiz on your repertoire', target: 1, done: openingsDone, href: nextOp ? '#/openings/' + nextOp.line.id + '/' + nextOp.mode : '#/openings/quiz/all', cta: 'Go', mins: [5, 7, 8][size] });
      if (size >= 1) { var lab = nextLab(); items.push({ key: 'lab', icon: '◈', title: 'Deception Lab', sub: lab.label, target: 1, done: d.lab || 0, href: lab.href, cta: 'Open', mins: 5 }); }
    }

    return {
      minutes: mins, type: type, items: items,
      // Older fields, still used elsewhere.
      tactics: { target: type === 'play' ? 0 : (items.filter(function (i) { return i.key === 'mix'; })[0] || { target: 0 }).target, done: d.puzzles, correct: d.correct },
      openings: { target: 1, done: openingsDone },
      lab: { target: 1, done: d.lab || 0, next: nextLab() },
      reviewsDue: reviewsDue, openingsDue: openingsDue,
      weakest: weakestThemes().filter(function (w) { return w.attempts > 0; }).slice(0, 3),
      nextOpening: nextOp,
      practice: { target: type === 'play' ? 1 : 0, done: d.games || 0, pick: pick },
      woodpecker: wp
    };
  }

  CT.Coach = {
    tierInfo: tierInfo, weakestThemes: weakestThemes, nextPuzzle: nextPuzzle,
    openingStatus: openingStatus, nextOpening: nextOpening, dailyPlan: dailyPlan, dayType: dayType, setDayType: setDayType, nextLab: nextLab,
    practiceStats: practiceStats, mixPick: mixPick, woodpecker: woodpecker, recordWoodpecker: recordWoodpecker, suggestedLevel: suggestedLevel, practicePick: practicePick,
    puzzleById: puzzleById, lineById: lineById, exampleFor: exampleFor, twinOf: twinOf, isExample: isExample,
    masteredInfo: masteredInfo, restingThemes: restingThemes, testOutPool: testOutPool, testOutAvailable: testOutAvailable, buildTestOut: buildTestOut, TESTOUT: TESTOUT, CHECKIN_GAP: CHECKIN_GAP,
    TIER_UNLOCK: { accuracy: UNLOCK_ACC, min: UNLOCK_MIN }
  };
})(window);
