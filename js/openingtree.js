/*
 * openingtree.js — Merges a repertoire's lines into a move tree (for the explorer and sparring),
 * and turns lines into "find the move" quiz questions.
 */
(function (root) {
  'use strict';
  var CT = root.CT;
  var cache = {};

  function lineById(id) { return CT.Data.openingLines.find(function (l) { return l.id === id; }) || (CT.Data.traps || []).find(function (l) { return l.id === id; }); }

  /** Tree for one repertoire. Each node: {path, depth, children: {san: {san, lines:[ids], comment, mistake}}} */
  function build(repId, opts) {
    opts = opts || {};
    var key = repId + (opts.includeLessons ? ':all' : '');
    if (cache[key]) return cache[key];
    var rep = CT.Data.repertoires.find(function (r) { return r.id === repId; });
    var nodes = { '': { path: '', depth: 0, children: {} } };
    rep.lines.forEach(function (id) {
      var l = lineById(id);
      if (!l || (l.lessonOnly && !opts.includeLessons)) return;
      var path = '';
      l.moves.forEach(function (pair, i) {
        var node = nodes[path];
        var c = node.children[pair[0]];
        if (!c) c = node.children[pair[0]] = { san: pair[0], lines: [], comment: '', mistake: false };
        if (c.lines.indexOf(id) < 0) c.lines.push(id);
        // Keep the most informative comment for this move.
        if (pair[1].length > c.comment.length) c.comment = pair[1];
        if (l.mistakePly === i) c.mistake = true;
        path = path ? path + ' ' + pair[0] : pair[0];
        if (!nodes[path]) nodes[path] = { path: path, depth: i + 1, children: {} };
      });
    });
    cache[key] = { rep: rep, nodes: nodes };
    return cache[key];
  }

  function childList(tree, path) {
    var n = tree.nodes[path];
    return n ? Object.keys(n.children).map(function (k) { return n.children[k]; }) : [];
  }

  /** Quiz questions: key learner moves from every studied line. */
  function quizItems() {
    var out = [];
    CT.Data.openingLines.forEach(function (l) {
      if (l.kind === 'trap-avoid') return;
      l.moves.forEach(function (pair, i) {
        var learner = (i % 2 === 0 ? 'w' : 'b') === l.side;
        if (!learner) return;
        var isPunish = l.mistakePly !== undefined && i === l.mistakePly + 1;
        if (l.lessonOnly && !isPunish) return;
        if (l.mistakePly !== undefined && i > l.mistakePly + 1) return;
        if (i < 4 && !isPunish) return; // first moves are too easy to be useful questions
        out.push({ key: l.id + ':' + i, lineId: l.id, ply: i, move: pair[0], comment: pair[1], punish: isPunish });
      });
    });
    // The same position can appear in several lines: keep one question per position.
    var seen = {};
    return out.filter(function (q) {
      var l = lineById(q.lineId);
      var k = l.moves.slice(0, q.ply).map(function (m) { return m[0]; }).join(' ');
      if (seen[k]) return false;
      seen[k] = true; return true;
    });
  }

  CT.OpeningTree = { build: build, childList: childList, quizItems: quizItems, lineById: lineById };
})(window);
