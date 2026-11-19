/*
 * chess.com auto-sync. chess.com publishes every player's finished games through its free, read-only
 * Published-Data API (no login, no password — only the username). When the app runs as its own website
 * (e.g. GitHub Pages) it loads your new games every time you open it. Inside claude.ai the page is not
 * allowed to contact other websites, so sync reports "blocked" there and you paste PGNs instead.
 *
 * Setup link: add ?cc=YourName to the app's address once and the username is saved.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  var AUTO_GAP = 15 * 60000;   // auto-sync at most every 15 minutes
  var FIRST_MAX = 30;          // first sync: your 30 newest games from the last 2 months
  var running = null;

  function S() { var s = CT.Store.state; s.ccSync = s.ccSync || {}; return s.ccSync; }
  function user() { return ((CT.Store.state.profile.chesscomUser || '') + '').trim(); }
  function autoOn() { return !!user() && CT.Store.state.profile.ccAuto !== false; }

  function getJson(url, fetchFn) {
    return fetchFn(url).then(function (r) {
      if (r.status === 404) { var e = new Error('No chess.com player called "' + user() + '".'); e.kind = 'nouser'; throw e; }
      if (!r.ok) { var e2 = new Error('chess.com answered with an error (' + r.status + ').'); e2.kind = 'http'; throw e2; }
      return r.json();
    });
  }

  /**
   * Load new finished standard games into the game database.
   * Resolves { ok, added: [ids], duplicates, blocked, error }. Never rejects.
   */
  function sync(opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (root.fetch && root.fetch.bind(root));
    var u = user();
    if (!u) return Promise.resolve({ ok: false, error: 'Enter your chess.com username first.', added: [] });
    if (!fetchFn) return Promise.resolve({ ok: false, blocked: true, error: 'This browser cannot contact chess.com.', added: [] });
    if (running) return running;
    var st = S();
    if (st.user && st.user.toLowerCase() !== u.toLowerCase()) { st.lastEndTime = 0; } // new username: start fresh
    var since = st.lastEndTime || 0;
    var base = 'https://api.chess.com/pub/player/' + encodeURIComponent(u.toLowerCase());
    running = getJson(base + '/games/archives', fetchFn).then(function (j) {
      var months = j.archives || [];
      if (since) {
        var d = new Date(since * 1000), key = d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
        months = months.filter(function (m) { var p = m.match(/(\d{4})\/(\d{2})$/); return p && (+p[1] * 100 + +p[2]) >= key; });
      } else months = months.slice(-2);
      return Promise.all(months.map(function (m) { return getJson(m, fetchFn); }));
    }).then(function (lists) {
      var all = [];
      lists.forEach(function (l) { (l.games || []).forEach(function (g) { if (g.pgn && (!g.rules || g.rules === 'chess') && (g.end_time || 0) > since) all.push(g); }); });
      all.sort(function (a, b) { return (a.end_time || 0) - (b.end_time || 0); });
      if (!since) all = all.slice(-FIRST_MAX);
      var added = [], dup = 0, maxEnd = since;
      all.forEach(function (g) {
        var r = CT.Games.add(g.pgn);
        if (r.ok && !r.duplicate) added.push(r.id); else if (r.ok) dup++;
        if ((g.end_time || 0) > maxEnd) maxEnd = g.end_time;
      });
      st.user = u; st.lastAt = Date.now(); st.lastEndTime = maxEnd; st.lastAdded = added.length; st.lastError = null;
      if (added.length) st.newIds = (st.newIds || []).concat(added).slice(-50);
      CT.Store.save();
      return { ok: true, added: added, duplicates: dup };
    }).catch(function (err) {
      // A network refusal (offline, or a page that may not contact other sites) shows up as a TypeError.
      var blocked = err instanceof TypeError || (!err.kind && /failed to fetch|network|load failed/i.test(err.message || ''));
      st.lastAt = Date.now(); st.lastError = blocked ? 'blocked' : err.message;
      CT.Store.save();
      return { ok: false, blocked: !!blocked, error: blocked ? 'Could not reach chess.com from here.' : err.message, added: [] };
    }).then(function (res) { running = null; return res; });
    return running;
  }

  /** New synced games you have not reviewed yet (analysed games drop off). */
  function pending() {
    var ids = S().newIds || [];
    // New games you have not reviewed: not analysed yet, or analysed (maybe in the background) but not replayed with Think-First.
    return ids.map(function (id) { return CT.Games.get(id); }).filter(function (g) {
      return g && (!g.analysis || (CT.Think ? !CT.Think.done(g.id) && CT.Think.moments(g).length > 0 : false));
    });
  }
  function clearPending() { S().newIds = []; CT.Store.save(); }

  /** On app start: take ?cc=Name from the address, then sync if it is on and not done in the last 15 minutes. */
  function autoStart() {
    try {
      var m = (root.location.search || '').match(/[?&]cc=([^&]+)/);
      if (m) {
        CT.Store.state.profile.chesscomUser = decodeURIComponent(m[1]); CT.Store.state.profile.ccAuto = true; CT.Store.save();
        if (root.history && root.history.replaceState) root.history.replaceState(null, '', root.location.pathname + root.location.hash);
      }
    } catch (e) { /* ignore */ }
    if (!autoOn() || Date.now() - (S().lastAt || 0) < AUTO_GAP) return Promise.resolve(null);
    return sync().then(function (res) {
      if (res.ok && res.added.length) {
        CT.UI.toast('📥 ' + res.added.length + ' new chess.com game' + (res.added.length > 1 ? 's' : '') + ' added');
        if (CT.App && /^#\/?$|^$|^#\/analysis/.test(root.location.hash)) CT.App.rerender();
      }
      return res;
    });
  }

  function onClaude() { try { return /claude\.ai$|claudeusercontent|anthropic/.test(root.location.hostname); } catch (e) { return false; } }

  function statusText() {
    var st = S();
    if (!user()) return 'No username saved.';
    if (!st.lastAt) return 'Not synced yet.';
    var when = new Date(st.lastAt).toLocaleString();
    if (st.lastError === 'blocked') return 'Last try ' + when + ': ' + (onClaude() ? 'this copy of the app runs inside claude.ai, which blocks contact with chess.com. Use your own app website, or paste PGNs.' : 'could not reach chess.com — are you offline? It will try again next time you open the app.');
    if (st.lastError) return 'Last try ' + when + ': ' + st.lastError;
    return 'Last synced ' + when + (st.lastAdded ? ' — ' + st.lastAdded + ' new game' + (st.lastAdded > 1 ? 's' : '') : ' — no new games') + '.';
  }

  CT.ChessCom = { sync: sync, autoStart: autoStart, pending: pending, clearPending: clearPending, statusText: statusText, autoOn: autoOn, AUTO_GAP: AUTO_GAP };
})(typeof window !== 'undefined' ? window : globalThis);
