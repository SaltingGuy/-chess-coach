/* Coach's notebook (#/progress/notebook): the experiment record — what your games show, the current hypothesis and test, and past verdicts. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  function view(v) {
    var X = CT.Experiments, st = X.status(), L = X.lab(), f = X.fmt;
    var pending = X.pendingAnalysis();
    var html = '<a class="back" href="#/progress">← Progress</a><h1>🔬 Coach\'s notebook</h1>' +
      '<p class="muted">Your training runs like an experiment: <strong>observe</strong> your real games → pick the <strong>leak</strong> that costs you most → <strong>test</strong> one training method every day → <strong>measure</strong> your next games against the 10 before → keep what works, change what doesn\'t.</p>';

    if (pending) html += '<section class="card"><p><strong>' + pending + '</strong> game' + (pending > 1 ? 's are' : ' is') + ' waiting for engine analysis. They are analysed in the background while you are on the dashboard (Stockfish, a minute or two each).</p><div class="btn-row"><button class="btn" data-act="analyse">Analyse now</button></div><p class="small muted an-msg"></p></section>';

    if (st.active) {
      var e = st.active, r = st.interim, m = st.method;
      html += '<section class="card exp-card"><div class="row-between"><h2>Experiment #' + e.id + ': ' + esc(st.title) + '</h2><span class="tag">running</span></div>' +
        '<p>' + esc(e.hypothesis) + '</p>' +
        '<p class="small"><strong>Training:</strong> ' + esc(m.label) + ' — ' + esc(m.how) + '. It is in every guided session as a core block.</p>' +
        '<div class="stat-row"><div><strong>' + f(e.baseline.rate * 10) + '</strong><small>per 10 games before</small></div>' +
          '<div><strong>' + (r.games ? f(r.rate * 10) : '—') + '</strong><small>per 10 games since</small></div>' +
          '<div><strong>' + r.games + '/' + st.needed + '</strong><small>new games measured</small></div>' +
          '<div><strong>' + (r.games >= 3 ? Math.round(r.p * 100) + '%' : '—') + '</strong><small>sure it went down</small></div></div>' +
        UI.bar(Math.min(1, r.games / st.needed)) +
        '<p class="small muted">Started ' + new Date(e.start).toLocaleDateString() + '. Only real games count (not practice games). ' + (r.games < 3 ? 'Too early to tell — play some rapid games on chess.com.' : r.p >= 0.9 ? 'Looking good so far.' : r.p <= 0.6 ? 'No clear change yet.' : 'Some sign of improvement — more games will tell.') + '</p></section>';
    } else {
      html += '<section class="card"><h2>No experiment running</h2><p>' + (st.games < X.MIN_BASE ?
        'The first experiment starts once ' + X.MIN_BASE + ' of your real games are analysed (you have ' + st.games + '). Save your chess.com username on the Game → Import tab and your games load automatically.' :
        'None of the leaks in your last 10 games is clear enough right now (each must show up in at least 2 games). Keep playing — the notebook checks after every analysed game.') + '</p></section>';
    }

    var ob = X.observe();
    if (ob.games) {
      html += '<section class="card"><h2>What your last ' + ob.games + ' real games show</h2><p class="small muted">Ranked by how many winning chances each one costs you per game.</p><table class="nb-table"><thead><tr><th>Leak</th><th>per 10 games</th><th>cost / game</th><th>games</th></tr></thead><tbody>' +
        ob.rows.filter(function (r) { return r.total > 0; }).map(function (r) {
          return '<tr><td>' + esc(X.label(r.key, r.motif)) + '</td><td>' + f(r.rate * 10) + '</td><td>' + Math.round(r.costPerGame) + '%</td><td>' + r.affected + '/' + r.games + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (ob.rows.every(function (r) { return !r.total; }) ? '<p class="good">No leaks found in these games. 🎉</p>' : '') + '</section>';
    }

    if (CT.Insights) {
      var ts = CT.Insights.tiltStats();
      if (ts.afterLossN >= 3) html += '<section class="card"><h2>🧊 After a loss</h2><p>In your real games you score <strong>' + ts.afterLoss + '%</strong> in a game started within 30 minutes of a loss (' + ts.afterLossN + ' games), <strong>' + (ts.afterWin != null ? ts.afterWin + '%' : '—') + '</strong> after a win, and <strong>' + (ts.afterBreak != null ? ts.afterBreak + '%' : '—') + '</strong> after a break of 30+ minutes.</p><p class="small muted">If the first number is clearly lower, a break after a loss is free rating points. The dashboard warns you after two losses in a row.</p></section>';
    }
    if (CT.Think) {
      var rs = CT.Think.reasonStats();
      if (rs.total >= 3) html += '<section class="card"><h2>🧠 Why your mistakes happen</h2><p class="small muted">From your own answers in Think-First (' + rs.total + ' turning points).</p>' +
        rs.list.filter(function (x) { return x.n; }).map(function (x) { return '<div class="why-row"><span>' + esc(x.label) + '</span><span>' + Math.round(x.share * 100) + '%</span></div>' + UI.bar(x.share); }).join('') + '</section>';
    }

    if (L.history.length) {
      html += '<section class="card"><h2>Past experiments</h2><ul class="nb-hist">' + L.history.slice().reverse().map(function (e) {
        var r = e.result || {}, badge = { improved: '<span class="tag ok">worked</span>', 'no-effect': '<span class="tag bad">no effect</span>', unclear: '<span class="tag">unclear</span>', stopped: '<span class="tag">paused</span>' }[e.verdict] || '';
        return '<li><strong>#' + e.id + ' ' + esc(X.label(e.symptom, e.motif)) + '</strong> ' + badge + '<br><span class="small">' + esc(X.SYMPTOMS[e.symptom].methods[e.method].label) + ': ' +
          f(e.baseline.rate * 10) + ' → ' + (r.games ? f(r.rate * 10) : '—') + ' per 10 games over ' + (r.games || 0) + ' games' + (r.p != null ? ' · ' + Math.round(r.p * 100) + '% sure it went down' : '') +
          ' · ' + new Date(e.start).toLocaleDateString() + '–' + new Date(e.endedAt).toLocaleDateString() + '</span></li>';
      }).join('') + '</ul></section>';
    }

    html += '<details class="tool"><summary>How the measuring works</summary><div class="small"><p>For each leak we count how often it happens per game. The 10 real games before an experiment are the "before" picture; games played after it starts are the "after" picture.</p>' +
      '<p>"How sure" is the chance that the after-rate is truly lower than the before-rate, and not just luck (a Bayesian comparison of two rates). A method <strong>works</strong> when we are at least 90% sure and the leak dropped by at least a quarter, after 8 or more new games (5 if the drop is very large). If nothing changes, the coach switches to a different training method; if that fails too, it moves on to your next-biggest leak.</p>' +
      '<p>Games against the app\'s computer opponents are left out: takebacks and Safety check make them a different test.</p></div></details>';
    v.innerHTML = html;

    var b = v.querySelector('[data-act="analyse"]');
    if (b) b.addEventListener('click', function () {
      b.disabled = true;
      var msg = v.querySelector('.an-msg');
      msg.textContent = 'Analysing… you can stay on this page.';
      X.analyseQueue(5, function (n) { msg.textContent = n + ' analysed.'; view(v); });
    });
  }

  CT.Views = CT.Views || {};
  CT.Views.notebook = view;
})(window);
