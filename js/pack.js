/*
 * pack.js — Turns the bundled Lichess puzzle pack (js/data/puzzlepack.js) into app puzzles.
 *
 * Lichess puzzles start one move earlier than ours: the first move is the opponent's (the mistake you
 * get to punish). We play it for you and show it as the last move. Every later move is an "only move"
 * (Lichess checks this with Stockfish), except that on the final move any checkmate counts.
 *
 * Puzzles are created cheaply; the board position and solution (SAN) are worked out the first time a
 * puzzle is opened, so 4,000+ puzzles do not slow down the app on a phone.
 */
(function (root) {
  'use strict';
  var CT = root.CT, D = CT.Data;
  if (!D || !D.pack) return;

  /* New themes for ideas the composed set did not cover. */
  var NEW_THEMES = {
    'mating-attack': { name: 'Mating attacks', tier: 2, what: 'A sequence of forcing moves (mostly checks) that ends in checkmate, usually in two or three moves.', idea: 'Look at every check first. Then ask which squares the king can run to, and which of your pieces can cover them.', deception: 'The first move often looks harmless or even like a blunder; the mate only appears two moves later.' },
    'sacrifice': { name: 'Sacrifices that open lines', tier: 3, what: 'You give up material to open a file or diagonal, drag the king out, clear a square, or block a defender — and win it back with interest.', idea: 'Count what you get: an exposed king, a mating net, or more material a few moves later. If you cannot see the payoff, it is not a sacrifice, it is a blunder.', deception: 'Sound sacrifices are the most deceptive moves in chess: they look like gifts. The difference from "hope chess" is that you calculated the payoff.' },
    'defence': { name: 'Defensive moves', tier: 2, what: 'Positions where you are under threat and must find the one move that holds — often a quiet move, a counter-attack, or an in-between check.', idea: 'First name everything your opponent threatens. Then look for moves that stop all of it at once, or that create a bigger threat of your own.', deception: 'Knowing the defences is how you tell a real trap from a hopeful one — and how you avoid walking into your opponent\'s.' },
    'endgame-tech': { name: 'Endgame technique', tier: 2, what: 'Tactics in endgames: promoting a pawn, winning the race, zugzwang, and turning a small material edge into a win.', idea: 'In endgames the king is a fighting piece and passed pawns are worth much more. Count moves: who promotes first?', deception: 'A quiet king move or pawn push can win more than a capture in the endgame.' },
    'back-rank-combo': { name: 'Back-rank combinations', tier: 2, what: 'Back-rank mates that are not there yet: the rank is guarded, so you first deflect, decoy or overload the defender (often with a sacrifice), and then mate.', idea: 'Find the piece that guards the back rank. Can you make it move with a capture or a check — or give it two jobs at once? Then count: after it leaves, is the mate there?', deception: 'The first move usually looks like a blunder (a queen or rook "hangs"). Your opponent must take it, and taking it is what opens the back rank.' },
    'combination': { name: 'Mixed combinations', tier: 2, what: 'Tactics that combine several ideas, or win decisively in a way that does not fit one label.', idea: 'Checks, captures and threats — for both sides — in that order. The best move is often the one that leaves your opponent with no good answer.', deception: 'Real games rarely announce the theme. These puzzles train you to find the idea without a label.' }
  };
  Object.keys(NEW_THEMES).forEach(function (k) { if (!D.themes[k]) D.themes[k] = NEW_THEMES[k]; });

  /* Lichess theme → app theme (first match wins). */
  var MAP = [
    ['smotheredMate', 'smothered'], ['backRankMate', 'back-rank'],
    ['anastasiaMate', 'mate-patterns'], ['arabianMate', 'mate-patterns'], ['hookMate', 'mate-patterns'], ['dovetailMate', 'mate-patterns'], ['bodenMate', 'mate-patterns'], ['doubleBishopMate', 'mate-patterns'],
    ['mateIn1', 'mate1'], ['hangingPiece', 'hanging'], ['fork', 'fork'], ['skewer', 'skewer'], ['pin', 'pin'],
    ['discoveredAttack', 'discovered'], ['doubleCheck', 'discovered'], ['capturingDefender', 'remove-defender'],
    ['attraction', 'decoy'], ['deflection', 'overload'], ['intermezzo', 'zwischenzug'], ['trappedPiece', 'trapped-piece'],
    ['quietMove', 'quiet-move'], ['defensiveMove', 'defence'], ['equality', 'defence'],
    ['sacrifice', 'sacrifice'], ['clearance', 'sacrifice'], ['interference', 'sacrifice'], ['exposedKing', 'sacrifice'], ['xRayAttack', 'sacrifice'],
    ['mate', 'mating-attack'], ['kingsideAttack', 'mating-attack'], ['attackingF2F7', 'mating-attack'],
    ['pawnEndgame', 'endgame-tech'], ['rookEndgame', 'endgame-tech'], ['promotion', 'endgame-tech'], ['advancedPawn', 'endgame-tech'], ['zugzwang', 'endgame-tech']
  ];
  var LABEL = {
    hangingPiece: 'hanging piece', fork: 'fork', pin: 'pin', skewer: 'skewer', discoveredAttack: 'discovered attack', doubleCheck: 'double check',
    capturingDefender: 'removing the defender', attraction: 'attraction (decoy)', deflection: 'deflection', intermezzo: 'in-between move', trappedPiece: 'trapped piece',
    quietMove: 'quiet move', defensiveMove: 'defensive move', equality: 'saving the game', sacrifice: 'sacrifice', clearance: 'clearance', interference: 'interference',
    exposedKing: 'exposed king', xRayAttack: 'x-ray', mate: 'checkmate', kingsideAttack: 'kingside attack', queensideAttack: 'queenside attack', attackingF2F7: 'attack on f2/f7',
    pawnEndgame: 'pawn endgame', rookEndgame: 'rook endgame', bishopEndgame: 'bishop endgame', knightEndgame: 'knight endgame', queenEndgame: 'queen endgame', queenRookEndgame: 'queen and rook endgame',
    promotion: 'promotion', underPromotion: 'underpromotion', advancedPawn: 'advanced pawn', zugzwang: 'zugzwang', backRankMate: 'back-rank mate', smotheredMate: 'smothered mate',
    anastasiaMate: 'Anastasia\'s mate', arabianMate: 'Arabian mate', hookMate: 'hook mate', dovetailMate: 'dovetail mate', bodenMate: 'Boden\'s mate', doubleBishopMate: 'double-bishop mate',
    crushing: 'decisive', advantage: 'winning advantage', castling: 'castling', enPassant: 'en passant'
  };
  var HINT = {
    hanging: 'Is anything of theirs undefended — or defended fewer times than it is attacked?',
    mate1: 'Look at every check. Which one leaves the king no square?',
    fork: 'Look for a move that attacks two things at once (the king counts).',
    pin: 'Is a piece stuck in front of something more valuable? Attack it again.',
    skewer: 'Attack the big piece first — what is standing behind it?',
    discovered: 'Moving one piece can unmask another. Which of your pieces is "hiding" a line?',
    'remove-defender': 'Which enemy piece is doing an important defensive job? Take it or chase it away.',
    overload: 'One defender may be guarding two things. Make it choose.',
    decoy: 'Which square would you like their king or queen to stand on? Can you force it there?',
    zwischenzug: 'Before the "obvious" recapture, is there a check or bigger threat first?',
    'trapped-piece': 'Does one of their pieces have no safe squares? Attack it.',
    'quiet-move': 'No check or capture works yet — find the move that creates an unstoppable threat.',
    defence: 'Name every threat against you first. Which move stops them all, or counters with something bigger?',
    sacrifice: 'Could giving material open a line to the king or set up a fork? Count what you get back.',
    'mating-attack': 'Checks first. Where can the king go after each one?',
    'endgame-tech': 'Count moves: who promotes first? Is there a pawn push or king move that wins the race?',
    combination: 'Checks, captures, threats — for both sides — in that order.',
    smothered: 'The king is boxed in by its own pieces. Which knight check is deadly?',
    'back-rank': 'Is their king stuck on the back rank with no escape square?',
    'back-rank-combo': 'Which piece guards their back rank? Force it away first — a sacrifice is allowed.',
    'mate-patterns': 'Picture the mating net first: which squares around the king are already covered?'
  };

  /* A back-rank mate that needs a sacrifice, deflection or a long sequence first is its own, harder theme. */
  var COMBO = ['sacrifice', 'deflection', 'attraction', 'clearance', 'interference', 'capturingDefender', 'xRayAttack', 'intermezzo', 'quietMove', 'mateIn3', 'mateIn4', 'mateIn5'];
  function appTheme(list) {
    if (list.indexOf('backRankMate') >= 0 && list.indexOf('smotheredMate') < 0 && COMBO.some(function (t) { return list.indexOf(t) >= 0; })) return 'back-rank-combo';
    for (var i = 0; i < MAP.length; i++) if (list.indexOf(MAP[i][0]) >= 0) return MAP[i][1];
    return 'combination';
  }
  function levelOf(r) { return r < 1000 ? 1 : r < 1350 ? 2 : r < 1700 ? 3 : 4; }
  function nice(s) { return String(s || '').replace(/_/g, ' '); }

  var byId = {}, list = [];
  D.pack.rows.split('\n').forEach(function (row) {
    var f = row.split('|');
    var themes = f[4] ? f[4].split('.').map(function (i) { return D.pack.themes[+i]; }) : [];
    var p = {
      id: 'L' + f[0], lichessId: f[0], source: 'lichess', exact: true,
      rating: +f[3], rawFen: f[1], uci: f[2].split(' '), lichessThemes: themes,
      opening: D.pack.openings[+f[5]] || '', flags: f[6] || '',
      theme: appTheme(themes), level: levelOf(+f[3])
    };
    p.goal = themes.indexOf('mate') >= 0 ? 'mate' : 'material';
    var mi = themes.find(function (t) { return /^mateIn\d$/.test(t); });
    p.mateIn = mi ? +mi.slice(6) : (p.goal === 'mate' ? p.uci.length / 2 : null);
    p.woodpecker = p.flags.indexOf('W') >= 0;
    p.repertoire = p.flags.indexOf('O') >= 0;
    p.advanced = p.flags.indexOf('A') >= 0;
    p.title = 'Puzzle ' + f[0];
    p.hint = HINT[p.theme] || HINT.combination;
    lazy(p);
    byId[p.id] = p;
    list.push(p);
  });

  /** Work out position and solution on first use. */
  function materialize(p) {
    if (p._m) return p;
    var g = new CT.Chess(p.rawFen), sans = [], pre = null;
    p.uci.forEach(function (u, i) {
      var m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (i === 0) { pre = { from: m.from, to: m.to, san: m.san }; Object.defineProperty(p, 'fen', { value: g.fen(), writable: true, configurable: true }); }
      else sans.push(m.san);
    });
    var side = new CT.Chess(p.fen).turn(), sideName = side === 'w' ? 'White' : 'Black', opp = side === 'w' ? 'Black' : 'White';
    var goalText = p.goal === 'mate' ? 'Find the checkmate' + (p.mateIn > 1 ? ' in ' + p.mateIn : '') + '.' :
      p.theme === 'defence' ? 'Find the move that holds — your opponent is threatening something.' : 'Find the best move.';
    var labels = p.lichessThemes.filter(function (t) { return LABEL[t] && !/^mateIn/.test(t); }).map(function (t) { return LABEL[t]; });
    var th = D.themes[p.theme] || {};
    var assign = {
      line: sans, pre: pre, side: side,
      prompt: sideName + ' to move. ' + opp + ' just played ' + pre.san + '. ' + goalText,
      explain: 'Solution: ' + sans.join(' ') + '. Ideas in this puzzle: ' + (labels.join(', ') || th.name || 'tactics') + '. ' + (th.idea || '') +
        ' This position comes from a real Lichess game; Lichess rates it ' + p.rating + '.',
      pitfalls: 'In this puzzle only the solution move works at each step (on the final move any checkmate counts). If you chose differently, replay the solution and ask: what did each move threaten that yours did not?'
    };
    Object.keys(assign).forEach(function (k) { Object.defineProperty(p, k, { value: assign[k], writable: true, configurable: true, enumerable: true }); });
    p._m = true;
    return p;
  }
  function lazy(p) {
    ['fen', 'line', 'pre', 'side', 'prompt', 'explain', 'pitfalls'].forEach(function (k) {
      Object.defineProperty(p, k, {
        configurable: true, enumerable: true,
        get: function () { materialize(p); return p[k]; },
        set: function (v) { Object.defineProperty(p, k, { value: v, writable: true, configurable: true, enumerable: true }); }
      });
    });
  }

  D.puzzles = D.puzzles.concat(list);

  CT.Pack = {
    all: function () { return list; },
    get: function (id) { return byId[id] || null; },
    materialize: materialize,
    woodpeckerSet: function () { return list.filter(function (p) { return p.woodpecker; }).sort(function (a, b) { return a.rating - b.rating || (a.id < b.id ? -1 : 1); }); },
    count: list.length,
    label: function (t) { return LABEL[t] || t; },
    nice: nice
  };
})(typeof window !== 'undefined' ? window : globalThis);
