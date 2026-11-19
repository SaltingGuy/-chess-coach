/*
 * Two things only YOUR games can tell:
 *
 *  Trap Payoff — for every trap in your repertoire and the trap library: how often your real games reached the
 *  trap position, how often the opponent fell for it, and whether you then punished it. And the other way round:
 *  traps set against you that you fell into. Drills for traps that actually come up (or that you fell for) are
 *  served first.
 *
 *  Tilt Guard — how you score right after a loss compared with after a win, from your own games; and a warning
 *  when you have just lost two in a row within the hour (players do measurably worse straight after losses,
 *  especially under 1200; a 30-minute break resets it).
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  function key(fen) { return fen.split(' ').slice(0, 4).join(' '); }
  function strip(s) { return String(s || '').replace(/[+#?!]/g, ''); }
  function real() { return CT.Experiments ? CT.Experiments.realGames() : (CT.Games ? CT.Games.list().filter(function (g) { return g.userColor; }) : []); }

  /* ---------------- Trap Payoff ---------------- */
  var fenCache = {};
  /** position key → [ply, ...] for one game (position BEFORE move `ply`). */
  function positions(g) {
    if (fenCache[g.id]) return fenCache[g.id];
    var b = new CT.Chess(g.startFen), map = {};
    for (var i = 0; i <= g.moves.length; i++) {
      var k = key(b.fen());
      (map[k] = map[k] || []).push(i);
      if (i < g.moves.length && !b.move(g.moves[i])) break;
    }
    return (fenCache[g.id] = map);
  }
  function trapFen(d) {
    var b = new CT.Chess();
    for (var i = 0; i < d.mistakePly; i++) { var mv = Array.isArray(d.moves[i]) ? d.moves[i][0] : (d.moves[i].san || d.moves[i]); if (!b.move(mv)) return null; }
    return key(b.fen());
  }
  function sanAt(d, i) { var m = d.moves[i]; return m == null ? null : Array.isArray(m) ? m[0] : (m.san || m); }

  /** Per drill: in your real games, how often the trap came up and what happened. */
  function trapPayoff() {
    if (!CT.TrapDrills) return [];
    var games = real(), out = [];
    CT.TrapDrills.all().forEach(function (d) {
      var fen = trapFen(d);
      if (!fen) return;
      var mistake = strip(sanAt(d, d.mistakePly)), punish = strip(sanAt(d, d.mistakePly + 1));
      var good = [punish].concat((d.alsoGood || []).map(strip));
      var row = { drill: d, reached: 0, fell: 0, punished: 0, games: [] };
      games.forEach(function (g) {
        // The drill's colour is your colour in it (trap-setter when punishing, the one being trapped when avoiding).
        // The position key includes whose turn it is, so a match is the exact trap moment.
        if (g.userColor !== d.color) return;
        var plies = positions(g)[fen];
        if (!plies) return;
        var ply = plies[0];
        row.reached++;
        var played = strip(g.moves[ply]);
        if (played === mistake) {
          row.fell++;
          if (d.mode === 'punish' && good.indexOf(strip(g.moves[ply + 1])) >= 0) row.punished++;
          row.games.push({ id: g.id, ply: ply, punished: d.mode === 'punish' ? good.indexOf(strip(g.moves[ply + 1])) >= 0 : null });
        }
      });
      if (row.reached) out.push(row);
    });
    return out.sort(function (a, b) { return b.fell - a.fell || b.reached - a.reached; });
  }
  /** Drill ids to serve first: traps you fell for, opponent mistakes you did not punish, traps that come up. */
  function trapPriorities() {
    var pr = [];
    trapPayoff().forEach(function (r) {
      var d = r.drill;
      if (d.mode === 'avoid' && r.fell) pr.push({ id: d.id, why: 'you fell for it in ' + r.fell + ' of your games', w: 3 + r.fell });
      else if (d.mode === 'punish' && r.fell > r.punished) pr.push({ id: d.id, why: 'your opponent fell for it ' + r.fell + '× but you punished it ' + r.punished + '×', w: 2 + r.fell - r.punished });
      else if (d.mode === 'punish' && r.reached) pr.push({ id: d.id, why: 'it came up in ' + r.reached + ' of your games', w: 1 + r.reached / 10 });
    });
    return pr.sort(function (a, b) { return b.w - a.w; });
  }

  /* ---------------- Tilt Guard ---------------- */
  function outcome(g) { return g.report ? g.report.outcome : resultFor(g); }
  function resultFor(g) {
    var r = (g.headers || {}).Result, c = g.userColor;
    if (!r || !c) return null;
    return r === '1/2-1/2' ? 'drew' : (r === '1-0') === (c === 'w') ? 'won' : r === '0-1' || r === '1-0' ? 'lost' : null;
  }
  function when(g) { return CT.Experiments ? CT.Experiments.playedAt(g) : (g.addedAt || 0); }
  function allPlayed() {
    return (CT.Games ? CT.Games.list() : []).filter(function (g) { return g.userColor && outcome(g) && outcome(g) !== 'played'; })
      .filter(function (g) { var h = g.headers || {}; return h.Site !== 'Chess Trainer'; })
      .sort(function (a, b) { return when(a) - when(b); });
  }
  /** Your score in games played within 30 minutes after a loss, vs after a win (from all your saved real games). */
  function tiltStats() {
    var gs = allPlayed(), after = { lost: [0, 0], won: [0, 0], fresh: [0, 0] };
    for (var i = 1; i < gs.length; i++) {
      var prev = gs[i - 1], gap = when(gs[i]) - when(prev), o = outcome(gs[i]), pts = o === 'won' ? 1 : o === 'drew' ? 0.5 : 0;
      var bucket = gap > 30 * 60000 ? 'fresh' : outcome(prev) === 'lost' ? 'lost' : outcome(prev) === 'won' ? 'won' : null;
      if (bucket) { after[bucket][0] += pts; after[bucket][1]++; }
    }
    var pct = function (x) { return x[1] ? Math.round(x[0] / x[1] * 100) : null; };
    return { games: gs.length, afterLoss: pct(after.lost), afterLossN: after.lost[1], afterWin: pct(after.won), afterWinN: after.won[1], afterBreak: pct(after.fresh), afterBreakN: after.fresh[1] };
  }
  /** A warning when your last two real games were losses, the latest within the last hour. */
  function tiltNow(now) {
    now = now || Date.now();
    var gs = allPlayed(), n = gs.length;
    if (n < 2) return null;
    var a = gs[n - 1], b = gs[n - 2];
    if (outcome(a) !== 'lost' || outcome(b) !== 'lost') return null;
    if (now - when(a) > 60 * 60000 || when(a) - when(b) > 60 * 60000) return null;
    var dismissed = (CT.Store.state.profile.tiltDismissedAt || 0) > when(a);
    if (dismissed) return null;
    var st = tiltStats();
    return { lastAt: when(a), resumeAt: when(a) + 30 * 60000, stats: st };
  }
  function dismissTilt() { CT.Store.state.profile.tiltDismissedAt = Date.now(); CT.Store.save(); }

  /* Practice games inside the app: two losses in a row → suggest a break before the next one. */
  function practiceTilt(now) {
    now = now || Date.now();
    var p = (CT.Store.state.practice || []).slice(-2);
    if (p.length < 2 || !p.every(function (x) { return x.result === 'loss' || x.result === 'lost'; })) return null;
    return now - p[1].t < 60 * 60000 ? { lastAt: p[1].t } : null;
  }

  CT.Insights = { trapPayoff: trapPayoff, trapPriorities: trapPriorities, tiltStats: tiltStats, tiltNow: tiltNow, dismissTilt: dismissTilt, practiceTilt: practiceTilt, _clear: function () { fenCache = {}; } };
})(typeof window !== 'undefined' ? window : globalThis);
