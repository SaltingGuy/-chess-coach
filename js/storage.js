/*
 * storage.js — Saves training progress in the browser (localStorage) so it survives refreshes.
 * Also implements spaced repetition (Leitner boxes) and the statistics used by the coach.
 */
(function (root) {
  'use strict';
  var KEY = 'chess-trainer.v1';
  var DAY = 86400000;
  // Review interval for each box. Box 0 = "got it wrong": comes back after 10 minutes.
  var INTERVALS = [10 * 60000, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
  var MASTERED_BOX = 3;

  function blank() {
    return {
      version: 1,
      createdAt: Date.now(),
      profile: { rating: 450, sessionMinutes: 45, sound: true, squareNames: false, autoArrows: true, voice: true, voiceRate: 1 },
      puzzles: {},   // id -> {attempts, firstTryOk, fails, box, due, lastAt, lastOk}
      openings: {},  // lineId -> {learned, drills, clean, box, due, lastAt, mistakes:{ply:n}}
      quiz: {},      // 'lineId:ply' -> {attempts, ok, box, due, lastAt}
      lab: {},       // hidden-threat id -> {attempts, found, defended, lastAt}
      practice: [],  // finished games vs computer opponents: {t, style, level, color, result, plies, gameId, takebacks, ...}
      practiceCurrent: null, // the game in progress (so a refresh does not lose it)
      tests: {},     // milestone id -> {attempts, passed, best, lastAt, lastScore}
      milestones: {}, // milestone id -> time reached (once reached, it stays reached)
      mastered: {},  // theme -> {at, checkins} — you tested out of it; it only comes back as an occasional check-in
      testouts: {},  // theme -> {attempts, passed, lastAt, lastScore}
      danger: {},    // back-rank danger position id -> {attempts, ok, box, due, lastAt, lastOk}
      session: null, // today's guided session (see js/session.js)
      experiments: { active: null, history: [], n: 0 }, // the Coach's Lab (js/experiments.js)
      think: { games: {}, reasons: {}, transfer: [] },    // Think-First replay (js/views/think.js)
      ccSync: {},    // chess.com auto-sync: {user, lastAt, lastEndTime, lastAdded, lastError, newIds}
      log: [],       // recent events: {t, kind, id, ok, theme?, ms?, hint?}
      days: {}       // 'YYYY-MM-DD' -> {puzzles, correct, drills, cleanDrills, quiz, quizOk}
    };
  }

  var memoryOnly = false;
  var state = load();

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return blank();
      var s = JSON.parse(raw);
      return migrate(s);
    } catch (e) {
      memoryOnly = true;
      return blank();
    }
  }

  function migrate(s) {
    var b = blank();
    if (!s || typeof s !== 'object') return b;
    Object.keys(b).forEach(function (k) { if (s[k] === undefined) s[k] = b[k]; });
    s.profile = Object.assign(b.profile, s.profile);
    return s;
  }

  function save() {
    if (state.log.length > 3000) state.log = state.log.slice(-3000);
    // A running guided session checks after every save whether its current block is done.
    if (root.CT && root.CT.Session) { try { root.CT.Session.tick(); } catch (e) { /* never block saving */ } }
    state.savedAt = Date.now();
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); memoryOnly = false; return true; }
    catch (e) { memoryOnly = true; return false; }
  }

  function dayKey(t) {
    var d = new Date(t || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() {
    var k = dayKey();
    if (!state.days[k]) state.days[k] = { puzzles: 0, correct: 0, drills: 0, cleanDrills: 0 };
    var d = state.days[k];
    if (d.quiz === undefined) { d.quiz = 0; d.quizOk = 0; }
    return d;
  }

  /** Add n to one of today's counters (warmup, wp, reviews, endgames, trapDrills, …). */
  function bumpDay(key, n) { var d = today(); d[key] = (d[key] || 0) + (n == null ? 1 : n); save(); return d[key]; }

  function schedule(rec, ok, partial) {
    if (ok && !partial) rec.box = Math.min((rec.box || 0) + 1, INTERVALS.length - 1);
    else if (ok && partial) rec.box = Math.max(1, Math.min(rec.box || 0, 1));
    else rec.box = 0;
    rec.due = Date.now() + INTERVALS[rec.box];
  }

  /** Record a finished puzzle. ok = solved on the first try without hints. */
  /* Your puzzle rating (Elo-style), updated only on the FIRST attempt at a new position. A mirrored twin of a
     puzzle you have already seen counts as a repeat, so it does not change the rating. */
  function puzzleRatingOf(p) { return p.rating || ({ 1: 800, 2: 1100, 3: 1400, 4: 1700 })[p.level] || 1000; }
  function updatePuzzleRating(p, ok) {
    if (p.source === 'game') return;
    var seenFamily = p.family && Object.keys(state.puzzles).some(function (id) { var q = root.CT.Data && root.CT.Data.puzzles && root.CT.Coach && root.CT.Coach.puzzleById(id); return q && q !== p && q.family === p.family; });
    if (seenFamily) return;
    var pr = state.puzzleRating || (state.puzzleRating = { r: 800, n: 0 });
    var exp = 1 / (1 + Math.pow(10, (puzzleRatingOf(p) - pr.r) / 400));
    var k = pr.n < 20 ? 48 : pr.n < 60 ? 32 : 20;
    pr.r = Math.round(Math.max(400, Math.min(2600, pr.r + k * ((ok ? 1 : 0) - exp))));
    pr.n++;
  }

  function recordPuzzle(p, result) {
    var rec = state.puzzles[p.id] || { attempts: 0, firstTryOk: 0, fails: 0, box: 0, due: 0 };
    if (!rec.attempts && !result.woodpecker) updatePuzzleRating(p, !!result.ok);
    rec.attempts++;
    if (result.ok) rec.firstTryOk++; else rec.fails++;
    rec.lastOk = !!result.ok; rec.lastAt = Date.now();
    if (result.ms && result.ok) rec.bestMs = Math.min(rec.bestMs || Infinity, result.ms);
    // Right first time -> next box (seen less often). Wrong, hint or gave up -> back to box 0 (seen again soon).
    schedule(rec, !!result.ok, false);
    state.puzzles[p.id] = rec;
    state.log.push({ t: Date.now(), kind: 'puzzle', id: p.id, theme: p.theme, ok: !!result.ok, ms: result.ms || 0, hint: !!result.usedHint });
    if (root.CT.Think) root.CT.Think.markTransfer(p.id); // a "same idea, new position" card was answered
    // A missed check-in on a theme you tested out of puts the theme back into normal training.
    if (!result.ok && result.checkin && state.mastered[p.theme]) {
      delete state.mastered[p.theme];
      state.log.push({ t: Date.now(), kind: 'unmastered', id: p.theme, ok: false });
      rec.unmastered = p.theme;
    } else if (result.ok && result.checkin && state.mastered[p.theme]) state.mastered[p.theme].checkins = (state.mastered[p.theme].checkins || 0) + 1;
    var d = today(); d.puzzles++; if (result.ok) d.correct++;
    save();
    return rec;
  }

  function markLearned(lineId) {
    var rec = state.openings[lineId] || { drills: 0, clean: 0, box: 0, due: 0, mistakes: {} };
    if (!rec.learned) { rec.learned = true; rec.due = Date.now(); }
    rec.lastAt = Date.now();
    state.openings[lineId] = rec;
    save();
  }

  /** Record an opening drill. mistakes = array of ply indexes where the learner went wrong. */
  function recordDrill(line, mistakes) {
    var rec = state.openings[line.id] || { drills: 0, clean: 0, box: 0, due: 0, mistakes: {} };
    rec.learned = true;
    rec.drills++;
    var clean = mistakes.length === 0;
    if (clean) rec.clean++;
    mistakes.forEach(function (ply) { rec.mistakes[ply] = (rec.mistakes[ply] || 0) + 1; });
    schedule(rec, clean, false);
    rec.lastAt = Date.now();
    state.openings[line.id] = rec;
    state.log.push({ t: Date.now(), kind: 'opening', id: line.id, ok: clean, errors: mistakes.length });
    var d = today(); d.drills++; if (clean) d.cleanDrills++;
    save();
    return rec;
  }

  /** Record an opening quiz answer (first answer only). */
  function recordQuiz(item, ok) {
    var rec = state.quiz[item.key] || { attempts: 0, ok: 0, box: 0, due: 0 };
    rec.attempts++; if (ok) rec.ok++;
    schedule(rec, ok, false);
    rec.lastAt = Date.now();
    state.quiz[item.key] = rec;
    state.log.push({ t: Date.now(), kind: 'quiz', id: item.lineId, ply: item.ply, ok: !!ok });
    var d = today(); d.quiz++; if (ok) d.quizOk++;
    save();
    return rec;
  }

  /** Record a hidden-threat exercise: did you spot the threat, and did you defend correctly? */
  function recordLab(id, found, defended) {
    var rec = state.lab[id] || { attempts: 0, found: 0, defended: 0 };
    rec.attempts++; if (found) rec.found++; if (defended) rec.defended++;
    rec.lastAt = Date.now();
    state.lab[id] = rec;
    state.log.push({ t: Date.now(), kind: 'threat', id: id, ok: !!(found && defended) });
    var d = today(); d.lab = (d.lab || 0) + 1;
    save();
  }

  /** Record a finished practice game against a computer opponent. */
  function recordPractice(entry) {
    entry.t = entry.t || Date.now();
    state.practice.push(entry);
    if (state.practice.length > 500) state.practice = state.practice.slice(-500);
    state.log.push({ t: entry.t, kind: 'practice', id: entry.style, ok: entry.result === 'win', level: entry.level });
    var d = today(); d.games = (d.games || 0) + 1;
    save();
  }

  /** Record a milestone skill test. score = fraction correct. */
  function recordTest(id, score, passed) {
    var rec = state.tests[id] || { attempts: 0, passed: false, best: 0 };
    rec.attempts++; rec.lastAt = Date.now(); rec.lastScore = score;
    rec.best = Math.max(rec.best || 0, score);
    if (passed && !rec.passed) { rec.passed = true; rec.passedAt = Date.now(); }
    state.tests[id] = rec;
    state.log.push({ t: Date.now(), kind: 'test', id: id, ok: !!passed, score: score });
    save();
    return rec;
  }

  /** Theme test-out: pass → the theme is "mastered" and only comes back as an occasional check-in. */
  function recordTestOut(theme, score, passed) {
    var rec = state.testouts[theme] || { attempts: 0, passed: false };
    rec.attempts++; rec.lastAt = Date.now(); rec.lastScore = score;
    if (passed) { rec.passed = true; state.mastered[theme] = { at: Date.now(), checkins: 0 }; }
    state.testouts[theme] = rec;
    state.log.push({ t: Date.now(), kind: 'testout', id: theme, ok: !!passed, score: score });
    save();
    return rec;
  }
  function isMastered(theme) { return !!(state.mastered && state.mastered[theme]); }
  function unmaster(theme) { if (state.mastered[theme]) { delete state.mastered[theme]; save(); } }

  /** Back-rank danger drill answer. Missed → back in 10 minutes; right → 1, 3, 7… days (same boxes as puzzles). */
  function recordDanger(id, ok) {
    var rec = state.danger[id] || { attempts: 0, ok: 0, box: 0, due: 0 };
    rec.attempts++; if (ok) rec.ok++;
    rec.lastOk = !!ok; rec.lastAt = Date.now();
    schedule(rec, !!ok, false);
    state.danger[id] = rec;
    state.log.push({ t: Date.now(), kind: 'danger', id: id, ok: !!ok });
    var d = today(); d.lab = (d.lab || 0) + 1;
    save();
    return rec;
  }

  /* ---------- statistics ---------- */

  function themeStats(themes) {
    var out = {};
    Object.keys(themes).forEach(function (k) { out[k] = { attempts: 0, ok: 0, recent: [] }; });
    state.log.forEach(function (e) {
      if (e.kind !== 'puzzle' || !out[e.theme]) return;
      var s = out[e.theme];
      s.attempts++; if (e.ok) s.ok++;
      s.recent.push(e.ok);
    });
    Object.keys(out).forEach(function (k) {
      var s = out[k], recent = s.recent.slice(-15);
      s.recentAccuracy = recent.length ? recent.filter(Boolean).length / recent.length : null;
      s.accuracy = s.attempts ? s.ok / s.attempts : null;
      delete s.recent;
    });
    return out;
  }

  function streak() {
    var n = 0, t = Date.now();
    // Today counts if trained; otherwise count from yesterday.
    var k = dayKey(t), d = state.days[k];
    if (!d || !(d.puzzles || d.drills || d.games)) t -= DAY;
    for (;;) {
      d = state.days[dayKey(t)];
      if (d && (d.puzzles || d.drills || d.games)) { n++; t -= DAY; } else break;
    }
    return n;
  }

  function totals() {
    var solved = 0, attempts = 0, firstTry = 0;
    Object.keys(state.puzzles).forEach(function (id) {
      var r = state.puzzles[id];
      attempts += r.attempts; firstTry += r.firstTryOk;
      if (r.firstTryOk || r.lastOk) solved++;
    });
    return { puzzlesSeen: Object.keys(state.puzzles).length, puzzlesSolved: solved, attempts: attempts, firstTryRate: attempts ? firstTry / attempts : null };
  }

  /** Backup = training progress + your saved games (games live under their own storage key). */
  function exportJSON() {
    var out = Object.assign({}, state);
    if (root.CT && root.CT.Games && root.CT.Games.all) out.savedGames = root.CT.Games.all();
    return JSON.stringify(out, null, 2);
  }
  function importJSON(text) {
    var s = JSON.parse(text);
    if (!s || s.version !== 1 || !s.puzzles || !s.openings) throw new Error('This does not look like a Chess Trainer backup file.');
    var saved = s.savedGames;
    delete s.savedGames;
    state = migrate(s); save();
    if (saved && root.CT && root.CT.Games && root.CT.Games.replaceAll) root.CT.Games.replaceAll(saved);
  }
  function reset() { state = blank(); save(); }

  root.CT = root.CT || {};
  root.CT.Store = {
    get state() { return state; },
    get memoryOnly() { return memoryOnly; },
    save: save, puzzleRatingOf: puzzleRatingOf, puzzleRating: function () { return (state.puzzleRating || { r: 800, n: 0 }).r; }, recordPractice: recordPractice, recordTest: recordTest, recordPuzzle: recordPuzzle, recordDrill: recordDrill, recordQuiz: recordQuiz, recordLab: recordLab, markLearned: markLearned, recordTestOut: recordTestOut, isMastered: isMastered, unmaster: unmaster, recordDanger: recordDanger,
    themeStats: themeStats, streak: streak, totals: totals, today: today, dayKey: dayKey, bumpDay: bumpDay,
    exportJSON: exportJSON, importJSON: importJSON, reset: reset,
    MASTERED_BOX: MASTERED_BOX, INTERVALS: INTERVALS
  };
})(window);
