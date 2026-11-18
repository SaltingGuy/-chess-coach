/*
 * gamestore.js — Your game database (stored in this browser, separate from training progress).
 * Also turns mistakes from your games into personal puzzles and finds recurring weaknesses.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var KEY = 'chess-trainer.games.v1';
  var MAX_GAME_PUZZLES = 150;
  var games = load();

  function load() {
    try { var raw = root.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function persist() {
    try { root.localStorage.setItem(KEY, JSON.stringify(games)); return true; }
    catch (e) { CT.UI && CT.UI.toast('Storage is full — delete some old games.'); return false; }
  }

  function openingName(h, moves) {
    if (h.Opening) return h.Opening;
    if (h.ECOUrl) {
      var last = h.ECOUrl.split('/').pop() || '';
      return decodeURIComponent(last).replace(/-/g, ' ').replace(/\.\.\./g, '…').replace(/\s+\d+\..*$/, '').trim() || (h.ECO || '');
    }
    var rep = guessRepertoire(moves);
    return rep || (h.ECO ? 'ECO ' + h.ECO : 'Unknown opening');
  }
  function guessRepertoire(moves) {
    if (!CT.Data || !CT.OpeningTree) return null;
    var best = null, bestDepth = 0;
    CT.Data.repertoires.forEach(function (r) {
      var tree = CT.OpeningTree.build(r.id, { includeLessons: true }), path = [], d = 0;
      for (var i = 0; i < moves.length && i < 24; i++) {
        var kids = CT.OpeningTree.childList(tree, path.join(' '));
        var k = kids.find(function (x) { return x.san === moves[i]; });
        if (!k) break;
        path.push(moves[i]); d = i + 1;
        if (d >= 2 && d > bestDepth) { bestDepth = d; best = CT.OpeningTree.lineById(k.lines[0]).name; }
      }
    });
    return best;
  }

  /** Which colour did the user play? Uses the saved chess.com username when it matches a header. */
  function detectColor(h) {
    var u = ((CT.Store.state.profile.chesscomUser || '') + '').toLowerCase();
    if (u) {
      if ((h.White || '').toLowerCase() === u) return 'w';
      if ((h.Black || '').toLowerCase() === u) return 'b';
    }
    return null;
  }

  function add(pgnText) {
    var r = CT.Chess.parsePgn(pgnText);
    if (!r.ok) return { ok: false, error: r.error };
    if (!r.moves.length) return { ok: false, error: 'This game has no moves.' };
    var h = r.headers;
    var id = 'g' + CT.Analysis.hash(r.startFen + r.moves.join(' ') + (h.Date || '') + (h.White || '') + (h.Black || ''));
    var existing = get(id);
    if (existing) return { ok: true, id: id, duplicate: true };
    games.unshift({
      id: id, addedAt: Date.now(), headers: h, startFen: r.startFen, moves: r.moves,
      opening: openingName(h, r.moves), userColor: detectColor(h), analysis: null, report: null, clocks: r.clocks || null
    });
    persist();
    return { ok: true, id: id };
  }

  /** Seconds left on the mover's clock after each half-move (from practice games). */
  function setClocks(id, clocks) { var g = get(id); if (g && clocks && clocks.length) { g.clocks = clocks.slice(0, g.moves.length); persist(); } }

  function get(id) { return games.find(function (g) { return g.id === id; }) || null; }
  function list() { return games.slice(); }
  function remove(id) {
    games = games.filter(function (g) { return g.id !== id; });
    persist();
  }
  function setColor(id, color) {
    var g = get(id);
    if (!g) return;
    g.userColor = color;
    if (g.analysis) { var rep = CT.Analysis.report(expand(g), color); g.report = compactReport(rep); addGamePuzzles(rep.exercises); }
    persist();
  }

  /* ---------- storing analysis compactly ---------- */
  function compactEval(e) { return e ? { cp: e.cp, mate: e.mate, best: e.best, pv: (e.pv || []).slice(0, 6), terminal: e.terminal } : null; }
  function saveAnalysis(id, result) {
    var g = get(id);
    if (!g) return;
    if (!g.analysis && CT.Store) CT.Store.bumpDay('analysed'); // a newly reviewed game (guided session "Review" block)
    g.analysis = {
      engine: result.engine, source: result.source, at: Date.now(), accuracy: result.accuracy, counts: result.counts,
      evals: result.evals.map(compactEval),
      moves: result.moves.map(function (m) {
        return { cls: m.cls, loss: Math.round(m.loss * 10) / 10, explanation: m.explanation || '', motif: m.motif || null, missedMate: m.missedMate, allowsMate: m.allowsMate, lessonKind: m.lessonKind || null };
      })
    };
    if (g.userColor) {
      var rep = CT.Analysis.report(result, g.userColor);
      g.report = compactReport(rep);
      addGamePuzzles(rep.exercises);
    }
    persist();
  }

  /** Rebuild the full analysis object (with positions) from what we stored. */
  function expand(g) {
    if (!g.analysis) return null;
    var C = CT.Chess, b = new C(g.startFen), fens = [b.fen()], played = [];
    g.moves.forEach(function (s) { played.push(b.move(s)); fens.push(b.fen()); });
    var a = g.analysis, moves = played.map(function (m, ply) {
      var s = a.moves[ply] || {}, eb = a.evals[ply], ea = a.evals[ply + 1];
      var wb = CT.Analysis.winPct(eb), wa = CT.Analysis.winPct(ea);
      return {
        ply: ply, moveNo: Math.floor(ply / 2) + parseInt(fens[0].split(' ')[5] || '1', 10), color: m.color, san: m.san, from: m.from, to: m.to,
        fenBefore: fens[ply], fenAfter: fens[ply + 1], evalBefore: eb, evalAfter: ea, best: eb.best, bestPv: eb.pv,
        winBefore: m.color === 'w' ? wb : 100 - wb, winAfter: m.color === 'w' ? wa : 100 - wa,
        loss: s.loss || 0, cls: s.cls, symbol: CT.Analysis.SYMBOL[s.cls] || '', explanation: s.explanation, motif: s.motif,
        missedMate: s.missedMate, allowsMate: s.allowsMate, lessonKind: s.lessonKind, reply: ea.best, replyPv: ea.pv
      };
    });
    return { engine: a.engine, source: a.source, headers: g.headers, startFen: g.startFen, moves: moves, evals: a.evals, accuracy: a.accuracy, counts: a.counts };
  }

  function compactReport(r) {
    var mv = function (m) { return m ? { ply: m.ply, moveNo: m.moveNo, san: m.san, best: m.best, loss: m.loss, explanation: m.explanation, color: m.color } : null; };
    return {
      userColor: r.userColor, outcome: r.outcome, summary: r.summary, accuracy: r.accuracy, oppAccuracy: r.oppAccuracy,
      biggestMistake: mv(r.biggestMistake), opponentMistake: mv(r.opponentMistake), missedOpportunity: mv(r.missedOpportunity),
      pattern: r.pattern, opening: r.opening, middlegame: { text: r.middlegame.text, ply: r.middlegame.move ? r.middlegame.move.ply : null },
      didWell: { text: r.didWell.text, ply: r.didWell.move ? r.didWell.move.ply : null },
      exercises: r.exercises.map(function (e) { return e.id; }), motifCounts: r.motifCounts, hadWinning: r.hadWinning, missedThreats: r.missedThreats
    };
  }

  /* ---------- personal puzzles from your games ---------- */
  function addGamePuzzles(list) {
    var store = CT.Store.state;
    store.gamePuzzles = store.gamePuzzles || {};
    list.forEach(function (p) { store.gamePuzzles[p.id] = p; });
    var ids = Object.keys(store.gamePuzzles);
    if (ids.length > MAX_GAME_PUZZLES) ids.slice(0, ids.length - MAX_GAME_PUZZLES).forEach(function (id) { delete store.gamePuzzles[id]; });
    CT.Store.save();
    mergeGamePuzzles();
  }
  function mergeGamePuzzles() {
    var D = CT.Data, gp = CT.Store.state.gamePuzzles || {};
    if (!D.themes.game) D.themes.game = {
      name: 'From your games', tier: 1,
      what: 'Positions from your own analysed games where you missed a stronger move.',
      idea: 'The fastest way to improve is to fix the mistakes you actually make. These positions come back with spaced repetition until you solve them reliably.',
      deception: 'Your opponents will set the same traps again — now you will recognise them.'
    };
    Object.keys(gp).forEach(function (id) {
      if (!D.puzzles.some(function (p) { return p.id === id; })) {
        var p = Object.assign({}, gp[id]);
        if (!D.themes[p.theme]) p.theme = 'game';
        p.family = p.id;
        D.puzzles.push(p);
      }
    });
  }

  /* ---------- recurring weaknesses across games ---------- */
  function patterns(lastN) {
    var analysed = games.filter(function (g) { return g.report; }).slice(0, lastN || 10);
    var motif = {}, threatGames = 0, conversion = 0, blunders = 0;
    analysed.forEach(function (g) {
      var r = g.report;
      Object.keys(r.motifCounts || {}).forEach(function (k) { motif[k] = motif[k] || { count: 0, games: 0, lost: 0 }; motif[k].count += r.motifCounts[k]; motif[k].games++; });
      // How much each kind of mistake actually cost: winning chances lost on your moves with that motif.
      var whiteFirst = !g.startFen || g.startFen.split(' ')[1] !== 'b', mine = r.userColor === 'w' ? (whiteFirst ? 0 : 1) : (whiteFirst ? 1 : 0);
      (g.analysis.moves || []).forEach(function (m, i) {
        if (i % 2 !== mine || !m || !m.motif || !m.motif.key || !(m.loss > 0)) return;
        var k = m.motif.key; motif[k] = motif[k] || { count: 0, games: 0, lost: 0 }; motif[k].lost += m.loss;
      });
      if (r.missedThreats) threatGames++;
      if (r.hadWinning) conversion++;
      var c = g.analysis.counts[r.userColor]; blunders += c.blunder;
    });
    var insights = [];
    // Ranked by total cost (how often × how much it cost), not just by how often it happened.
    Object.keys(motif).sort(function (a, b) { return (motif[b].lost || 0) - (motif[a].lost || 0) || motif[b].games - motif[a].games; }).forEach(function (k) {
      if (motif[k].games >= 2) insights.push({ key: k, theme: CT.Analysis.MOTIF_THEME[k], weight: motif[k].games, lost: Math.round(motif[k].lost || 0),
        text: cap(CT.Analysis.MOTIF_NAME[k]) + ' cost you in ' + motif[k].games + ' of your last ' + analysed.length + ' games' + (motif[k].lost ? ' (about ' + Math.round(motif[k].lost) + '% winning chances in total)' : '') + ' — extra ' + CT.Analysis.MOTIF_NAME[k] + ' puzzles are now prioritised.' });
    });
    if (threatGames >= 2) insights.push({ key: 'threats', theme: null, weight: threatGames, href: '#/lab/threats', text: 'You missed your opponent\'s threat in ' + threatGames + ' games. Training priority: the hidden-threat drill and blunder-checking every move.' });
    if (conversion >= 2) insights.push({ key: 'conversion', theme: null, weight: conversion, text: 'You reached a winning position in ' + conversion + ' games but did not win. Converting advantages: trade pieces when ahead, avoid unnecessary risks, and keep checking your opponent\'s threats. Practice converting against the Defensive Player or the Solid opponent.' });
    return { games: analysed.length, insights: insights, motif: motif, blundersPerGame: analysed.length ? blunders / analysed.length : null };
  }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  /**
   * "Hope chess" check: how often YOUR move left a piece hanging (a mistake or blunder whose punishment is
   * simply taking a free piece). Per 10 games: your last 10 analysed games vs the 10 before.
   */
  function hungStats() {
    var analysed = games.filter(function (g) { return g.analysis && g.report && g.report.userColor; });
    var perGame = analysed.map(function (g) {
      var whiteFirst = !g.startFen || g.startFen.split(' ')[1] !== 'b', mine = g.report.userColor === 'w' ? (whiteFirst ? 0 : 1) : (whiteFirst ? 1 : 0);
      return (g.analysis.moves || []).filter(function (m, i) { return i % 2 === mine && m && (m.cls === 'blunder' || m.cls === 'mistake') && m.lessonKind === 'threat' && m.motif && m.motif.key === 'hanging'; }).length;
    });
    function per10(list) { return list.length ? Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length * 100) / 10 : null; }
    var recent = perGame.slice(0, 10), prev = perGame.slice(10, 20);
    return { games: perGame.length, recent: per10(recent), previous: prev.length >= 3 ? per10(prev) : null, perGame: perGame };
  }

  /** Theme weights for the coach: themes linked to recurring game mistakes get priority. */
  function themePressure() {
    var p = patterns(10), out = {};
    p.insights.forEach(function (i) { if (i.theme) out[i.theme] = (out[i.theme] || 0) + i.weight; });
    Object.keys(p.motif).forEach(function (k) { var th = CT.Analysis.MOTIF_THEME[k]; if (th) out[th] = Math.max(out[th] || 0, p.motif[k].games, Math.round((p.motif[k].lost || 0) / 20)); });
    return out;
  }

  function exportPgn() {
    return games.map(function (g) {
      var c = new CT.Chess(g.startFen);
      g.moves.forEach(function (m) { c.move(m); });
      Object.keys(g.headers || {}).forEach(function (k) { c.header(k, g.headers[k]); });
      return c.pgn();
    }).join('\n\n');
  }

  /** All games (for backups) and restoring them from a backup. */
  function all() { return games.slice(); }
  function replaceAll(list) {
    if (!Array.isArray(list)) return;
    games = list.filter(function (g) { return g && g.id && Array.isArray(g.moves); });
    persist();
    mergeGamePuzzles();
  }

  CT.Games = {
    all: all, replaceAll: replaceAll,
    add: add, get: get, setClocks: setClocks, list: list, remove: remove, setColor: setColor, saveAnalysis: saveAnalysis, expand: expand,
    patterns: patterns, hungStats: hungStats, themePressure: themePressure, mergeGamePuzzles: mergeGamePuzzles, exportPgn: exportPgn,
    detectColor: detectColor, openingName: openingName
  };
})(window);
