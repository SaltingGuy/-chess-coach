/* Dashboard: greeting, skill snapshot, today's plan, quick starts, 14-day activity, weak spots, recent activity. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  function ring(value, label, sub, color) {
    var v = value == null ? 0 : Math.max(0, Math.min(1, value));
    return '<div class="ring-card"><div class="ring" style="--p:' + Math.round(v * 100) + ';--c:' + (color || 'var(--teal)') + '"><span>' + label + '</span></div><small>' + sub + '</small></div>';
  }

  function render(view) {
    var Store = CT.Store, Coach = CT.Coach, D = CT.Data;
    var plan = Coach.dailyPlan(), totals = Store.totals(), tier = Coach.tierInfo();
    var lines = D.openingLines.filter(function (l) { return !l.lessonOnly; });
    var learned = lines.filter(function (l) { return Coach.openingStatus(l).key !== 'new'; }).length;
    var rating = Store.state.profile.rating;
    var ms = CT.Milestones.status(), nextM = ms.next;
    var hour = new Date().getHours();
    var greet = hour < 5 ? 'Late-night training' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var streak = Store.streak();
    var newGames = CT.ChessCom ? CT.ChessCom.pending() : [];
    var ccBanner = newGames.length ? '<a class="card cc-banner" href="#/analysis/games"><strong>📥 ' + newGames.length + ' new chess.com game' + (newGames.length > 1 ? 's' : '') + '</strong><span class="small muted">Review them — your mistakes become tomorrow\'s training.</span><span class="btn small primary">Review</span></a>' : '';

    var items = plan.items.map(function (it) {
      var locked = it.needs === 'game' && !(Store.today().games);
      return { icon: it.icon, title: it.title, sub: it.sub + (it.mins ? ' · ~' + it.mins + ' min' : ''), p: it.target ? it.done / it.target : 0, href: it.href, cta: locked ? 'After the game' : it.cta, locked: locked };
    });
    var firstOpen = plan.items.filter(function (it) { return it.done < it.target && !(it.needs === 'game' && !Store.today().games); })[0];
    var firstHref = firstOpen ? firstOpen.href : '#/tactics/train';
    var dayHead = '<div class="day-type"><span class="chip on">' + (plan.type === 'play' ? '♟ Play day' : '📘 Study day') + '</span>' +
      '<span class="small muted">' + (plan.type === 'play' ? 'Warm up, play one serious game, then learn from it.' : 'Tactics, endgames and traps — no game needed today.') + '</span>' +
      '<button class="btn small" data-act="swap-day">Switch to ' + (plan.type === 'play' ? 'Study' : 'Play') + ' day</button></div>';
    var planHtml = items.map(function (it) {
      var done = it.p >= 1;
      return '<a class="plan-row' + (done ? ' done' : '') + (it.locked ? ' locked' : '') + '" href="' + it.href + '"><span class="plan-ico">' + (done ? '✓' : it.icon) + '</span>' +
        '<span class="plan-main"><strong>' + it.title + '</strong><small>' + esc(it.sub) + '</small>' + UI.bar(Math.min(1, it.p)) + '</span>' +
        '<span class="btn small' + (done ? '' : ' primary') + '">' + (done ? 'More' : it.cta) + '</span></a>';
    }).join('');

    var days = [], max = 1;
    for (var i = 13; i >= 0; i--) {
      var t = Date.now() - i * 86400000, k = Store.dayKey(t), d = Store.state.days[k] || {};
      var n = (d.puzzles || 0) + (d.drills || 0) + (d.quiz || 0) + (d.lab || 0) + (d.games || 0);
      max = Math.max(max, n);
      days.push({ n: n, label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), today: i === 0 });
    }
    var chart = '<div class="spark">' + days.map(function (d) {
      return '<div class="spark-col' + (d.today ? ' today' : '') + '" title="' + d.n + ' exercises"><div class="spark-bar" style="height:' + Math.max(4, Math.round(d.n / max * 100)) + '%"></div><small>' + d.label + '</small></div>';
    }).join('') + '</div>';

    var weakList = plan.weakest.filter(function (w) { return w.accuracy != null && w.accuracy < 0.85; });
    var weak = weakList.length ? weakList.map(function (w) {
      return '<a class="chip warn" href="#/tactics/theme/' + w.theme + '">' + esc(w.name) + ' · ' + UI.pct(w.accuracy) + '</a>';
    }).join('') : '<span class="muted small">' + (plan.weakest.length ? 'No weak spots right now — every theme you have tried is above 85%.' : 'Solve a few puzzles and your weak spots will appear here.') + '</span>';

    var recent = Store.state.log.slice(-6).reverse().map(function (e) {
      var name = e.kind === 'puzzle' ? ((Coach.puzzleById(e.id) || {}).title || e.id) :
        e.kind === 'practice' ? ((CT.Opponent.STYLES[e.id] || {}).name || e.id) + ' (level ' + e.level + ')' + (e.ok ? ' — won' : '') :
        e.kind === 'test' ? 'Milestone ' + ((CT.Milestones.byId(e.id) || {}).rating || '') + ' test — ' + Math.round((e.score || 0) * 100) + '%' :
        e.kind === 'threat' ? ((D.threats.find(function (h) { return h.id === e.id; }) || {}).title || e.id) : ((Coach.lineById(e.id) || {}).name || e.id);
      var kindLabel = { puzzle: 'Puzzle', quiz: 'Opening quiz', threat: 'Hidden threat', practice: 'Practice game', test: 'Skill test' }[e.kind] || 'Opening drill';
      var when = new Date(e.t);
      return '<li><span class="dot ' + (e.ok ? 'ok' : 'bad') + '"></span><span>' + kindLabel + ': ' + esc(name) + '</span><span class="muted small">' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '</span></li>';
    }).join('');

    var pc = Store.state.practiceCurrent, resume = pc ? '<a class="card resume-card" href="#/practice/play"><span class="quick-ico">♟</span><span><strong>Game in progress</strong><small>vs ' + esc(CT.Opponent.STYLES[pc.style].name) + ' · level ' + pc.level + ' · ' + pc.moves.length + ' half-moves played</small></span><span class="btn small primary">Resume</span></a>' : '';
    view.innerHTML = resume + ccBanner +
      '<section class="hero">' +
        '<div class="hero-text"><p class="eyebrow">' + greet + '</p><h1>Train like a trickster —<br>calculate like a defender.</h1>' +
        '<p class="muted">Rating ~' + rating + ' · ' + (ms.current ? 'Milestone reached: <strong>' + ms.current.m.rating + '</strong>' : 'No milestone reached yet') + (nextM ? ' → working toward <strong>' + nextM.m.rating + '</strong> (' + nextM.done + '/' + nextM.total + ')' : '') + ' · Tactics tier ' + tier.tier + ' · ' + plan.minutes + '-minute session</p>' +
        '<div class="btn-row"><a class="btn primary big" href="' + firstHref + '">Start today\'s training</a><a class="btn big" href="#/lab/threats">Hidden-threat drill</a></div></div>' +
        '<div class="hero-rings">' +
          ring(totals.firstTryRate, UI.pct(totals.firstTryRate), 'tactics accuracy', 'var(--teal)') +
          ring(lines.length ? learned / lines.length : 0, learned + '/' + lines.length, 'opening lines', 'var(--accent)') +
          ring(Math.min(1, streak / 7), String(streak), 'day streak', '#e2725b') +
        '</div>' +
      '</section>' +
      '<section class="grid-2">' +
        '<div class="card"><div class="row-between"><h2>Today\'s plan</h2><span class="small muted">' + plan.minutes + ' min</span></div>' + dayHead + planHtml +
          '<a class="plan-row" href="#/analysis"><span class="plan-ico">⌕</span><span class="plan-main"><strong>Review a real game</strong><small>Played a rapid game on chess.com? Paste it here for a coach report.</small></span><span class="btn small">Analyse</span></a></div>' +
        '<div class="card"><h2>Last 14 days</h2>' + chart +
          '<h3 class="mt">Weak spots</h3><div class="chips">' + weak + '</div>' +
          '<h3 class="mt">Tier progress</h3><p class="small">' + (tier.tier < 4 ? esc(tier.need) + ' <span class="muted">Now ' + UI.pct(tier.recentAtTier ? tier.accuracyAtTier : null) + ' over ' + tier.recentAtTier + '.</span>' : 'All four tactical tiers unlocked.') + '</p></div>' +
      '</section>' +
      insightsCard() +
      '<section class="quick-grid">' +
        tile('#/tactics', '⚔', 'Tactical Academy', D.puzzles.length + ' verified puzzles') +
        tile('#/openings', '♘', 'Opening Academy', D.openingLines.length + ' lines · explore, spar, quiz') +
        tile('#/practice', '♟', 'Practice', '7 opponent styles · 8 levels') +
        tile('#/endgames', '♚', 'Endgame Academy', '5 exact drills · Convert the Win') +
        tile('#/analysis', '⌕', 'Game Analysis', CT.Games.list().length + ' saved games · coach reports') +
      '</section>' +
      '<section class="grid-2">' +
        milestoneCard(nextM) +
        '<div class="card"><h2>Recent activity</h2>' + (recent ? '<ul class="recent">' + recent + '</ul>' : '<p class="muted">Nothing yet — start with today\'s tactics.</p>') + '</div>' +
      '</section>' +
      (CT.Store.memoryOnly ? '<p class="warnbox">Your browser is blocking storage, so progress will not be saved after you close this page.</p>' : '');
    var sw = view.querySelector('[data-act="swap-day"]');
    if (sw) sw.addEventListener('click', function () { Coach.setDayType(plan.type === 'play' ? 'study' : 'play'); render(view); });
  }

  function milestoneCard(nm) {
    if (!nm) return '<div class="card"><h2>All milestones reached</h2><p>Remarkable. Keep playing and reviewing games.</p></div>';
    var open = nm.checks.filter(function (c) { return !c.ok; }).slice(0, 4);
    return '<div class="card milestone-card"><div class="row-between"><h2>Next milestone: ' + nm.m.rating + '</h2><span class="small muted">' + nm.done + '/' + nm.total + '</span></div>' +
      '<p class="small"><strong>' + esc(nm.m.title) + '.</strong> ' + esc(nm.m.focus) + '</p>' + UI.bar(nm.done / nm.total) +
      '<ul class="checklist small">' + open.map(function (c) { return '<li>' + (c.href ? '<a href="' + c.href + '">' + esc(c.label) + '</a>' : esc(c.label)) + ' <span class="muted">— ' + esc(c.have) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="small muted">Habit: before every move, ask what your opponent\'s last move threatens and what you are leaving undefended. <a href="#/progress">All milestones →</a></p></div>';
  }

  function insightsCard() {
    var p = CT.Games.patterns(10);
    if (!p.insights.length) return '';
    return '<section class="card insights-card"><h2>From your games</h2><ul class="insights">' + p.insights.slice(0, 3).map(function (i) {
      var link = i.theme ? '#/tactics/train/' + i.theme : i.href;
      return '<li><p>' + esc(i.text) + '</p>' + (link ? '<a class="btn small" href="' + link + '">Train it</a>' : '') + '</li>';
    }).join('') + '</ul></section>';
  }

  function tile(href, icon, title, sub) {
    return '<a class="card quick" href="' + href + '"><span class="quick-ico">' + icon + '</span><span><strong>' + title + '</strong><small>' + esc(sub) + '</small></span></a>';
  }

  CT.Views = CT.Views || {};
  CT.Views.dashboard = render;
})(window);
