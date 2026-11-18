/*
 * deception.js — Deception Lab content: the trap library and hidden-threat exercises.
 *
 * Traps use the same shape as opening lines ([move, explanation] from the start position), so they
 * open in the same interactive lesson viewer. Extra fields:
 *   setter      — the side that sets the trap (the board is shown from this side)
 *   soundness   — 'sound' (costs nothing if refused), 'conditional' (works only after an opponent error,
 *                 but the setter's moves are fine), 'unsound' (the trap move itself is objectively bad)
 *   mistakePly  — index of the opponent's decisive mistake
 *   finish      — 'mate' (line ends in checkmate) or 'material' (setter is clearly better at the end)
 * tests/content.test.js verifies each claim with the rules engine and the mini-engine.
 */
(function (root) {
  'use strict';

  var traps = [
    {
      id: 'trap-legal', name: 'Légal\'s Mate', opening: 'Philidor-style (1.e4 e5 2.Nf3 d6)', setter: 'w', side: 'w',
      soundness: 'conditional', finish: 'mate', tags: ['queen sacrifice', 'pin illusion', 'mate'], mistakePly: 9,
      summary: 'White "breaks" a pin by sacrificing the queen. If Black greedily takes it, three minor pieces mate the king.',
      mechanism: 'The bishop on g4 pins the f3-knight to White\'s queen — but a pin to the queen is not absolute. Nxe5 attacks f7 together with the c4-bishop; if Black takes the queen, Bxf7+ and Nd5# follow.',
      avoid: 'After 5.Nxe5 Black should play 5…dxe5 or 5…Be6 and give up a pawn, instead of taking the queen.',
      ifNot: 'If Black declines (5…dxe5 6.Qxg4), White is simply a clean pawn up — the engine confirms White stays better against every defence. That is what makes the trap "conditional" but safe to try.',
      pattern: 'A pin against the queen can be broken if moving the pinned piece creates a bigger threat. Look for forcing follow-ups (checks) before assuming a pin holds.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Develop and attack e5.'], ['d6', 'Philidor-style: solid but passive.'],
        ['Bc4', 'Aim at f7.'], ['Bg4', 'Black pins the f3-knight to the queen.'],
        ['Nc3', 'Develop.'], ['g6', 'A careless move: Black wastes a tempo and does not protect e5 a second time.'],
        ['Nxe5', 'The trap! The knight ignores the pin. It attacks f7 together with the bishop.'],
        ['Bxd1', 'The decisive mistake — Black grabs the queen.'],
        ['Bxf7+', 'Check! The king must move.'],
        ['Ke7', 'The only square.'],
        ['Nd5#', 'Checkmate with three minor pieces: the knights cover d6, e6, f6 and c7, and the bishop guards e8. Légal\'s Mate (1750).']
      ]
    },
    {
      id: 'trap-fishing-pole', name: 'Fishing Pole Trap', opening: 'Ruy Lopez (Berlin-style)', setter: 'b', side: 'b',
      soundness: 'unsound', finish: 'mating-net', tags: ['h-file', 'bait piece', 'mate'], mistakePly: 12,
      summary: 'Black leaves a knight on g4 as bait. Taking it opens the h-file — and if White then grabs a pawn instead of defending, Black\'s queen and rook mate on h2/h1.',
      mechanism: 'After hxg4 hxg4 Black\'s rook on h8 stands on an open h-file aimed at White\'s castled king. …Qh4 joins it with the threat …Qh2# / …Qh1#.',
      avoid: 'White does not need to avoid taking the knight — 6.hxg4 is actually White\'s best move. The mistake is the greedy 7.Nxe5?. Correct is 7.Bxc6 (removing a defender) or a calm defensive move.',
      ifNot: 'UNSOUND: against correct play (6.hxg4 hxg4 7.Bxc6) Black is simply a piece down for a pawn. Use this trap only to understand the pattern — in your own games, prefer sound traps.',
      pattern: 'An open h-file against a castled king, plus a queen that can reach h4 or h2, is a mating pattern. When the enemy opens a file toward your king, defend before grabbing material.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Develop.'], ['Nc6', 'Defend e5.'], ['Bb5', 'The Ruy Lopez.'], ['Nf6', 'Berlin-style development.'],
        ['O-O', 'White castles.'], ['Ng4', 'The bait: the knight hangs to h3.'],
        ['h3', 'White attacks it.'], ['h5', 'The "fishing pole": Black leaves the knight en prise to open the h-file.'],
        ['hxg4', 'Taking is fine — this is White\'s best move.'], ['hxg4', 'Now the h-file is open toward White\'s king.'],
        ['Nxe5', 'The real mistake: grabbing a pawn instead of dealing with the threat. (7.Bxc6 was correct.)'],
        ['Qh4', 'Threatening …Qh1# or …Qh2#.'],
        ['f3', 'White makes room for the king…'],
        ['g3', '…but this pawn takes away f2/h2 defences. Whatever White does, …Qh2+ and …Qh1# follow — the engine checks that every White move allows mate in two.']
      ]
    },
    {
      id: 'trap-shilling', name: 'Blackburne Shilling Trap', opening: 'Italian Game (3…Nd4)', setter: 'b', side: 'b',
      soundness: 'unsound', finish: 'mate', tags: ['smothered mate', 'bait pawn', 'f7 attack'], mistakePly: 8,
      summary: 'Black "blunders" the e5-pawn with 3…Nd4. If White greedily takes and then grabs f7 too, Black\'s queen runs riot and a knight mates on f3.',
      mechanism: '…Qg5 forks the e5-knight and g2. After the greedy Nxf7, …Qxg2 hits the rook, then …Qxe4+ and …Nf3# — a smothered mate because White\'s own pieces block the king.',
      avoid: 'After 4…Qg5 White should play 5.Bxf7+! (or 5.Ng4), not 5.Nxf7?. Even better, answer 3…Nd4 with 4.Nxd4 or 4.c3/4.O-O.',
      ifNot: 'UNSOUND: 4.Nxe5 is actually White\'s best move (engine-checked), and after 5.Bxf7+ White is clearly better. Know this trap so you do not fall for it — not to play it.',
      pattern: 'When your opponent leaves material hanging for no reason, look for the counter-attack they prepared (here …Qg5 forking two things) before you grab.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Develop.'], ['Nc6', 'Defend.'], ['Bc4', 'The Italian.'],
        ['Nd4', 'A strange move that leaves e5 hanging — the bait.'],
        ['Nxe5', 'White takes (this is fine, even best).'],
        ['Qg5', 'Counter-attack: the queen hits the e5-knight and g2.'],
        ['Nxf7', 'The real mistake: forking queen and rook… but it ignores g2. (5.Bxf7+ was correct.)'],
        ['Qxg2', 'Now the rook on h1 is attacked.'],
        ['Rf1', 'White saves the rook.'],
        ['Qxe4+', 'Check — the queen keeps eating.'],
        ['Be2', 'The only block.'],
        ['Nf3#', 'Smothered mate! White\'s own bishop and rook take away the king\'s squares.']
      ]
    },
    {
      id: 'trap-englund', name: 'Englund Gambit Trap', opening: '1.d4 e5 (Englund Gambit)', setter: 'b', side: 'w',
      soundness: 'conditional', finish: 'mate', tags: ['queen raid', 'back rank', 'trap to avoid as White'], mistakePly: 10,
      summary: 'A trap against 1.d4 players — including London players who develop Bf4 early. If White defends the a1-rook with Bc3?, …Bb4! leads to mate on c1.',
      mechanism: '…Qb4+ forks the king and b2. After …Qxb2, the natural Bc3? walks into …Bb4!: the pinned bishop falls and …Qc1# mates because d1 and d2 are blocked.',
      avoid: 'Answer …Qb4+ with 5.Nc3 or 5.Nbd2 (or simply 4.Nc3 earlier). After …Qxb2, play 6.Nc3 — never 6.Bc3?.',
      ifNot: 'If White plays correctly (6.Nc3), Black\'s queen raid has achieved little and White is better. Shown from White\'s side so you learn to avoid it.',
      pattern: 'Early queen raids that grab b2 often come with a follow-up pin on the c3/e1 diagonal. Before blocking, ask what the opponent\'s bishop can pin.',
      moves: [
        ['d4', 'Queen\'s pawn.'], ['e5', 'The Englund Gambit — a dubious pawn sacrifice.'],
        ['dxe5', 'Take it.'], ['Nc6', 'Black attacks e5.'], ['Nf3', 'Defend.'], ['Qe7', 'Black attacks e5 again — and prepares a queen raid.'],
        ['Bf4', 'Natural (the London bishop!), but it leaves b2 without the bishop\'s protection.'],
        ['Qb4+', 'Fork: check plus an attack on b2.'],
        ['Bd2', 'Blocking.'],
        ['Qxb2', 'The queen grabs b2 and hits the rook on a1.'],
        ['Bc3', 'The mistake: it looks like it saves the rook with tempo. (6.Nc3 was correct.)'],
        ['Bb4', 'Pin! The c3-bishop is pinned to the king, so it cannot move…'],
        ['Qd2', 'White defends the bishop.'],
        ['Bxc3', 'Take it anyway.'],
        ['Qxc3', 'White recaptures — and the back rank is empty.'],
        ['Qc1#', 'Mate! d1 and d2 are blocked by White\'s own pieces.']
      ]
    },
    {
      id: 'trap-noahs-ark', name: 'Noah\'s Ark Trap', opening: 'Ruy Lopez (Steinitz Deferred)', setter: 'b', side: 'b',
      soundness: 'conditional', finish: 'material', tags: ['trapped bishop', 'pawn chain'], mistakePly: 14, deepMistake: true,
      summary: 'Black\'s queenside pawns (…a6, …b5, …c5, …c4) close around White\'s bishop on b3 like the walls of an ark.',
      mechanism: 'After …b5 the bishop on b3 has few squares. …c5 and …c4 attack it, a4 is covered by the b5-pawn and c2 is blocked by White\'s own pawn, so the bishop is trapped.',
      avoid: 'Do not grab on d4 with the queen (8.Qxd4?). 8.Bd5 or 8.Nxd4 lines avoid the trap; at the end, White can at least get two pawns for the bishop with Bxc4.',
      ifNot: 'The engine confirms that in the final position Black wins material. The earlier moves are classical theory; a deep Stockfish check of the whole line is planned for Phase 4.',
      pattern: 'Bishops on b3/a2 (or g3/h2 for Black) can be shut in by advancing pawns. Before retreating a bishop to the edge, count its escape squares.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Develop.'], ['Nc6', 'Defend.'], ['Bb5', 'Ruy Lopez.'], ['a6', 'Ask the bishop.'],
        ['Ba4', 'Keep the pin.'], ['d6', 'Solid.'], ['d4', 'Central break.'], ['b5', 'Chase the bishop to b3.'],
        ['Bb3', 'The bishop retreats.'], ['Nxd4', 'Black trades on d4…'], ['Nxd4', 'Recapture.'], ['exd4', '…and recaptures.'],
        ['Qxd4', 'The mistake: the queen recaptures the pawn.'],
        ['c5', 'Gain time on the queen and start building the ark.'],
        ['Qd5', 'The queen moves, hitting a8.'], ['Be6', 'Develop with tempo.'],
        ['Qc6+', 'Check.'], ['Bd7', 'Block.'], ['Qd5', 'Back again.'],
        ['c4', 'The ark closes: the b3-bishop is trapped (a4 is covered by b5, c2 is blocked by White\'s pawn). Black wins material.']
      ]
    }
  ];

  traps.forEach(function (t) { t.lessonOnly = true; t.kind = 'trap'; t.library = true; });

  // Repertoire traps and punish lines that also belong in the library (they open in the opening viewer).
  var linkedTraps = [
    { id: 'd4-elephant-trap', tags: ['zwischenzug', 'pin illusion'] },
    { id: 'caro-trap-nd6', tags: ['smothered mate', 'trap to avoid'] },
    { id: 'french-trap-bb5', tags: ['discovered attack', 'queen trap'] },
    { id: 'vienna-bc5-qg4', tags: ['early queen', 'g7 attack'] },
    { id: 'alapin-punish-ne4', tags: ['trapped knight'] },
    { id: 'vienna-punish-ng4', tags: ['loose piece', 'long diagonal'] },
    { id: 'vienna-punish-nc6-ng4', tags: ['loose piece', 'long diagonal'] },
    { id: 'vienna-punish-d5', tags: ['ignored threat', 'pawn attacks piece'] },
    { id: 'vienna-punish-bc5', tags: ['loose pawn', 'counter-attack fails'] },
    { id: 'vienna-punish-nxe4-f4', tags: ['count the defenders', 'fork trick fails'] },
    { id: 'scotch-punish-nf6', tags: ['discovered attack', 'loose bishop'] },
    { id: 'scotch-punish-qxg2', tags: ['greedy queen', 'knight fork'] }
  ];

  /*
   * Hidden-threat exercises: your opponent just moved. Step 1 — find what they threaten (play their move).
   * Step 2 — defend. Defences are judged by the mini-engine; known traps are listed in badDefences.
   */
  var threats = [
    {
      id: 'ht-qh5', title: 'The early queen', moves: 'e4 e5 Bc4 Nc6 Qh5', threats: ['Qxf7#'],
      explain: 'White\'s queen and bishop both aim at f7, which only your king defends: Qxf7 would be checkmate.',
      defence: 'Block or cover f7 with a developing idea: …g6 (also attacks the queen) or …Qe7 / …Qf6. Do NOT play …Nf6?? — it attacks the queen but ignores the mate.',
      badDefences: { Nf6: 'Natural — it attacks the queen — but Qxf7 is checkmate. Always answer threats before making your own.' }
    },
    {
      id: 'ht-ng5', title: 'The knight eyes f7', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5', threats: ['Nxf7', 'Bxf7+'],
      explain: 'Knight and bishop both attack f7. Nxf7 would fork your queen on d8 and rook on h8.',
      defence: 'The main defence is …d5!, blocking the bishop\'s diagonal and hitting e4. (…h6? is too slow: Nxf7 forks queen and rook.)'
    },
    {
      id: 'ht-qb6', title: 'Pressure on b2 (London)', moves: 'd4 d5 Bf4 c5 e3 Qb6', threats: ['Qxb2'],
      explain: 'Your London bishop left c1, so the b2-pawn has no defender. Black threatens …Qxb2, also attacking your b1-knight and a1-rook.',
      defence: 'Defend b2 calmly: Nc3, Qc1 or b3 — or counter with Nc3 and accept that b2 needs care. Know this idea: it is the London\'s most common weakness.'
    },
    {
      id: 'ht-backrank', title: 'The back rank', fen: '4r1k1/4qpp1/7p/8/8/8/2Q2PPP/3R2K1 w - - 0 1', threats: ['Qe1+'],
      explain: 'Black\'s queen and rook are doubled on the open e-file. …Qe1+! Rxe1 Rxe1 would be back-rank mate — your king has no escape square.',
      defence: 'Make an escape square (h3, g3 or h4) or guard e1 a second time. One quiet pawn move removes the threat for the rest of the game.'
    },
    {
      id: 'ht-qe2', title: 'The queen on e2 (Caro-Kann)', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Qe2', threats: ['Nd6#'],
      explain: 'White\'s queen on e2 looks odd — but it pins your e7-pawn. If your g8-knight goes to f6, Nd6 is smothered mate.',
      defence: 'Play …Ndf6 (or …e6 first). The natural …Ngf6?? loses on the spot.',
      badDefences: { Ngf6: 'The blunder: Nd6 is checkmate because the e7-pawn is pinned by the queen on e2.' }
    },
    {
      id: 'ht-englund', title: 'Queen raid on b2', moves: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2', threats: ['Qxa1'],
      explain: 'Black\'s queen has grabbed b2 and now attacks your rook on a1.',
      defence: 'Develop and defend: Nc3! (the knight protects a1-ideas and blocks the diagonal). Beware of Bc3? — it walks into the Englund trap.',
      badDefences: { Bc3: 'Looks natural, but …Bb4! pins the bishop: after Qd2 Bxc3 Qxc3 Qc1# it is mate (see the Englund Gambit Trap).' }, seeTrap: 'trap-englund'
    }
  ];

  // Concepts that need deep calculation are not offered as exercises until Stockfish can verify them.
  var needsStockfish = [
    { name: 'Greek Gift sacrifice (Bxh7+)', why: 'Whether it works depends on lines 6–10 moves deep; the built-in engine cannot verify that safely.' },
    { name: 'Exchange sacrifices', why: 'The compensation is positional; it needs a strong engine to judge honestly.' },
    { name: 'Clearance and interference combinations', why: 'Most instructive examples are 4+ moves deep.' },
    { name: 'Defensive resources ("find the only move")', why: 'Needs exact evaluation of every alternative.' }
  ];

  root.CT = root.CT || {};
  root.CT.Data = root.CT.Data || {};
  root.CT.Data.traps = traps;
  root.CT.Data.linkedTraps = linkedTraps;
  root.CT.Data.threats = threats;
  root.CT.Data.needsStockfish = needsStockfish;
  if (typeof module !== 'undefined' && module.exports) module.exports = { traps: traps, linkedTraps: linkedTraps, threats: threats, needsStockfish: needsStockfish };
})(typeof window !== 'undefined' ? window : globalThis);
