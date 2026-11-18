/*
 * sound.js — Small synthesized sound effects (no audio files, works offline).
 * CT.Sound.play('move' | 'capture' | 'check' | 'good' | 'bad' | 'win' | 'castle')
 * Respects the "Sound effects" setting (Store.state.profile.sound).
 */
(function (root) {
  'use strict';
  var ctx = null;
  function enabled() {
    try { return root.CT.Store.state.profile.sound !== false; } catch (e) { return true; }
  }
  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }
  // A short percussive "knock" like a wooden piece landing.
  function knock(a, t, freq, vol, dur) {
    var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.6;
    var g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t);
  }
  function tone(a, t, freq, dur, vol, type) {
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var SOUNDS = {
    move: function (a, t) { knock(a, t, 900, 0.9, 0.07); },
    castle: function (a, t) { knock(a, t, 900, 0.8, 0.06); knock(a, t + 0.09, 800, 0.8, 0.06); },
    capture: function (a, t) { knock(a, t, 600, 1.1, 0.09); knock(a, t + 0.035, 1500, 0.6, 0.05); },
    check: function (a, t) { knock(a, t, 900, 0.8, 0.07); tone(a, t + 0.02, 880, 0.16, 0.08, 'triangle'); },
    good: function (a, t) { tone(a, t, 660, 0.12, 0.09, 'sine'); tone(a, t + 0.09, 880, 0.18, 0.09, 'sine'); },
    bad: function (a, t) { tone(a, t, 220, 0.22, 0.09, 'triangle'); tone(a, t + 0.08, 185, 0.26, 0.07, 'triangle'); },
    win: function (a, t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(a, t + i * 0.085, f, 0.25, 0.08, 'sine'); }); }
  };
  function play(name) {
    if (!enabled()) return;
    var a = audio();
    if (!a || !SOUNDS[name]) return;
    try { SOUNDS[name](a, a.currentTime + 0.01); } catch (e) { /* never let sound break the app */ }
  }
  root.CT = root.CT || {};
  root.CT.Sound = { play: play };
})(window);
