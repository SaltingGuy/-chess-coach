/*
 * engineworker.js — Runs the Trainer Engine (engine-play.js) in a background thread (Web Worker),
 * so the board, clocks and buttons stay responsive while it thinks.
 * The worker is built from the app's own chess.js + engine-play.js. If that is not possible
 * (for example when the app is opened straight from a file), it thinks on the main thread instead.
 *
 * CT.EngineWorker.think(fen, opts) → Promise<result of CT.EnginePlay.think>
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var worker = null, ready = null, failed = false, nextId = 1, pending = {};

  var HANDLER = '\n;self.onmessage = function (e) {\n' +
    '  var d = e.data;\n' +
    '  try { var r = self.CT.EnginePlay.think(new self.CT.Chess(d.fen), d.opts || {}); self.postMessage({ id: d.id, r: r }); }\n' +
    '  catch (err) { self.postMessage({ id: d.id, error: String(err && err.message || err) }); }\n' +
    '};\n';

  function start() {
    if (ready) return ready;
    if (failed || typeof root.Worker === 'undefined' || typeof root.fetch !== 'function' || !/^https?:/.test(root.location ? root.location.protocol : '')) {
      failed = true; return (ready = Promise.resolve(false));
    }
    ready = Promise.all(['js/chess.js', 'js/engine-play.js'].map(function (u) {
      return root.fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.text(); });
    })).then(function (texts) {
      var blob = new root.Blob([texts[0] + '\n;' + texts[1] + HANDLER], { type: 'text/javascript' });
      var url = root.URL.createObjectURL(blob);
      worker = new root.Worker(url);
      worker.onmessage = function (e) {
        var p = pending[e.data.id];
        if (!p) return;
        delete pending[e.data.id];
        if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.r);
      };
      worker.onerror = function () {
        failed = true; worker = null;
        Object.keys(pending).forEach(function (k) { var p = pending[k]; delete pending[k]; p.fallback(); });
      };
      return true;
    }).catch(function () { failed = true; worker = null; return false; });
    return ready;
  }

  function onMain(fen, opts) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(CT.EnginePlay.think(new CT.Chess(fen), opts || {})); }, 0);
    });
  }

  function think(fen, opts) {
    return start().then(function (ok) {
      if (!ok || !worker) return onMain(fen, opts);
      return new Promise(function (resolve, reject) {
        var id = nextId++;
        pending[id] = { resolve: resolve, reject: reject, fallback: function () { onMain(fen, opts).then(resolve, reject); } };
        worker.postMessage({ id: id, fen: fen, opts: opts || {} });
      });
    });
  }

  function status() { return worker ? 'worker' : failed ? 'main-thread' : 'starting'; }

  CT.EngineWorker = { think: think, start: start, status: status };
})(typeof window !== 'undefined' ? window : globalThis);
