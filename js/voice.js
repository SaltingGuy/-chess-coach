/*
 * voice.js — The voice coach. Uses the speech engine built into the browser (Web Speech API):
 * free, no account, no internet needed on most devices. On Android and Chromebooks it usually
 * offers Google's natural voices. The app has no voice of its own; it borrows the device's.
 *
 * Optional: ElevenLabs voices with the user's own API key (entered in Settings, stored only in this browser,
 * never included in backups). Audio is cached so repeated lines don't use credits twice. If ElevenLabs fails
 * (no internet, bad key, credits used up), the coach falls back to the device voice and says why in Settings.
 *
 * CT.Voice.say(text, {queue})  — speak (interrupts by default; queue:true waits its turn)
 * CT.Voice.spoken(text)        — the text as it will be read aloud (chess notation → words)
 * Settings live in Store.state.profile: voice (on/off), voiceName, voiceRate.
 */
(function (root) {
  'use strict';
  var synth = root.speechSynthesis || null;
  var PIECE = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };

  function prof() { try { return root.CT.Store.state.profile; } catch (e) { return {}; } }
  function browserSupported() { return !!(synth && root.SpeechSynthesisUtterance); }
  function supported() { return browserSupported() || elevenReady() || claudeReady(); }

  /* ---------------- Claude voice (claude.ai's built-in speech for hosted pages) ---------------- */
  var claudeTts = null, claudeOff = false;
  var CLAUDE_VOICES = [
    { id: 'buttery', name: 'Buttery — warm and smooth (default)' },
    { id: 'airy', name: 'Airy — light and bright' },
    { id: 'glassy', name: 'Glassy — clear and crisp' },
    { id: 'rounded', name: 'Rounded — calm and full' }
  ];
  var claudeWaiters = [];
  try {
    if (root.claude && typeof root.claude.use === 'function') {
      root.claude.use('tts').then(function (ns) { claudeTts = ns || null; claudeWaiters.forEach(function (f) { f(); }); claudeWaiters = []; }, function () { claudeTts = null; });
    }
  } catch (e) { claudeTts = null; }
  function claudeReady() { return !!claudeTts && !claudeOff; }
  function onClaudeReady(f) { if (claudeTts) f(); else claudeWaiters.push(f); }
  /** Which voice source is actually in use: 'elevenlabs', 'claude' or 'browser'. */
  function provider() {
    var want = prof().voiceProvider || 'auto';
    // Inside claude.ai (where the Claude voice exists) pages may not contact other websites, so ElevenLabs
    // can only be used when the app is opened from its own copy.
    // On your own website, "Best available" uses ElevenLabs as soon as you have saved a key.
    if ((want === 'elevenlabs' || (want === 'auto' && getKey())) && keyReady() && !elBroken && !claudeReady()) return 'elevenlabs';
    if ((want === 'claude' || want === 'auto' || want === 'elevenlabs') && claudeReady()) return 'claude';
    return 'browser';
  }
  function claudeSay(t, opts) {
    var rate = Math.max(0.7, Math.min(1.5, +prof().voiceRate || 1));
    var p;
    try { p = claudeTts.speak(t.slice(0, 2000), { voice: prof().claudeVoice || 'buttery', rate: rate, language: 'en' }); }
    catch (e) { return browserSay(t, opts); }
    if (p && p.catch) p.catch(function (err) {
      var code = err && err.code;
      if (code === 'not_granted') { claudeOff = true; browserSay(t, opts); }
      // 'replaced' / viewer stopped / busy: nothing to do
    });
    return true;
  }
  function enabled() { return supported() && prof().voice === true; }

  /* ---------------- ElevenLabs (optional, the user's own account) ---------------- */
  var KEY_STORE = 'chess-trainer.tts-key', USAGE_STORE = 'chess-trainer.tts-usage';
  /* Voice quality = ElevenLabs model. If a model is not available on the account, the next one is tried. */
  var EL_MODELS = [
    { id: 'eleven_v4', name: 'Most human (Eleven v4)', credits: null },
    { id: 'eleven_v4_turbo', name: 'Human and quick (Eleven v4 Turbo)', credits: null },
    { id: 'eleven_multilingual_v2', name: 'Natural (Multilingual v2)', credits: 1 },
    { id: 'eleven_flash_v2_5', name: 'Fastest and cheapest (Flash v2.5)', credits: 0.5 }
  ];
  var badModels = {};
  function modelChain() {
    var want = prof().elevenModel || 'eleven_v4', ids = EL_MODELS.map(function (m) { return m.id; });
    var start = Math.max(0, ids.indexOf(want));
    return ids.slice(start).concat(ids.slice(0, start)).filter(function (id) { return !badModels[id]; });
  }
  function voiceSettings(model) {
    // Less "stability" = more natural variation. Newer models take fewer tuning options.
    if (/^eleven_v[34]/.test(model)) return { stability: 0.5, similarity_boost: 0.8 };
    return { stability: 0.4, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };
  }
  var EL_VOICES = [ // ElevenLabs default voices (available on every plan)
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George — warm, British' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel — calm, American' }
  ];
  var elError = '', elBroken = false, lastModel = '';
  function ls() { try { return root.localStorage; } catch (e) { return null; } }
  function getKey() { var l = ls(); return l ? l.getItem(KEY_STORE) || '' : ''; }
  function setKey(k) { var l = ls(); if (!l) return; k = String(k || '').trim(); if (k) l.setItem(KEY_STORE, k); else l.removeItem(KEY_STORE); elBroken = false; elError = ''; }
  function keyReady() { return !!getKey() && typeof root.fetch === 'function' && !!root.Audio; }
  function elevenReady() { var w = prof().voiceProvider || 'auto'; return (w === 'elevenlabs' || (w === 'auto' && !claudeReady())) && keyReady(); }
  function monthKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  function usage() {
    var l = ls(), u = null;
    try { u = JSON.parse((l && l.getItem(USAGE_STORE)) || 'null'); } catch (e) { u = null; }
    if (!u || u.month !== monthKey()) u = { month: monthKey(), chars: 0, cached: 0 };
    return u;
  }
  function addUsage(field, n) { var u = usage(); u[field] += n; var l = ls(); if (l) try { l.setItem(USAGE_STORE, JSON.stringify(u)); } catch (e) { /* ignore */ } }
  function hashText(t) { var h = 5381; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + t.length; }

  var memCache = {}, memOrder = [];
  function cacheGet(url) {
    if (memCache[url]) return Promise.resolve(memCache[url]);
    if (!root.caches) return Promise.resolve(null);
    return root.caches.open('ct-tts-v1').then(function (c) { return c.match(url); }).then(function (r) { return r ? r.blob() : null; }).catch(function () { return null; });
  }
  function cachePut(url, blob) {
    memCache[url] = blob; memOrder.push(url);
    if (memOrder.length > 60) delete memCache[memOrder.shift()];
    if (root.caches) root.caches.open('ct-tts-v1').then(function (c) { return c.put(url, new root.Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })); }).catch(function () { /* ignore */ });
  }

  function elevenAudio(t, chain) {
    chain = chain || modelChain();
    var model = chain[0];
    if (!model) return Promise.reject(new Error('none of the ElevenLabs voice models are available on this account'));
    var voiceId = prof().elevenVoice || EL_VOICES[0].id;
    var rate = Math.max(0.7, Math.min(1.2, +prof().voiceRate || 1));
    var url = 'https://tts-cache.chess-trainer.local/' + voiceId + '/' + model + '/' + rate + '/' + hashText(t);
    var settings = voiceSettings(model);
    if (rate !== 1) settings.speed = rate;
    return cacheGet(url).then(function (hit) {
      if (hit) { addUsage('cached', t.length); return hit; }
      return root.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '?output_format=mp3_44100_128', {
        method: 'POST',
        headers: { 'xi-api-key': getKey(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({ text: t, model_id: model, voice_settings: settings })
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (body) {
            // Model not available (or settings it does not accept): try the next quality level.
            if ((r.status === 400 || r.status === 404 || r.status === 422) && chain.length > 1) {
              badModels[model] = true;
              return elevenAudio(t, chain.slice(1)).then(function (b) { return { retried: b }; });
            }
            var why = r.status === 401 ? 'the API key was refused (check it, and that it has Text to Speech permission)' :
              r.status === 402 || r.status === 429 || /quota|credit/i.test(body) ? 'your ElevenLabs credits or the key\'s limit are used up' :
              'ElevenLabs answered with error ' + r.status;
            throw new Error(why);
          });
        }
        return r.blob();
      }).then(function (blob) {
        if (blob && blob.retried) return blob.retried;
        lastModel = model; addUsage('chars', t.length); cachePut(url, blob); return blob;
      });
    });
  }

  var audioEl = null, token = 0;
  function elevenSay(t, opts) {
    var my = ++token;
    if (audioEl && !opts.queue) { try { audioEl.pause(); } catch (e) { /* ignore */ } }
    return elevenAudio(t).then(function (blob) {
      if (my !== token) return;
      var a = new root.Audio(root.URL.createObjectURL(blob));
      audioEl = a;
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked: ignore this line */ });
    }).catch(function (err) {
      elError = (err && err.message) || 'ElevenLabs could not be reached from this page';
      if (/fetch|network|load failed/i.test(elError)) elError = 'ElevenLabs could not be reached from this page (no internet, or the page is not allowed to contact it)';
      elBroken = true;
      try { root.CT.UI.toast('ElevenLabs voice unavailable: ' + elError + '. Using the ' + (claudeReady() ? 'Claude' : 'device') + ' voice.'); } catch (e) { /* no page to show it on */ }
      if (my === token) { if (claudeReady()) claudeSay(t, opts); else browserSay(t, opts); }
    });
  }

  /** One move in SAN → words: "Nxe5+" → "knight takes e5, check". */
  function sanWords(san) {
    var s = String(san).replace(/[!?]+$/, '');
    var suffix = /#$/.test(s) ? ', checkmate' : /\+$/.test(s) ? ', check' : '';
    s = s.replace(/[+#]$/, '');
    if (s === 'O-O' || s === '0-0') return 'castles kingside' + suffix;
    if (s === 'O-O-O' || s === '0-0-0') return 'castles queenside' + suffix;
    var promo = '', m = s.match(/=([QRBN])$/);
    if (m) { promo = ' promotes to ' + PIECE[m[1]]; s = s.slice(0, -2); }
    var piece = PIECE[s[0]] ? PIECE[s[0]] + ' ' : '';
    if (piece) s = s.slice(1);
    var parts = s.split('x'), out;
    if (parts.length === 2) out = (piece || parts[0].toUpperCase() + ' ') + (piece && parts[0] ? 'from ' + parts[0].toUpperCase() + ' ' : '') + 'takes ' + sq(parts[1]);
    else {
      var dest = s.slice(-2), from = s.slice(0, -2);
      out = piece + (from ? 'from ' + from.toUpperCase() + ' to ' : '') + sq(dest);
    }
    return out.replace(/\s+/g, ' ').trim() + promo + suffix;
  }
  function sq(s) {
    if (s.length !== 2) return s;
    // ElevenLabs and the Claude voice read "e5" naturally; device voices need "E 5".
    return provider() !== 'browser' ? s : s[0].toUpperCase() + ' ' + s[1];
  }

  var SAN_RE = /(\d+\s*(?:\.\.\.|…|\.)\s*)?\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?)(?![\w-])/g;

  /** Make explanation text pleasant to hear: no HTML, notation read as words. */
  function spoken(text) {
    var t = String(text || '');
    t = t.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&apos;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    t = t.replace(/[✓✗⚠🏆🏁⏱→←]/g, ' ');
    t = t.replace(SAN_RE, function (all, num, san, offset, str) {
      // In a sequence of moves ("1.e4 e5 2.Nf3") add a short pause between them.
      var rest = str.slice(offset + all.length), pause = /^\s+(\d+\s*(\.|…)|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8])/.test(rest) ? ',' : '';
      if (/^[a-h][1-8]$/.test(san)) return sq(san) + pause;
      return sanWords(san) + pause;
    });
    t = t.replace(/\?!|!\?|\?\?|!!/g, '').replace(/\s*\(\s*\)/g, '');
    t = t.replace(/\be\.g\./gi, 'for example').replace(/\bvs\.?\b/g, 'versus').replace(/≈/g, 'about ');
    t = t.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/,([.,])/g, '$1').trim();
    return t;
  }

  var cachedVoice = null;
  function voices() { return supported() ? synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); }) : []; }
  function pickVoice() {
    var list = voices(), name = prof().voiceName;
    if (!list.length) return null;
    if (name) { var v = list.find(function (x) { return x.name === name; }); if (v) return v; }
    if (cachedVoice && list.indexOf(cachedVoice) >= 0) return cachedVoice;
    var prefs = [/Google US English/i, /Natural/i, /Google UK English Female/i, /Google/i, /Samantha|Ava|Allison|Zira|Aria|Jenny/i, /en-US/i];
    for (var i = 0; i < prefs.length; i++) {
      var hit = list.find(function (x) { return prefs[i].test(x.name) || prefs[i].test(x.lang); });
      if (hit) return (cachedVoice = hit);
    }
    return (cachedVoice = list[0]);
  }

  var last = '';
  function say(text, opts) {
    opts = opts || {};
    if (!enabled() && !opts.force) return false;
    var t = spoken(text);
    if (!t) return false;
    if (prof().voiceDetail === 'short' && !opts.force) t = brief(t, 1) || t;
    last = t;
    var pv = provider();
    if (pv === 'elevenlabs') { elevenSay(t, opts); return true; }
    if (pv === 'claude') return claudeSay(t, opts);
    return browserSay(t, opts);
  }
  function browserSay(t, opts) {
    if (!browserSupported()) return false;
    try {
      if (!opts.queue) synth.cancel();
      var u = new root.SpeechSynthesisUtterance(t);
      var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = +prof().voiceRate || 1;
      u.pitch = 1;
      synth.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function stop() {
    token++;
    try { if (synth) synth.cancel(); } catch (e) { /* ignore */ }
    try { if (audioEl) audioEl.pause(); } catch (e) { /* ignore */ }
    try { if (claudeTts) claudeTts.stop(); } catch (e) { /* ignore */ }
  }

  /** List the voices on the user's ElevenLabs account (needs the key's "Voices: read" permission). */
  function loadElevenVoices() {
    return root.fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': getKey() } }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 401 ? 'the key may not have the Voices read permission' : 'error ' + r.status);
      return r.json();
    }).then(function (j) {
      return (j.voices || []).map(function (v) {
        var l = v.labels || {};
        var desc = [l.description || l.descriptive, l.accent, l.age, l.gender, l.use_case].filter(Boolean).join(', ');
        return { id: v.voice_id, name: v.name, desc: desc || v.description || '', preview: v.preview_url || '', category: v.category || '' };
      });
    });
  }
  function repeat() { if (last) say(last, { force: true }); }

  /** First sentences of a longer explanation (spoken coaching should be short). */
  function brief(text, n) {
    var t = String(text || '').replace(/<[^>]+>/g, ' ');
    var parts = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
    return parts.slice(0, n || 2).map(function (x) { return x.trim(); }).join(' ');
  }

  if (supported() && synth.addEventListener) synth.addEventListener('voiceschanged', function () { cachedVoice = null; });
  // Stop talking when the screen changes.
  if (root.addEventListener) root.addEventListener('hashchange', stop);

  root.CT = root.CT || {};
  root.CT.Voice = {
    browserSupported: browserSupported, provider: provider, claudeReady: claudeReady, onClaudeReady: onClaudeReady, claudeVoices: CLAUDE_VOICES,
    _setClaudeTts: function (ns) { claudeTts = ns; claudeOff = false; }, setKey: setKey, hasKey: function () { return !!getKey(); }, elevenReady: elevenReady,
    elevenVoices: EL_VOICES, elevenModels: EL_MODELS, lastModel: function () { return lastModel; }, _badModels: badModels, loadElevenVoices: loadElevenVoices, usage: usage, lastError: function () { return elError; },
    resetError: function () { elError = ''; elBroken = false; Object.keys(badModels).forEach(function (k) { delete badModels[k]; }); }, _hash: hashText,
    supported: supported, enabled: enabled, say: say, stop: stop, repeat: repeat, spoken: spoken, sanWords: sanWords, brief: brief, voices: voices, pickVoice: pickVoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CT.Voice;
})(typeof window !== 'undefined' ? window : globalThis);
