/*
 * Keeping your progress safe, and the same on every device.
 *
 *  • Ask the browser to keep this site's data ("persistent storage"), where it allows that.
 *  • Backup reminder: if nothing was backed up or synced for 7 days, the dashboard offers a one-tap backup.
 *  • Optional sync through a PRIVATE GitHub repository of yours (no server of ours, nothing else involved):
 *    the app reads and writes two files there — progress.json and games.json — with a token you create that
 *    can only touch that one repository. Each device merges what it finds with what it has, so training on the
 *    phone and on the Chromebook adds up instead of overwriting. The token is stored on this device only and is
 *    never part of a backup.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var TOKEN_KEY = 'chess-trainer.sync-token', API = 'https://api.github.com';
  var BACKUP_NAG = 7 * 86400000, AUTO_GAP = 10 * 60000;
  var running = null;

  function prof() { return CT.Store.state.profile; }
  function getToken() { try { return root.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) root.localStorage.setItem(TOKEN_KEY, t.trim()); else root.localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
  function configured() { return !!(getToken() && prof().syncRepo); }
  function deviceId() { var p = prof(); if (!p.deviceId) { p.deviceId = Math.random().toString(36).slice(2, 10); CT.Store.save(); } return p.deviceId; }

  /* ---------------- Ask the browser to keep the data ---------------- */
  function persist() {
    var s = root.navigator && root.navigator.storage;
    if (!s || !s.persist) return Promise.resolve(null);
    return s.persisted().then(function (already) { return already || s.persist(); }).then(function (ok) { prof().persisted = !!ok; return !!ok; }).catch(function () { return null; });
  }

  /* ---------------- Backup reminder ---------------- */
  function markBackedUp() { prof().lastBackupAt = Date.now(); CT.Store.save(); }
  function needsBackup(now) {
    now = now || Date.now();
    var S = CT.Store.state, last = Math.max(prof().lastBackupAt || 0, (S.syncInfo && S.syncInfo.lastOk) || 0);
    var hasWork = Object.keys(S.puzzles).length >= 10 || (CT.Games && CT.Games.list().length > 0);
    return hasWork && now - last > BACKUP_NAG && now - (S.createdAt || now) > BACKUP_NAG;
  }

  /* ---------------- Merging two copies of your progress ---------------- */
  function when(r) { return r ? (r.lastAt || r.at || r.t || r.endedAt || r.startedAt || 0) : 0; }
  function newer(a, b) { if (!a) return b; if (!b) return a; var ta = when(a), tb = when(b); if (ta !== tb) return ta > tb ? a : b; return (a.attempts || 0) >= (b.attempts || 0) ? a : b; }
  function mergeMap(a, b, pick) { var out = {}; Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { out[k] = (pick || newer)((a || {})[k], (b || {})[k]); }); return out; }
  function more(a, b) { if (!a) return b; if (!b) return a; if ((a.attempts || 0) !== (b.attempts || 0)) return (a.attempts || 0) > (b.attempts || 0) ? a : b; return newer(a, b); }

  /** Merge two saved states (this device's and the one in your GitHub repo). Neither loses work. */
  function mergeStates(L, R) {
    if (!R) return L; if (!L) return R;
    var lNew = (L.savedAt || 0) >= (R.savedAt || 0), base = lNew ? L : R, other = lNew ? R : L;
    var out = JSON.parse(JSON.stringify(base));
    out.puzzles = mergeMap(L.puzzles, R.puzzles, more);
    out.openings = mergeMap(L.openings, R.openings, more);
    out.quiz = mergeMap(L.quiz, R.quiz, more);
    out.lab = mergeMap(L.lab, R.lab, more);
    out.danger = mergeMap(L.danger, R.danger, more);
    out.tests = mergeMap(L.tests, R.tests, more);
    out.testouts = mergeMap(L.testouts, R.testouts, more);
    out.milestones = mergeMap(L.milestones, R.milestones, function (a, b) { return a && b ? Math.min(a, b) : a || b; });
    out.gamePuzzles = Object.assign({}, other.gamePuzzles || {}, base.gamePuzzles || {});
    // Events: union (same time + kind + id = same event).
    var seen = {}, log = [];
    (L.log || []).concat(R.log || []).forEach(function (e) { var k = e.t + '|' + e.kind + '|' + e.id; if (!seen[k]) { seen[k] = 1; log.push(e); } });
    out.log = log.sort(function (a, b) { return a.t - b.t; }).slice(-3000);
    // Daily counters: both devices trained, so add what each did — but the same device synced twice must not double.
    out.days = mergeDays(L, R);
    out.practice = unionBy((L.practice || []).concat(R.practice || []), function (p) { return p.t + '|' + (p.gameId || ''); }).sort(function (a, b) { return a.t - b.t; });
    out.puzzleRating = ((L.puzzleRating || {}).n || 0) >= ((R.puzzleRating || {}).n || 0) ? L.puzzleRating : R.puzzleRating;
    out.mastered = mergeMap(L.mastered, R.mastered, newer);
    var eL = L.experiments || {}, eR = R.experiments || {};
    out.experiments = (eL.n || 0) >= (eR.n || 0) ? eL : eR;
    var tL = L.think || {}, tR = R.think || {};
    out.think = {
      games: Object.assign({}, tR.games || {}, tL.games || {}),
      reasons: mergeMap(tL.reasons, tR.reasons, function (a, b) { return Math.max(a || 0, b || 0); }),
      transfer: unionBy((tL.transfer || []).concat(tR.transfer || []).sort(function (a, b) { return (b.done ? 1 : 0) - (a.done ? 1 : 0); }), function (x) { return x.id; })
    };
    out.ccSync = (((L.ccSync || {}).lastEndTime || 0) >= ((R.ccSync || {}).lastEndTime || 0)) ? L.ccSync : R.ccSync;
    var sL = L.session, sR = R.session;
    out.session = !sL ? sR : !sR ? sL : ((sL.startedAt || 0) >= (sR.startedAt || 0) ? sL : sR);
    // Settings that belong to one device stay on it.
    out.profile = Object.assign({}, base.profile, { deviceId: L.profile && L.profile.deviceId, syncRepo: L.profile && L.profile.syncRepo, voiceProvider: L.profile && L.profile.voiceProvider, voiceName: L.profile && L.profile.voiceName, persisted: L.profile && L.profile.persisted });
    out.practiceCurrent = L.practiceCurrent || null; // an unfinished game lives on the device it is played on
    out.createdAt = Math.min(L.createdAt || Date.now(), R.createdAt || Date.now());
    return out;
  }
  function unionBy(list, key) { var seen = {}, out = []; list.forEach(function (x) { var k = key(x); if (!seen[k]) { seen[k] = 1; out.push(x); } }); return out; }
  /**
   * Daily counters are kept per device (days[day].byDevice[id]); the day's numbers are the sum over devices,
   * so a puzzle solved on the phone and one on the Chromebook make two — and syncing twice never doubles.
   */
  function mergeDays(L, R) {
    var out = {}, me = L.profile && L.profile.deviceId, them = R.profile && R.profile.deviceId;
    var days = {}; Object.keys(L.days || {}).concat(Object.keys(R.days || {})).forEach(function (d) { days[d] = 1; });
    Object.keys(days).forEach(function (day) {
      var a = (L.days || {})[day], b = (R.days || {})[day], by = {};
      if (b) { if (b.byDevice) Object.assign(by, b.byDevice); else if (them && them !== me) by[them] = strip(b); }
      if (a) {
        var others = {}, aBy = a.byDevice || {};
        Object.keys(aBy).forEach(function (d) { if (d !== me) { by[d] = by[d] || aBy[d]; add(others, aBy[d]); } });
        var mine = strip(a); Object.keys(mine).forEach(function (k) { mine[k] = Math.max(0, mine[k] - (others[k] || 0)); });
        if (me) by[me] = mine; else { out[day] = Object.assign({}, b || {}, a); return; }
      }
      if (!Object.keys(by).length) { out[day] = Object.assign({}, b || {}); return; }
      var sum = {}; Object.keys(by).forEach(function (d) { add(sum, by[d]); });
      sum.byDevice = by; out[day] = sum;
    });
    return out;
  }
  function add(into, from) { Object.keys(from || {}).forEach(function (k) { if (typeof from[k] === 'number') into[k] = (into[k] || 0) + from[k]; }); }
  function strip(d) { var o = {}; Object.keys(d || {}).forEach(function (k) { if (k !== 'byDevice' && typeof d[k] === 'number') o[k] = d[k]; }); return o; }

  function mergeGames(L, R) {
    var by = {};
    (R || []).concat(L || []).forEach(function (g) {
      var have = by[g.id];
      if (!have) { by[g.id] = g; return; }
      var ga = (g.analysis && g.analysis.at) || 0, ha = (have.analysis && have.analysis.at) || 0;
      var keep = ga > ha ? g : have, other = keep === g ? have : g;
      if (!keep.userColor && other.userColor) keep.userColor = other.userColor;
      by[g.id] = keep;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
  }

  /* ---------------- GitHub (your private repository) ---------------- */
  function gh(path, opts, fetchFn) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + getToken(), Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return (fetchFn || root.fetch)(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' }).then(function (r) {
      if (r.status === 404 && opts.allow404) return null;
      if (r.status === 401) throw err('The token was refused — it may have expired. Make a new one and save it again.');
      if (r.status === 403) throw err('The token is not allowed to do this. It needs "Contents: Read and write" for your sync repository.');
      if (r.status === 404) throw err('Repository not found. Check the name, and that the token can access it.');
      if (r.status === 409) throw err('conflict');
      if (!r.ok) throw err('GitHub answered with an error (' + r.status + ').');
      return opts.raw ? r.text() : r.json();
    });
  }
  function err(m) { var e = new Error(m); e.sync = true; return e; }
  function b64(str) { var bytes = new TextEncoder().encode(str), bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return root.btoa(bin); }
  function repoPath() { var r = prof().syncRepo || ''; return r.indexOf('/') > 0 ? r : null; }

  function readFile(name, fetchFn) {
    var p = '/repos/' + repoPath() + '/contents/' + name;
    return gh(p, { allow404: true }, fetchFn).then(function (meta) {
      if (!meta) return { sha: null, data: null };
      return gh(p, { raw: true }, fetchFn).then(function (txt) { return { sha: meta.sha, data: txt ? JSON.parse(txt) : null }; });
    });
  }
  function writeFile(name, data, sha, fetchFn) {
    return gh('/repos/' + repoPath() + '/contents/' + name, { method: 'PUT', body: { message: 'Chess Coach sync from ' + deviceId(), content: b64(JSON.stringify(data)), sha: sha || undefined } }, fetchFn);
  }

  /** Check the token and repository, then sync. repo may be "name" (your account is looked up) or "owner/name". */
  function connect(token, repo, fetchFn) {
    setToken(token);
    var p = prof();
    var whoFirst = repo.indexOf('/') > 0 ? Promise.resolve(repo) : gh('/user', {}, fetchFn).then(function (u) { return u.login + '/' + repo; });
    return whoFirst.then(function (full) {
      p.syncRepo = full; CT.Store.save();
      return gh('/repos/' + full, {}, fetchFn);
    }).then(function (info) {
      if (!info.private) throw err('That repository is public. For your privacy, sync only works with a private repository.');
      return sync({ fetch: fetchFn });
    }).catch(function (e) {
      // Connecting failed: forget the token and repository again, and say why in plain words.
      setToken(''); p.syncRepo = ''; CT.Store.save();
      return { ok: false, error: e.sync ? e.message : 'Could not reach GitHub (offline?).' };
    });
  }
  function disconnect() { setToken(''); prof().syncRepo = ''; CT.Store.save(); }

  /** Pull, merge, push. Resolves {ok, pulled, pushed, error}. */
  function sync(opts) {
    opts = opts || {};
    if (!configured()) return Promise.resolve({ ok: false, error: 'Sync is not set up.' });
    if (running) return running;
    var fetchFn = opts.fetch, S = CT.Store;
    deviceId();
    var info = S.state.syncInfo = S.state.syncInfo || {};
    var attempt = function (tries) {
      return Promise.all([readFile('progress.json', fetchFn), readFile('games.json', fetchFn)]).then(function (got) {
        var remote = got[0].data, remoteGames = got[1].data;
        var mine = JSON.parse(S.exportJSON()); delete mine.savedGames;
        var mergedState = remote ? mergeStates(mine, remote.state || remote) : mine;
        var mergedGames = mergeGames(CT.Games.all(), remoteGames && remoteGames.games);
        mergedState.savedAt = Date.now();
        // Apply locally (keeps this device's token and settings).
        S.importJSON(JSON.stringify(Object.assign({}, mergedState, { savedGames: mergedGames })));
        var now = Date.now();
        return writeFile('progress.json', { app: 'chess-coach', device: deviceId(), savedAt: now, state: mergedState }, got[0].sha, fetchFn)
          .then(function () { return writeFile('games.json', { app: 'chess-coach', device: deviceId(), savedAt: now, games: mergedGames }, got[1].sha, fetchFn); })
          .then(function () { return { ok: true, pulled: !!remote, games: mergedGames.length }; });
      }).catch(function (e) {
        if (e.message === 'conflict' && tries < 2) return attempt(tries + 1); // the other device wrote at the same moment: merge again
        throw e;
      });
    };
    running = attempt(0).then(function (res) {
      info = S.state.syncInfo = S.state.syncInfo || {};
      info.lastOk = Date.now(); info.lastError = null; S.save();
      return res;
    }).catch(function (e) {
      info = S.state.syncInfo = S.state.syncInfo || {};
      info.lastTry = Date.now(); info.lastError = e.sync ? e.message : 'Could not reach GitHub (offline?).'; S.save();
      return { ok: false, error: info.lastError };
    }).then(function (r) { running = null; return r; });
    return running;
  }

  /** On app start (and after training, at most every 10 minutes): sync if set up. */
  function autoSync() {
    if (!configured()) return Promise.resolve(null);
    var info = CT.Store.state.syncInfo || {};
    if (Date.now() - Math.max(info.lastOk || 0, info.lastTry || 0) < AUTO_GAP) return Promise.resolve(null);
    return sync();
  }

  function statusText() {
    var info = CT.Store.state.syncInfo || {};
    if (!configured()) return 'Not set up.';
    if (info.lastError) return 'Last try ' + new Date(info.lastTry).toLocaleString() + ': ' + info.lastError;
    return info.lastOk ? 'Synced ' + new Date(info.lastOk).toLocaleString() + ' with ' + prof().syncRepo + '.' : 'Set up, not synced yet.';
  }

  CT.Sync = { persist: persist, needsBackup: needsBackup, markBackedUp: markBackedUp, mergeStates: mergeStates, mergeGames: mergeGames,
    connect: connect, disconnect: disconnect, sync: sync, autoSync: autoSync, configured: configured, statusText: statusText, hasToken: function () { return !!getToken(); } };
})(typeof window !== 'undefined' ? window : globalThis);
