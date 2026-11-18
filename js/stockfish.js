/*
 * stockfish.js — Connects the app to the Stockfish chess engine (runs inside your browser, in a Web Worker).
 *
 * Where the engine comes from (tried in order):
 *   1. vendor/stockfish/stockfish.js next to the app, if you add it (works offline when the app is
 *      served from a web address; see vendor/stockfish/README.md).
 *   2. A public CDN copy of stockfish.js (downloaded once by your browser, then cached).
 * If none loads, CT.Analyzer falls back to the small built-in engine and says so clearly.
 *
 * Talks to the engine with the standard UCI protocol:  uci → isready → position fen … → go depth N.
 */
(function (root) {
  'use strict';
  var CT = root.CT = root.CT || {};
  // Stockfish 19 Lite (NNUE, single-threaded WebAssembly; nmrugg/stockfish.js, GPL-3.0) first,
  // then the old Stockfish 10 as a last resort.
  var CDN = [
    { url: 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.js', wasm: 'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js' },
    { url: 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js' }
  ];
  var LOCAL = 'vendor/stockfish/stockfish.js';

  var worker = null, state = 'idle', engineName = '', source = '', lastError = '';
  var listeners = [], queue = [], busy = false, readyPromise = null;

  /* ---------- UCI parsing (pure functions, unit-tested) ---------- */
  function parseInfo(line) {
    if (line.indexOf('info ') !== 0 || line.indexOf(' score ') < 0) return null;
    var t = line.split(/\s+/), out = { multipv: 1 };
    for (var i = 1; i < t.length; i++) {
      var k = t[i];
      if (k === 'depth') out.depth = +t[++i];
      else if (k === 'seldepth') out.seldepth = +t[++i];
      else if (k === 'multipv') out.multipv = +t[++i];
      else if (k === 'nodes') out.nodes = +t[++i];
      else if (k === 'score') {
        var kind = t[++i], val = +t[++i];
        if (kind === 'cp') out.cp = val; else if (kind === 'mate') out.mate = val;
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') { out.bound = t[++i]; }
      } else if (k === 'pv') { out.pv = t.slice(i + 1); break; }
    }
    return out;
  }
  function parseBest(line) {
    var m = /^bestmove\s+(\S+)/.exec(line);
    return m ? (m[1] === '(none)' ? null : m[1]) : undefined;
  }

  /* ---------- worker creation ---------- */
  function makeWorker(src) {
    if (src.kind === 'local') return new Worker(src.url);
    if (src.kind === 'code') return new Worker(URL.createObjectURL(new Blob([src.code], { type: 'application/javascript' })));
    // A tiny "boot" worker that imports the engine script from the CDN.
    var code = 'importScripts(' + JSON.stringify(src.url) + ');';
    var blob = new Blob([code], { type: 'application/javascript' });
    // WebAssembly builds look for their .wasm file in the worker's #hash when they are not loaded from their own folder.
    return new Worker(URL.createObjectURL(blob) + (src.wasm ? '#' + encodeURIComponent(src.wasm) : ''));
  }

  function tryStart(src, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var w, done = false, name = '';
      try { w = makeWorker(src); } catch (e) { return reject(e); }
      var timer = setTimeout(function () { finish(new Error('No answer from the engine (timeout)')); }, timeoutMs);
      function finish(err) {
        if (done) return; done = true; clearTimeout(timer);
        if (err) { try { w.terminate(); } catch (e) { /* ignore */ } reject(err); }
        else resolve({ worker: w, name: name });
      }
      w.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); finish(new Error((e && e.message) || 'Engine script failed to load')); };
      w.onmessage = function (e) {
        var line = String(e.data);
        if (line.indexOf('id name') === 0) name = line.slice(8);
        if (line === 'uciok') finish(null);
      };
      w.postMessage('uci');
    });
  }

  var testSources = null;
  function sources() {
    if (testSources) return testSources;
    var list = [];
    if (/^https?:/.test(root.location.protocol)) list.push({ kind: 'local', url: LOCAL, label: 'bundled copy' });
    CDN.forEach(function (c) { list.push({ kind: 'cdn', url: c.url, wasm: c.wasm, label: c.url.split('/')[2] }); });
    return list;
  }

  /** Start Stockfish once; resolves true when ready, false if it could not be loaded. */
  function init() {
    if (readyPromise) return readyPromise;
    state = 'loading'; emit();
    var list = sources();
    readyPromise = (function next(i) {
      if (i >= list.length) {
        state = 'failed';
        lastError = lastError || 'Stockfish could not be loaded.';
        emit();
        return Promise.resolve(false);
      }
      return tryStart(list[i], list[i].kind === 'local' ? 8000 : list[i].wasm ? 20000 : 25000).then(function (r) {
        worker = r.worker; engineName = r.name || 'Stockfish'; source = list[i].label; state = 'ready'; lastError = ''; multipvNow = 1;
        worker.onmessage = onLine;
        worker.onerror = function () { state = 'failed'; lastError = 'The engine crashed.'; emit(); };
        send('setoption name UCI_AnalyseMode value true');
        send('isready');
        emit();
        return true;
      }, function (err) {
        lastError = err.message;
        return next(i + 1);
      });
    })(0);
    return readyPromise;
  }

  function send(cmd) { if (worker) worker.postMessage(cmd); }

  var current = null;
  var multipvNow = 1; // MultiPV is only changed between searches (UCI forbids changing options mid-search)
  function onLine(e) {
    var line = String(e.data);
    if (!current) return;
    var info = parseInfo(line);
    if (info && info.pv) {
      current.lines[info.multipv] = info;
      if (current.onInfo) current.onInfo(info);
      return;
    }
    var best = parseBest(line);
    if (best !== undefined) {
      var c = current; current = null; busy = false;
      c.resolve({ bestmove: best, lines: c.lines, depth: (c.lines[1] || {}).depth || 0 });
      pump();
    }
  }

  function pump() {
    if (busy || !queue.length || state !== 'ready') return;
    busy = true;
    current = queue.shift();
    current.lines = {};
    var mpv = current.multipv || 1;
    if (mpv !== multipvNow) { send('setoption name MultiPV value ' + mpv); multipvNow = mpv; }
    send('position fen ' + current.fen);
    send('go ' + (current.movetime ? 'movetime ' + current.movetime : 'depth ' + (current.depth || 12)) +
      (current.searchmoves && current.searchmoves.length ? ' searchmoves ' + current.searchmoves.join(' ') : ''));
  }

  /**
   * Analyse one position. Resolves {bestmove (UCI), lines: {1: {cp|mate, depth, pv:[uci…]}}, depth}.
   * Scores are from the side to move's point of view (UCI convention).
   * opts.searchmoves (array of UCI moves) restricts the search to those moves, so a given move
   * can be scored from the same position and depth as the engine's own choice.
   */
  function analyse(fen, opts) {
    opts = opts || {};
    return init().then(function (ok) {
      if (!ok) throw new Error('Stockfish unavailable');
      return new Promise(function (resolve) {
        queue.push({ fen: fen, depth: opts.depth, movetime: opts.movetime, searchmoves: opts.searchmoves, multipv: opts.multipv, onInfo: opts.onInfo, resolve: resolve });
        pump();
      });
    });
  }

  function stop() {
    queue.length = 0;
    if (busy) send('stop');
  }

  function on(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(status()); } catch (e) { /* ignore */ } }); }
  function status() { return { state: state, name: engineName, source: source, error: lastError }; }

  /** Test hook: replace the engine sources and reset (used by the automated browser tests only). */
  function _setSources(list) { testSources = list; if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } } worker = null; readyPromise = null; state = 'idle'; queue.length = 0; busy = false; current = null; multipvNow = 1; emit(); }

  CT.Stockfish = { _setSources: _setSources, init: init, analyse: analyse, stop: stop, status: status, on: on, parseInfo: parseInfo, parseBest: parseBest };
  if (typeof module !== 'undefined' && module.exports) module.exports = CT.Stockfish;
})(typeof window !== 'undefined' ? window : globalThis);
