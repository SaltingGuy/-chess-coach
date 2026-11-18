/* app.js — navigation and routing (hash-based, so the app works from a file or any static host). */
(function (root) {
  'use strict';
  var CT = root.CT, V = CT.Views;

  var NAV = [
    { href: '#/', label: 'Dashboard', icon: '⌂', match: /^\/?$/ },
    { href: '#/openings', label: 'Openings', icon: '♘', match: /^\/openings/ },
    { href: '#/tactics', label: 'Tactics', icon: '⚔', match: /^\/tactics/ },
    { href: '#/lab', label: 'Deception Lab', icon: '◈', match: /^\/lab/ },
    { href: '#/endgames', label: 'Endgames', icon: '♚', match: /^\/endgames/ },
    { href: '#/analysis', label: 'Game Analysis', icon: '⌕', match: /^\/analysis/ },
    { href: '#/practice', label: 'Practice', icon: '♟', match: /^\/practice/ },
    { href: '#/board', label: 'Board', icon: '▦', match: /^\/board/ },
    { href: '#/progress', label: 'Progress', icon: '↗', match: /^\/progress/ }
  ];
  var MOBILE = ['#/', '#/tactics', '#/openings', '#/practice', '#/analysis'];

  var PLACEHOLDERS = {};

  var cleanup = null;

  function buildNav() {
    var side = document.querySelector('.sidebar nav'), tab = document.querySelector('.tabbar');
    side.innerHTML = NAV.map(function (n) { return '<a href="' + n.href + '"><span class="ico">' + n.icon + '</span>' + n.label + '</a>'; }).join('');
    tab.innerHTML = NAV.filter(function (n) { return MOBILE.indexOf(n.href) >= 0; }).map(function (n) {
      return '<a href="' + n.href + '"><span class="ico">' + n.icon + '</span><small>' + n.label.split(' ')[0] + '</small></a>';
    }).join('') + '<button type="button" class="more-btn"><span class="ico">⋯</span><small>More</small></button>';
    tab.querySelector('.more-btn').addEventListener('click', function () { document.body.classList.toggle('show-more'); });
    document.querySelector('.more-sheet').innerHTML = NAV.filter(function (n) { return MOBILE.indexOf(n.href) < 0; }).map(function (n) {
      return '<a href="' + n.href + '"><span class="ico">' + n.icon + '</span>' + n.label + '</a>';
    }).join('') + '<div class="toggles"></div>';
    renderToggles();
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-toggle]');
      if (!t) return;
      var key = t.dataset.toggle, prof = CT.Store.state.profile;
      prof[key] = !(key === 'squareNames' ? !!prof[key] : prof[key] !== false);
      CT.Store.save();
      renderToggles();
      if (key === 'sound' && prof.sound) CT.Sound.play('good');
      if (key === 'voice') {
        if (prof.voice && !CT.Voice.supported()) { CT.UI.toast('This browser has no built-in speech voice.'); return; }
        if (prof.voice) CT.Voice.say('Voice coach on. I will talk you through your training.', { force: true }); else CT.Voice.stop();
      }
      if (key === 'squareNames') route();
      CT.UI.toast(t.dataset.label + (prof[key] ? ' on' : ' off'));
    });
  }

  var TOGGLES = [['voice', '🗣', 'Voice coach'], ['sound', '🔊', 'Sound effects'], ['squareNames', '🔤', 'Square names'], ['autoArrows', '➶', 'Idea arrows']];
  function renderToggles() {
    var prof = CT.Store.state.profile;
    var html = TOGGLES.map(function (t) {
      var on = t[0] === 'squareNames' ? !!prof[t[0]] : prof[t[0]] !== false;
      return '<button type="button" class="toggle' + (on ? ' on' : '') + '" data-toggle="' + t[0] + '" data-label="' + t[2] + '" aria-pressed="' + on + '" title="' + t[2] + '"><span>' + t[1] + '</span><small>' + t[2] + '</small><i></i></button>';
    }).join('');
    document.querySelectorAll('.toggles').forEach(function (el) { el.innerHTML = html; });
  }

  function route() {
    var path = (location.hash || '#/').slice(1) || '/';
    var parts = path.split('/').filter(Boolean);
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    document.body.classList.remove('show-more');
    var main = document.getElementById('main');
    var view = document.createElement('div');
    view.className = 'view';
    main.innerHTML = '';
    if (CT.Session) main.appendChild(CT.Session.barEl()); // the guided-session bar sits above every screen
    main.appendChild(view);
    document.querySelectorAll('.sidebar nav a, .tabbar a').forEach(function (a) {
      var n = NAV.find(function (x) { return x.href === a.getAttribute('href'); });
      a.classList.toggle('active', !!(n && n.match.test(path)));
    });
    try {
      var p0 = parts[0];
      if (!p0) V.dashboard(view);
      else if (p0 === 'openings' && parts[1] === 'explore') V.openingExplorer(view, parts[2]);
      else if (p0 === 'openings' && parts[1] === 'spar') cleanup = V.openingSpar(view, parts[2]);
      else if (p0 === 'openings' && parts[1] === 'quiz') V.openingQuiz(view, parts[2] || 'all');
      else if (p0 === 'openings' && parts[1]) cleanup = V.openingLesson(view, parts[1], parts[2] === 'drill' ? 'drill' : 'learn');
      else if (p0 === 'openings') V.openings(view);
      else if (p0 === 'tactics' && parts[1] === 'woodpecker' && parts[2] === 'go') cleanup = V.tacticsTrainer(view, { woodpecker: true });
      else if (p0 === 'tactics' && parts[1] === 'woodpecker') V.woodpecker(view);
      else if (p0 === 'tactics' && parts[1] === 'warmup') cleanup = V.tacticsTrainer(view, { warmup: true });
      else if (p0 === 'tactics' && parts[1] === 'mine') cleanup = V.tacticsTrainer(view, { mine: true });
      else if (p0 === 'tactics' && parts[1] === 'focus') cleanup = V.tacticsTrainer(view, { stretch: true });
      else if (p0 === 'session') V.session(view);
      else if (p0 === 'tactics' && parts[1] === 'train') cleanup = V.tacticsTrainer(view, { theme: parts[2] || null });
      else if (p0 === 'tactics' && parts[1] === 'p') cleanup = V.tacticsTrainer(view, { id: parts[2] });
      else if (p0 === 'tactics' && parts[1] === 'theme') V.tacticsTheme(view, parts[2]);
      else if (p0 === 'tactics' && parts[1] === 'testout') cleanup = V.testOut(view, parts[2]);
      else if (p0 === 'tactics' && parts[1] === 'danger') V.danger(view);
      else if (p0 === 'tactics') V.tactics(view);
      else if (p0 === 'endgames' && parts[1] === 'convert') V.endgameConvert(view);
      else if (p0 === 'endgames' && parts[1]) cleanup = V.endgameDrill(view, parts[1]);
      else if (p0 === 'endgames') V.endgames(view);
      else if (p0 === 'board') V.freeboard(view);
      else if (p0 === 'analysis' && parts[1] === 'game') cleanup = V.analysisGame(view, parts[2], parts[3]);
      else if (p0 === 'analysis' && parts[1] === 'games') V.analysisGames(view);
      else if (p0 === 'analysis' && parts[1] === 'patterns') V.analysisPatterns(view);
      else if (p0 === 'analysis') V.analysisImport(view);
      else if (p0 === 'lab' && parts[1] === 'threats') V.labThreats(view);
      else if (p0 === 'lab' && parts[1] === 'drills') V.trapDrills(view);
      else if (p0 === 'lab' && parts[1] === 'drill') V.trapDrill(view, parts[2]);
      else if (p0 === 'lab' && parts[1] === 'trap') cleanup = V.labTrap(view, parts[2]);
      else if (p0 === 'lab') V.lab(view);
      else if (p0 === 'practice' && parts[1] === 'play') cleanup = V.practicePlay(view);
      else if (p0 === 'practice') cleanup = V.practice(view);
      else if (p0 === 'progress' && parts[1] === 'test') cleanup = V.skillTest(view, parts[2]);
      else if (p0 === 'progress') V.progress(view);
      else if (PLACEHOLDERS[p0]) V.placeholder(view, PLACEHOLDERS[p0]);
      else view.innerHTML = '<h1>Page not found</h1><p><a href="#/">Go to the dashboard</a></p>';
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="warnbox"><h2>Something went wrong</h2><p>' + CT.UI.esc(err.message) + '</p><p><a href="#/">Back to the dashboard</a></p></div>';
    }
    renderToggles();
    if (CT.Session) CT.Session.renderBar();
    main.scrollTop = 0; root.scrollTo(0, 0);
    if (typeof cleanup !== 'function') cleanup = null;
  }

  CT.App = { rerender: route };

  document.addEventListener('DOMContentLoaded', function () {
    if (CT.Games) CT.Games.mergeGamePuzzles();
    buildNav();
    root.addEventListener('hashchange', route);
    route();
    if (CT.ChessCom) CT.ChessCom.autoStart();
  });
})(window);
