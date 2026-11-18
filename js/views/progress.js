/* Progress & settings: statistics, milestones overview, backup/restore, upcoming features. */
(function (root) {
  'use strict';
  var CT = root.CT, UI = CT.UI, esc = UI.esc;

  function progress(view) {
    var Store = CT.Store, D = CT.Data, Coach = CT.Coach;
    var stats = Store.themeStats(D.themes), totals = Store.totals();
    var days = Object.keys(Store.state.days).sort().slice(-14);
    var themeRows = Object.keys(D.themes).map(function (k) {
      var s = stats[k];
      return '<tr><td><a href="#/tactics/theme/' + k + '">' + esc(D.themes[k].name) + '</a></td><td>' + s.attempts + '</td><td>' + UI.pct(s.accuracy) + '</td><td>' + UI.pct(s.recentAccuracy) + '</td></tr>';
    }).join('');
    var lineRows = D.openingLines.map(function (l) {
      var r = Store.state.openings[l.id], st = Coach.openingStatus(l);
      return '<tr><td><a href="#/openings/' + l.id + '/learn">' + esc(l.name) + '</a></td><td><span class="tag ' + st.key + '">' + st.label + '</span></td><td>' + (r ? r.clean + '/' + r.drills : '0/0') + '</td><td>' +
        (r && r.due && !l.lessonOnly ? new Date(r.due).toLocaleDateString() : '—') + '</td></tr>';
    }).join('');
    var dayRows = days.length ? days.reverse().map(function (k) {
      var d = Store.state.days[k];
      return '<tr><td>' + k + '</td><td>' + d.correct + '/' + d.puzzles + '</td><td>' + d.cleanDrills + '/' + d.drills + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="muted">No training yet.</td></tr>';
    var p = Store.state.profile;

    view.innerHTML = '<header class="page-head"><div><h1>Progress</h1><p class="muted">' + totals.puzzlesSolved + ' puzzles solved · ' + UI.pct(totals.firstTryRate) + ' first-try accuracy · ' + Store.streak() + '-day streak</p></div></header>' + milestonesHtml() + practiceHtml() +
      '<section class="grid-2"><div class="card"><h2>Tactics by theme</h2><table class="tbl"><thead><tr><th>Theme</th><th>Tries</th><th>All-time</th><th>Recent</th></tr></thead><tbody>' + themeRows + '</tbody></table></div>' +
      '<div class="card"><h2>Opening lines</h2><table class="tbl"><thead><tr><th>Line</th><th>Status</th><th>Clean</th><th>Next review</th></tr></thead><tbody>' + lineRows + '</tbody></table></div></section>' +
      '<section class="grid-2"><div class="card"><h2>Last 14 days</h2><table class="tbl"><thead><tr><th>Day</th><th>Puzzles right</th><th>Clean drills</th></tr></thead><tbody>' + dayRows + '</tbody></table></div>' +
      '<div class="card"><h2>Settings</h2>' +
        '<label class="field">Your current online rating (approx.)<input type="number" min="100" max="3000" step="10" class="rating" value="' + p.rating + '"></label>' +
        '<label class="field">Daily session length<select class="mins">' + [30, 45, 60].map(function (m) { return '<option value="' + m + '"' + (p.sessionMinutes === m ? ' selected' : '') + '>' + m + ' minutes</option>'; }).join('') + '</select></label>' +
        '<button class="btn" data-act="savesettings">Save settings</button>' +
        '<h3 class="mt">Board &amp; sound</h3><div class="toggles inline"></div>' +
        '<h3 class="mt">Voice coach</h3><div class="voice-box"></div>' +
        '<h3 class="mt">Backup</h3><p class="small muted">Progress is stored in this browser only. Download a backup (training progress and your saved games) to move it to another device (for example from your Chromebook to your phone).</p>' +
        '<div class="btn-row"><button class="btn" data-act="export">Download backup</button><button class="btn" data-act="copybackup">Copy backup text</button><label class="btn file-btn">Restore from file<input type="file" accept=".json,application/json" class="restore" hidden></label></div>' +
        '<details class="tool"><summary>Restore by pasting backup text</summary><textarea class="paste-backup" rows="4" spellcheck="false" placeholder="Paste the backup text here"></textarea><div class="btn-row"><button class="btn small" data-act="pasterestore">Restore</button></div></details>' +
        '<h3 class="mt">Reset</h3><div class="reset-zone"><button class="btn danger" data-act="reset">Erase all progress…</button></div>' +
      '</div></section>' +
      '';

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'savesettings') {
        var r = parseInt(view.querySelector('.rating').value, 10);
        if (!(r >= 100 && r <= 3000)) { UI.toast('Enter a rating between 100 and 3000.'); return; }
        Store.state.profile.rating = r;
        Store.state.profile.sessionMinutes = parseInt(view.querySelector('.mins').value, 10);
        Store.save(); UI.toast('Settings saved'); CT.App.rerender();
      }
      if (a === 'voicetest') CT.Voice.say('Knight to f3. Before every move, ask: what does my opponent threaten?', { force: true });
      if (a === 'export') UI.download('chess-trainer-backup-' + Store.dayKey() + '.json', Store.exportJSON(), 'application/json');
      if (a === 'copybackup') UI.copy(Store.exportJSON());
      if (a === 'pasterestore') {
        try { Store.importJSON(view.querySelector('.paste-backup').value); UI.toast('Backup restored'); CT.App.rerender(); }
        catch (err) { UI.toast(err.message.indexOf('JSON') >= 0 ? 'That text is not a valid backup.' : err.message); }
      }
      if (a === 'reset') {
        view.querySelector('.reset-zone').innerHTML = '<p class="bad">Erase ALL training progress in this browser? This cannot be undone.</p>' +
          '<div class="btn-row"><button class="btn danger" data-act="reset-yes">Yes, erase everything</button><button class="btn" data-act="reset-no">Cancel</button></div>';
      }
      if (a === 'reset-no') CT.App.rerender();
      if (a === 'reset-yes') { Store.reset(); UI.toast('Progress erased'); CT.App.rerender(); }
    });
    var vbox = view.querySelector('.voice-box'), elVoices = null;
    function voiceHtml() {
      var V = CT.Voice, pr = Store.state.profile, want = pr.voiceProvider || 'auto', el = want === 'elevenlabs', u = V.usage();
      var opts = [['auto', 'Best available (recommended)'], ['claude', 'Claude voice'], ['browser', 'Device voice'], ['elevenlabs', 'ElevenLabs (your account)']];
      var h = '<label class="field">Voice source<select class="voice-provider">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (want === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<p class="small">Now speaking with: <strong>' + ({ claude: 'the Claude voice', elevenlabs: 'ElevenLabs', browser: 'your device\'s voice' })[V.provider()] + '</strong></p>';
      if (want === 'auto' || want === 'claude') {
        h += V.claudeReady() ? '<h4 class="mt">Claude voice</h4><p class="small muted">Natural voices from claude.ai, free, nothing to set up. Tap ▶ to hear one, then <strong>Use</strong>.</p><div class="voice-gallery">' + V.claudeVoices.map(function (v) {
            var on = v.id === (pr.claudeVoice || 'buttery');
            return '<div class="vg-item' + (on ? ' on' : '') + '"><div class="vg-text"><strong>' + esc(v.name) + '</strong></div><button class="btn small" data-act="cl-preview" data-id="' + v.id + '" aria-label="Hear ' + esc(v.name) + '">▶</button><button class="btn small' + (on ? ' primary' : '') + '" data-act="cl-use" data-id="' + v.id + '">' + (on ? 'In use' : 'Use') + '</button></div>';
          }).join('') + '</div>'
          : '<p class="small muted">The Claude voice is not available here (it works in Chrome on claude.ai, not in Safari or the Claude mobile apps), so the device voice is used.</p>';
      } else if (!el) {
        h += V.browserSupported() ? '<p class="small muted">Uses your device\'s built-in speech. Quality depends on the device; Google voices on Android and Chromebooks usually sound best.</p>' +
          '<label class="field">Voice<select class="voice-name"></select></label>' : '<p class="small muted">This browser has no built-in speech. Choose ElevenLabs to use your own account.</p>';
      } else {
        if (V.claudeReady()) h += '<p class="warnbox small"><strong>ElevenLabs can\'t be used inside claude.ai.</strong> Pages hosted on claude.ai are not allowed to contact other websites, so the coach uses the Claude voice instead. ElevenLabs works on your own app website (GitHub Pages) — set it up there. Here, choose <em>Best available</em>.</p>';
        h += '<p class="small">Uses your ElevenLabs credits. Lines are cached on this device, so repeats are free.</p>' +
          '<details class="tool small"><summary>How to create a safe key (recommended)</summary><ol><li>On elevenlabs.io open <strong>Developers → API keys → Create key</strong>.</li><li>Give it only <strong>Text to Speech</strong> (and <strong>Voices: read</strong> if you want your own voices listed).</li><li>Set a <strong>credit limit</strong> for the key, for example 20,000 a month.</li><li>Copy it and paste it below. Never share it in chats or messages.</li></ol></details>' +
          (V.hasKey() ? '<p class="small good">✓ Key saved on this device (hidden). It is not included in backups.</p><div class="btn-row"><button class="btn small" data-act="el-remove">Remove key</button></div>' :
            '<label class="field">API key<input type="password" class="el-key" autocomplete="off" spellcheck="false" placeholder="Paste your ElevenLabs API key"></label><div class="btn-row"><button class="btn small primary" data-act="el-save">Save key</button></div>') +
          '<label class="field">Voice quality<select class="el-model">' + V.elevenModels.map(function (m) { return '<option value="' + m.id + '"' + ((pr.elevenModel || 'eleven_v4') === m.id ? ' selected' : '') + '>' + esc(m.name) + (m.credits === 1 ? ' — 1 credit per character' : m.credits === 0.5 ? ' — half a credit per character' : ' — newest; see ElevenLabs pricing for cost') + '</option>'; }).join('') + '</select></label>' +
          (V.lastModel() && V.lastModel() !== (pr.elevenModel || 'eleven_v4') ? '<p class="small muted">Your plan did not accept that quality level, so the coach is using ' + esc((V.elevenModels.find(function (m) { return m.id === V.lastModel(); }) || {}).name || V.lastModel()) + '.</p>' : '') +
          '<h4 class="mt">Choose a voice</h4><p class="small muted">Tap ▶ to hear a free sample (previews use no credits), then tap <strong>Use</strong>.</p>' +
          '<div class="voice-gallery">' + (elVoices || V.elevenVoices).map(function (v) {
            var on = v.id === (pr.elevenVoice || V.elevenVoices[0].id);
            return '<div class="vg-item' + (on ? ' on' : '') + '"><div class="vg-text"><strong>' + esc(v.name) + '</strong>' + (v.desc ? '<small>' + esc(v.desc) + '</small>' : '') + '</div>' +
              (v.preview ? '<button class="btn small" data-act="el-preview" data-url="' + esc(v.preview) + '" aria-label="Play a sample of ' + esc(v.name) + '">▶</button>' : '') +
              '<button class="btn small' + (on ? ' primary' : '') + '" data-act="el-use" data-id="' + esc(v.id) + '">' + (on ? 'In use' : 'Use') + '</button></div>';
          }).join('') + '</div>' +
          (V.hasKey() && !elVoices ? '<div class="btn-row"><button class="btn small" data-act="el-voices">Show all voices on my account</button></div>' : '') +
          '<p class="small muted">Want more choice? Add voices from the ElevenLabs Voice Library to "My Voices" on their site, then press "Show all voices" again.</p>' +
          '<p class="small muted">This month on this device: ' + u.chars.toLocaleString() + ' characters sent to ElevenLabs, ' + u.cached.toLocaleString() + ' played from cache for free. Your exact credit use is on the ElevenLabs website.</p>' +
          (V.lastError() ? '<p class="small bad">Last problem: ' + esc(V.lastError()) + '. The device voice is being used for now. <button class="btn small" data-act="el-retry">Try ElevenLabs again</button></p>' : '');
      }
      h += '<label class="field">Speed<select class="voice-rate">' + [[0.85, 'Slower'], [1, 'Normal'], [1.15, 'Faster']].map(function (r) { return '<option value="' + r[0] + '"' + ((+pr.voiceRate || 1) === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">How much the coach says<select class="voice-detail"><option value="full"' + (pr.voiceDetail !== 'short' ? ' selected' : '') + '>Full explanations</option><option value="short"' + (pr.voiceDetail === 'short' ? ' selected' : '') + '>Short (first sentence only — saves credits)</option></select></label>' +
        '<div class="btn-row"><button class="btn small" data-act="voicetest">Test the voice</button></div>';
      vbox.innerHTML = h;
      fillVoices();
      if (el && V.hasKey() && !V.claudeReady() && !elVoices && !voicesTried) { voicesTried = true; loadVoices(); }
    }
    var voicesTried = false, previewEl = null;
    function loadVoices(btn) {
      return CT.Voice.loadElevenVoices().then(function (list) {
        if (list.length) { elVoices = list; voiceHtml(); }
        if (btn) UI.toast(list.length + ' voices loaded');
      }, function (err) { if (btn) { btn.textContent = 'Show all voices on my account'; UI.toast('Could not load voices: ' + err.message); } });
    }
    function fillVoices() {
      var vsel = view.querySelector('.voice-name');
      if (!vsel) return;
      var cur = Store.state.profile.voiceName || '';
      vsel.innerHTML = '<option value="">Automatic (best available)</option>' + CT.Voice.voices().map(function (v) {
        return '<option value="' + esc(v.name) + '"' + (v.name === cur ? ' selected' : '') + '>' + esc(v.name) + ' (' + esc(v.lang) + ')</option>';
      }).join('');
    }
    voiceHtml();
    CT.Voice.onClaudeReady(function () { if (document.body.contains(vbox)) voiceHtml(); });
    if (root.speechSynthesis && root.speechSynthesis.addEventListener) root.speechSynthesis.addEventListener('voiceschanged', fillVoices);
    vbox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.dataset.act;
      if (a === 'el-save') {
        var k = (view.querySelector('.el-key') || {}).value || '';
        if (k.trim().length < 20) { UI.toast('That does not look like an ElevenLabs API key.'); return; }
        CT.Voice.setKey(k); UI.toast('Key saved on this device'); voiceHtml();
        CT.Voice.say('Hello! I am your chess coach. Let us get to work.', { force: true });
      }
      if (a === 'el-remove') { CT.Voice.setKey(''); elVoices = null; UI.toast('Key removed'); voiceHtml(); }
      if (a === 'el-retry') { CT.Voice.resetError(); voiceHtml(); CT.Voice.say('Trying ElevenLabs again.', { force: true }); }
      if (a === 'el-voices') { b.textContent = 'Loading…'; loadVoices(b); }
      if (a === 'cl-preview') { CT.Voice.stop(); var keep = Store.state.profile.claudeVoice; Store.state.profile.claudeVoice = b.dataset.id; CT.Voice.say('Hi! I will be your chess coach. Knight takes e5, check!', { force: true }); Store.state.profile.claudeVoice = keep; }
      if (a === 'cl-use') { Store.state.profile.claudeVoice = b.dataset.id; Store.save(); voiceHtml(); CT.Voice.say('Great. Before every move, ask yourself: what does my opponent threaten?', { force: true }); }
      if (a === 'el-preview') {
        CT.Voice.stop();
        try { if (previewEl) previewEl.pause(); previewEl = new root.Audio(b.dataset.url); previewEl.play(); } catch (err) { UI.toast('Could not play the sample.'); }
      }
      if (a === 'el-use') {
        if (previewEl) try { previewEl.pause(); } catch (err) { /* ignore */ }
        Store.state.profile.elevenVoice = b.dataset.id; Store.save(); voiceHtml();
        CT.Voice.say('Nice choice. Before every move, ask yourself: what does my opponent threaten?', { force: true });
      }
    });
    view.addEventListener('change', function (e) {
      var pr = Store.state.profile;
      if (e.target.matches('.voice-provider')) { pr.voiceProvider = e.target.value; Store.save(); CT.Voice.resetError(); voiceHtml(); }
      if (e.target.matches('.voice-name')) { pr.voiceName = e.target.value; Store.save(); CT.Voice.say('This is my voice.', { force: true }); }
      if (e.target.matches('.el-model')) { pr.elevenModel = e.target.value; Store.save(); CT.Voice.resetError(); voiceHtml(); CT.Voice.say('This is how I sound now. Knight takes e5, check!', { force: true }); }
      if (e.target.matches('.voice-rate')) { pr.voiceRate = +e.target.value; Store.save(); CT.Voice.say('This is my speed.', { force: true }); }
      if (e.target.matches('.voice-detail')) { pr.voiceDetail = e.target.value; Store.save(); }
    });
    view.querySelector('.restore').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        try { Store.importJSON(txt); UI.toast('Backup restored'); CT.App.rerender(); }
        catch (err) { UI.toast(err.message); }
      });
    });
  }

  function milestonesHtml() {
    var st = CT.Milestones.status();
    return '<section class="card"><h2>Rating milestones</h2><p class="small muted">Learning goals, not guaranteed ratings. A milestone is reached only when you can apply the skill: tactics accuracy, a timed skill test, practice-game wins (Stockfish opponent, no takebacks) and fewer blunders in your analysed games. Once reached, it stays reached.</p>' +
      '<ol class="ms-list">' + st.list.map(function (s) {
        var cls = s.reached ? 'done' : s === st.next ? 'next' : '';
        var body = '<ul class="ms-reqs">' + s.checks.map(function (c) {
          return '<li class="' + (c.ok ? 'ok' : c.unavailable ? 'na' : '') + '"><span class="ms-tick">' + (c.ok ? '✓' : c.unavailable ? '–' : '○') + '</span><span>' + (c.href && !c.ok ? '<a href="' + c.href + '">' + esc(c.label) + '</a>' : esc(c.label)) + '<small class="muted"> — ' + esc(c.have) + '</small></span></li>';
        }).join('') + '</ul>';
        return '<li class="' + cls + '"><details' + (s === st.next ? ' open' : '') + '><summary><strong>' + s.m.rating + '</strong> — ' + esc(s.m.title) + ' <span class="small muted">' + (s.reached ? 'reached ' + new Date(CT.Store.state.milestones[s.m.id]).toLocaleDateString() : s.done + '/' + s.total) + '</span></summary>' +
          '<p class="small">' + esc(s.m.focus) + '</p>' + body + '</details></li>';
      }).join('') + '</ol></section>';
  }

  function practiceHtml() {
    var st = CT.Coach.practiceStats(), O = CT.Opponent;
    var rows = O.STYLE_ORDER.map(function (k) {
      var r = st[k];
      return '<tr><td>' + O.STYLES[k].icon + ' ' + esc(O.STYLES[k].name) + '</td><td>' + (r ? r.games : 0) + '</td><td>' + (r ? r.w + ' / ' + r.l + ' / ' + r.d : '—') + '</td><td>' + (r && r.best ? r.best : '—') + '</td><td>' + CT.Coach.suggestedLevel(k) + '</td></tr>';
    }).join('');
    var g = CT.Store.state.practice || [];
    var traps = g.reduce(function (a, x) { a.set += x.trapsSet || 0; a.fell += x.trapsFell || 0; a.sl += x.slips || 0; a.pun += x.slipsPunished || 0; return a; }, { set: 0, fell: 0, sl: 0, pun: 0 });
    return '<section class="card"><h2>Practice record</h2><table class="tbl"><thead><tr><th>Opponent</th><th>Games</th><th>W / L / D</th><th>Best clean win (level)</th><th>Suggested level</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (g.length ? '<p class="small mt">Traps: avoided ' + (traps.set - traps.fell) + ' of ' + traps.set + ' · Opponent mistakes punished: ' + traps.pun + ' of ' + traps.sl + '</p>' : '<p class="small muted mt">No practice games yet. <a href="#/practice">Play one</a>.</p>') + '</section>';
  }

  function placeholder(view, info) {
    view.innerHTML = '<header class="page-head"><div><h1>' + esc(info.title) + '</h1><p class="muted">Planned for Phase ' + info.phase + ' — not built yet.</p></div></header>' +
      '<section class="card"><h2>What this section will do</h2><ul>' + info.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      (info.now ? '<h2 class="mt">What you can use today</h2><p>' + info.now + '</p>' : '') + '</section>';
  }

  CT.Views = CT.Views || {};
  CT.Views.progress = progress;
  CT.Views.placeholder = placeholder;
})(window);
