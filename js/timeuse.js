/* Time use in a game: seconds spent per move (from %clk comments or practice-game clocks), a summary and
 * plain-language advice for rapid. Pure functions (tested in Node) plus an SVG chart. */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};

  /** "900+10" → { base: 900, inc: 10 }; null if unknown. */
  function control(h) {
    var m = String((h && h.TimeControl) || '').match(/^(\d+)(?:\+(\d+))?$/);
    return m ? { base: +m[1], inc: +(m[2] || 0) } : null;
  }

  /** Seconds spent on each half-move (null where unknown). */
  function spent(g) {
    var clk = g.clocks, tc = control(g.headers || {});
    if (!clk || !clk.length) return null;
    var out = [], prev = { w: tc ? tc.base : null, b: tc ? tc.base : null }, inc = tc ? tc.inc : 0;
    var first = String(g.startFen || '').split(' ')[1] === 'b' ? 'b' : 'w';
    for (var i = 0; i < clk.length; i++) {
      var c = (i % 2 === 0) === (first === 'w') ? 'w' : 'b';
      if (clk[i] == null || prev[c] == null) { out.push(null); if (clk[i] != null) prev[c] = clk[i]; continue; }
      out.push(Math.max(0, Math.round((prev[c] + (i > 0 ? inc : 0) - clk[i]) * 10) / 10));
      prev[c] = clk[i];
    }
    return out;
  }

  /** Summary for the user's moves. result = expanded analysis (optional) for mistake classes. */
  function summary(g, result) {
    var s = spent(g);
    if (!s) return null;
    var tc = control(g.headers || {}), me = g.userColor || 'w', first = String(g.startFen || '').split(' ')[1] === 'b' ? 'b' : 'w';
    var mine = [], total = 0;
    s.forEach(function (sec, i) {
      var c = (i % 2 === 0) === (first === 'w') ? 'w' : 'b';
      if (c !== me || sec == null) return;
      var m = result && result.moves[i];
      mine.push({ ply: i, sec: sec, moveNo: Math.floor(i / 2) + 1, cls: m ? m.cls : null, san: g.moves[i], left: g.clocks[i] });
      total += sec;
    });
    if (!mine.length) return null;
    var longest = mine.slice().sort(function (a, b) { return b.sec - a.sec; })[0];
    var opening = mine.filter(function (m) { return m.moveNo <= 10; }).reduce(function (a, m) { return a + m.sec; }, 0);
    var quickBad = mine.filter(function (m) { return (m.cls === 'blunder' || m.cls === 'mistake') && m.sec < 10; });
    var slowBad = mine.filter(function (m) { return (m.cls === 'blunder' || m.cls === 'mistake') && m.sec >= 10; });
    var low = tc ? mine.filter(function (m) { return m.left != null && m.left < tc.base * 0.1; })[0] || null : null;
    var tips = [];
    if (quickBad.length) tips.push(quickBad.length + ' of your mistakes came on moves played in under 10 seconds. In rapid you have time: before each move, ask "what does their last move threaten?" — especially after a check or a capture.');
    if (tc && opening > tc.base * 0.25) tips.push('You used ' + Math.round(opening / tc.base * 100) + '% of your time in the first 10 moves. Know your openings well enough to play them quickly, and save the time for the middlegame.');
    if (low) tips.push('You dropped below 10% of your time around move ' + low.moveNo + '. Avoid spending more than about 2 minutes on one move in 15+10.');
    if (tc && total < tc.base * 0.35 && mine.length >= 20) tips.push('You finished with lots of time unused. Rapid rewards slowing down: use it to double-check captures and checks before you move.');
    if (!tips.length) tips.push('Good clock management — no obvious time problems this game.');
    return { moves: mine, total: total, avg: total / mine.length, longest: longest, opening: opening, quickBad: quickBad, slowBad: slowBad, low: low, tips: tips, control: tc };
  }

  function fmt(sec) { sec = Math.round(sec); return sec >= 60 ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : sec + 's'; }

  function chartHtml(sum) {
    var W = 600, H = 80, n = sum.moves.length, max = Math.max(30, Math.min(300, Math.max.apply(null, sum.moves.map(function (m) { return m.sec; }))));
    var bw = W / n;
    var bars = sum.moves.map(function (m, i) {
      var h = Math.max(1.5, Math.min(1, m.sec / max) * (H - 4)), cls = m.cls === 'blunder' ? 'tb-blunder' : m.cls === 'mistake' ? 'tb-mistake' : 'tb-ok';
      return '<rect x="' + (i * bw + bw * 0.15).toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + h.toFixed(1) + '" class="' + cls + '" data-ply="' + (m.ply + 1) + '"><title>Move ' + m.moveNo + ' ' + m.san + ': ' + fmt(m.sec) + '</title></rect>';
    }).join('');
    return '<div class="timeuse"><h3>Your time per move</h3><svg class="timechart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-label="Time spent on each of your moves">' + bars + '</svg>' +
      '<p class="small muted">Average ' + fmt(sum.avg) + ' per move · longest think ' + fmt(sum.longest.sec) + ' on move ' + sum.longest.moveNo + ' (' + sum.longest.san + ') · red = blunder, orange = mistake.</p>' +
      '<ul class="small">' + sum.tips.map(function (t) { return '<li>' + CT.UI.esc(t) + '</li>'; }).join('') + '</ul></div>';
  }

  CT.TimeUse = { control: control, spent: spent, summary: summary, chartHtml: chartHtml, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = CT.TimeUse;
})(typeof window !== 'undefined' ? window : globalThis);
