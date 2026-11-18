/*
 * openings.js — Opening repertoire for the Opening Academy.
 *
 * Each line is a list of [move, explanation] pairs from the starting position.
 * kind:
 *   main            — a main line of your repertoire
 *   gambit-accepted / declined — important opponent replies
 *   punish          — the opponent makes a common mistake; you find the punishment
 *   trap            — you set a trap; `soundness` says whether it is sound/conditional/unsound
 *   trap-avoid      — a trap that YOU must not fall into
 * lessonOnly lines are studied in Learn mode only (no drill, not part of sparring).
 * gambitPlies: plies where the learner deliberately gives material (skipped by the soundness check).
 *
 * tests/content.test.js verifies: every move legal and in correct notation; every learner move is
 * not a shallow blunder (mini-engine); every "punish" move really wins material; traps really work;
 * and inside one repertoire you always have exactly one answer in each position (needed for sparring).
 * Stockfish re-verification of evaluations is planned for Phase 4.
 */
(function (root) {
  'use strict';

  var repertoires = [
    {
      id: 'vienna', name: 'Vienna Game', side: 'w', role: 'Main White opening (vs 1…e5)',
      description: 'Develop the queen\'s knight first (2.Nc3), then strike with f2-f4 or aim at f7 with Bc4. Fast development, an open f-file and kingside attacking chances — a great fit for a tactical, aggressive style.',
      plans: [
        ['Middlegame', 'Your pawn on e5 (after f4 and fxe5) gives space on the kingside. Castle, put a rook on the f-file, and bring the queen toward the kingside (Qe1–h4 or Qe2). Knight jumps to g5 often hit h7 and f7.'],
        ['Attack or consolidate?', 'Attack when your pieces are developed and Black\'s king has few defenders. Consolidate (castle, protect e5, finish development) when Black has counterplay in the centre such as …c5 or …f6 hitting your pawn chain. An attack with two pieces is usually just a bluff.'],
        ['Opponents who know theory', 'After 3…d5 the position is about equal. Do not try to force a quick mate — play the solid main line, keep the e5-pawn protected and wait for a mistake.'],
        ['Endgame', 'If the queens come off early, your extra space on the kingside and the half-open f-file still matter: rooks belong on open files. Watch your e5-pawn — in an endgame it can become a target if it is not supported by d4.']
      ],
      lines: ['vienna-d5', 'vienna-exf4', 'vienna-d6', 'vienna-nc6', 'vienna-bc5-qg4', 'vienna-punish-ng4', 'vienna-punish-nh5', 'vienna-punish-nc6-ng4', 'vienna-nc6-gambit', 'vienna-punish-d5', 'vienna-punish-nc6-exf4', 'vienna-punish-bc5', 'vienna-punish-nxe4-f4', 'vienna-punish-nxe4-d3']
    },
    {
      id: 'white-e4', name: 'White vs other defences', side: 'w', role: '1.e4 against the Sicilian, French and Caro-Kann',
      description: 'Simple, space-gaining systems: the Alapin against 1…c5 and the Advance Variation against both 1…e6 and 1…c6. Fewer forcing lines to memorise; clear pawn-structure plans.',
      plans: [
        ['Alapin (2.c3)', 'You prepare d4 so that if Black takes on d4 you recapture with a pawn and keep a big centre. If you end up with an isolated d-pawn, use it as an attacking asset: pieces on active squares, knight to e5, rook lift.'],
        ['Advance (e5 pawn)', 'Your e5-pawn cramps Black\'s kingside. Black will attack the base of your chain (d4) with …c5, …Nc6, …Qb6. Protect d4 first; attack on the kingside second.'],
        ['When not to attack', 'If Black has not weakened the kingside and your d4 is under pressure, defend d4 before anything else. Losing the centre loses the whole idea of these openings.']
      ],
      lines: ['alapin-d5', 'alapin-nf6', 'alapin-punish-ne4', 'french-advance', 'french-trap-bb5', 'caro-advance-white']
    },
    {
      id: 'caro', name: 'Caro-Kann Defence', side: 'b', role: 'Main Black defence vs 1.e4',
      description: 'Solid structure first, counterattack second. The light-squared bishop comes out before …e6, so Black has no "bad bishop". Opponents who over-press against it often walk into tactics.',
      plans: [
        ['Typical structure', 'Pawns on c6 and e6 (later), bishop outside the chain, knights on d7 and f6. Your position has no weaknesses, so White must take risks to make progress.'],
        ['Counterattack', 'The pawn break …c5 hits White\'s centre. In the Advance, …c5 attacks the base of White\'s chain; in the Exchange, the half-open c-file and …b5–b4 (minority attack) are your plans.'],
        ['Punishing over-aggressive White players', 'When White pushes pawns (h4–h5, g4) without development, keep calm, finish development and strike in the centre. Loose pawns become targets later.']
      ],
      lines: ['caro-classical', 'caro-advance', 'caro-exchange', 'caro-panov', 'caro-two-knights', 'caro-trap-nd6']
    },
    {
      id: 'vs-d4', name: 'Black vs 1.d4', side: 'b', role: 'One simple …d5 / …Nf6 / …e6 setup',
      description: 'The same plan against almost everything: …d5, …Nf6, …e6, develop the f8-bishop, castle, and strike with …c5. Few variations to memorise — understanding the setup matters more than move orders.',
      plans: [
        ['The setup', '…d5, …Nf6, …e6, …Bd6 or …Be7, …O-O, then …c5 (or …c6 against the Queen\'s Gambit). Knights on c6 and f6.'],
        ['Against the London and Colle', 'Play …c5 and …Nc6 to pressure d4. If White\'s dark-squared bishop leaves c1, look at …Qb6 hitting b2.'],
        ['Against the Queen\'s Gambit', 'Keep the d5 pawn (…e6 supports it). Trade pieces with …Ne4 or …dxc4 then …c5 when cramped. Watch for the Elephant Trap trick if White grabs on d5.']
      ],
      lines: ['d4-london', 'd4-qgd', 'd4-elephant-trap', 'd4-fianchetto', 'd4-colle']
    },
    {
      id: 'scotch', name: 'Scotch Game', side: 'w', role: 'Secondary White option (vs 1…e5)',
      description: 'Open the centre immediately with 3.d4. Clear piece play and fewer gambit risks than the Vienna — a useful second weapon.',
      plans: [
        ['Main idea', 'Trade your d-pawn for Black\'s e-pawn to get a free hand in the centre. Develop quickly; Black\'s c-pawns often get doubled after Nxc6.'],
        ['Middlegame', 'Keep the e5-pawn when you can — it cramps Black\'s knight on f6. Castle and use the open d-file.']
      ],
      lines: ['scotch-mieses', 'scotch-classical', 'scotch-steinitz', 'scotch-punish-nf6', 'scotch-punish-nge7', 'scotch-punish-qxg2']
    }
  ];

  var comingSoon = [
    { name: 'Vienna: 2…Bc5 3.Nf3 / 3.Bc4 systems and deeper 3…d5 sidelines (5.d3, 5.Qf3)', side: 'w', phase: 'later' },
    { name: 'Alapin: 2…e6, 2…Nc6 and 2…d6 transpositions', side: 'w', phase: 'later' },
    { name: 'Caro-Kann: Fantasy Variation (3.f3) and 2.d3 setups', side: 'b', phase: 'later' },
    { name: 'Black vs 1.d4: Trompowsky (2.Bg5), Jobava London and 1.c4 / 1.Nf3', side: 'b', phase: 'later' }
  ];

  var lines = [
    /* ===================== VIENNA ===================== */
    {
      id: 'vienna-d5', repertoire: 'vienna', side: 'w', kind: 'main',
      name: 'Vienna Gambit: 3…d5 (main line)',
      summary: 'Black\'s best answer to the gambit is to hit back in the centre. White gets a big pawn on e5, an open f-file after castling and a target: the black knight on e4.',
      moves: [
        ['e4', 'Claim the centre and open lines for your queen and light-squared bishop.'],
        ['e5', 'Black claims the centre too.'],
        ['Nc3', 'The Vienna. You develop the queen\'s knight first so the f-pawn stays free to advance to f4 — that is the attacking idea of this whole opening. The knight also guards e4 and d5.'],
        ['Nf6', 'Black\'s most common reply: develop and attack e4.'],
        ['f4', 'The Vienna Gambit! You offer the f-pawn to open the f-file and gain space. Unlike the King\'s Gambit, your knight on c3 already protects e4. Honest note: with perfect play this is about equal (deep Stockfish even gives Black a tiny edge after 3…d5). You play it because Black must find several accurate moves, and most club players do not.'],
        ['d5', 'Black\'s most principled answer: counterattack in the centre instead of grabbing a pawn.'],
        ['fxe5', 'Capture. Your pawn on e5 now kicks the f6-knight away and cramps Black\'s kingside.'],
        ['Nxe4', 'The knight jumps into the centre. It looks active — but it is also a target you can chase later.'],
        ['Nf3', 'Develop, protect e5 and prepare d4 and castling. Do not rush: development first, attack second.'],
        ['Be7', 'Black develops and prepares to castle.'],
        ['d4', 'Build a big centre. The e5-pawn is now solidly protected and gives you extra space on the kingside — the side where you will attack.'],
        ['O-O', 'Black castles.'],
        ['Bd3', 'Aim the bishop at the e4-knight and, behind it, at h7 and the black king.'],
        ['f5', 'Black supports the knight on e4 with a pawn — but this allows a special capture.'],
        ['exf6', 'En passant! You capture the f5-pawn as if it had moved only one square. This opens the f-file toward Black\'s king and removes the knight\'s pawn support.'],
        ['Bxf6', 'Black recaptures, developing the bishop.'],
        ['O-O', 'Castle — and your rook lands on the open f-file. Typical plans: remove the e4-knight with Nxe4 or Bxe4, bring the queen toward the kingside (Qe1–h4) and look for Ng5 ideas against h7. Attack only once your pieces are developed.']
      ],
      gambitPlies: [4]
    },
    {
      id: 'vienna-exf4', repertoire: 'vienna', side: 'w', kind: 'gambit-accepted',
      name: 'Vienna Gambit accepted: 3…exf4',
      summary: 'Taking the pawn is natural but lets you gain time by kicking the f6-knight. You will usually win the pawn back with Bxf4 and keep a strong centre.',
      moves: [
        ['e4', 'Claim the centre.'],
        ['e5', 'Black mirrors.'],
        ['Nc3', 'Vienna: knight first, f-pawn stays free.'],
        ['Nf6', 'Develop and attack e4.'],
        ['f4', 'The gambit.'],
        ['exf4', 'Black accepts the pawn. Tempting — but it gives you a free tempo.'],
        ['e5', 'Kick the knight! It has no comfortable square: on g4 or h5 your queen simply captures it (see the "punish" lessons), and e4 is exposed.'],
        ['Ng8', 'The knight goes home. It is safe, but Black has lost time.'],
        ['Nf3', 'Develop, and the knight stops …Qh4+ ideas by covering h4.'],
        ['d6', 'Black challenges your e5-pawn.'],
        ['d4', 'Build the centre and open the c1-bishop. Your plan: recapture the f4-pawn with Bxf4, castle, and use your lead in development. Keep the pawn on e5 well protected.']
      ],
      gambitPlies: [4]
    },
    {
      id: 'vienna-d6', repertoire: 'vienna', side: 'w', kind: 'declined',
      name: 'Vienna Gambit declined: 3…d6',
      summary: 'Black keeps everything solid. You simply develop, pressure e5 and keep the option of fxe5 to open the f-file when it suits you.',
      moves: [
        ['e4', 'Claim the centre.'],
        ['e5', 'Black mirrors.'],
        ['Nc3', 'Vienna.'],
        ['Nf6', 'Develop and attack e4.'],
        ['f4', 'The gambit.'],
        ['d6', 'Black declines quietly, supporting e5. Solid but a bit passive.'],
        ['Nf3', 'Develop and add a second attacker to e5. If Black ever allows fxe5 dxe5, your rook will love the half-open f-file after castling.'],
        ['Nc6', 'Black defends e5 again.'],
        ['Bb5', 'Pin the c6-knight, which is one of the defenders of e5. Typical continuation: d3, castle, and choose the right moment for fxe5. Remember: when the position is closed, improve your pieces before you attack.']
      ],
      gambitPlies: [4]
    },
    {
      id: 'vienna-nc6', repertoire: 'vienna', side: 'w', kind: 'main',
      name: 'Vienna vs 2…Nc6: Bc4, d3 and f4',
      summary: 'Against 2…Nc6 you aim the bishop at f7 first, build with d3, and then play f4 — a safer version of the King\'s Gambit idea because your centre is already protected.',
      moves: [
        ['e4', 'Claim the centre.'],
        ['e5', 'Black mirrors.'],
        ['Nc3', 'Vienna.'],
        ['Nc6', 'Black develops the other knight first. Now 3.f4 is riskier, so you change plan.'],
        ['Bc4', 'Aim at f7 — the weakest square in Black\'s camp, defended only by the king.'],
        ['Nf6', 'Natural development.'],
        ['d3', 'Protect e4 with a pawn so it can never become a target, and open the c1-bishop. Now f4 is safe.'],
        ['Bc5', 'Black aims the bishop at your f2/g1 diagonal.'],
        ['f4', 'Now the f-pawn advance! Your e4 is solid (d3, Nc3) so you can afford it. If Black plays …Ng4?, your queen captures it — see the punish lesson.'],
        ['d6', 'Black supports e5.'],
        ['Nf3', 'Develop and pressure e5. Plans: castle, then f5 (cramping Black) or fxe5 opening the f-file; Na4 to trade off the strong c5-bishop. Until you castle, beware of checks on the a7–g1 diagonal.']
      ]
    },
    {
      id: 'vienna-bc5-qg4', repertoire: 'vienna', side: 'w', kind: 'trap', soundness: 'conditional',
      name: 'Tactical idea: 3…Bc5 4.Qg4 (hitting g7)',
      summary: 'After 2…Nc6 3.Bc4 Bc5 the queen jumps to g4, attacking the undefended g7-pawn. This is a CONDITIONAL idea: it only wins a pawn if Black ignores the threat (…d6? or …Nf6?). After the correct defences …Qf6, …g6 or …Kf8 the position is roughly equal and your queen is a bit exposed — so develop quickly and do not chase further.',
      moves: [
        ['e4', 'Claim the centre.'],
        ['e5', 'Black mirrors.'],
        ['Nc3', 'Vienna.'],
        ['Nc6', 'Black develops.'],
        ['Bc4', 'Aim at f7.'],
        ['Bc5', 'Black copies your bishop move — and leaves g7 without its natural defender (a knight on f6 or a bishop on e7 would block the queen\'s path).'],
        ['Qg4', 'A queen move with a concrete threat: Qxg7, also hitting the rook. Early queen moves are only good when they create a threat the opponent must answer.'],
        ['d6', 'A natural developing move — but it ignores the threat. (Correct was …Qf6, …g6 or …Kf8.)'],
        ['Qxg7', 'Wins a pawn and attacks the h8-rook. Black must spend another move on the rook, and Black\'s king loses its shelter. Afterwards: retreat or trade the queen when it is attacked and finish development.']
      ],
      mistakePly: 7
    },
    {
      id: 'vienna-punish-ng4', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 4…Ng4? in the gambit',
      summary: 'After 3…exf4 4.e5 the knight must retreat. 4…Ng4? looks active but the square g4 is covered by your queen on d1 (the diagonal d1–e2–f3–g4 is open). Always check long diagonals for your queen.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'Gambit.'], ['exf4', 'Accepted.'],
        ['e5', 'Kick the knight.'],
        ['Ng4', 'A beginner mistake: the knight looks active, but it is undefended on a square your queen controls.'],
        ['Qxg4', 'Free piece! Nothing defends g4. The lesson works both ways: before moving a piece, ask "who attacks that square?" — including queens far away.']
      ],
      mistakePly: 7, gambitPlies: [4]
    },
    {
      id: 'vienna-punish-nh5', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 4…Nh5? in the gambit',
      summary: 'The knight on the rim is also on your queen\'s diagonal (d1–h5). Same pattern as …Ng4?: a long-range queen capture.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'Gambit.'], ['exf4', 'Accepted.'],
        ['e5', 'Kick the knight.'],
        ['Nh5', '"A knight on the rim is dim" — and here it is also hanging.'],
        ['Qxh5', 'Your queen travels d1–e2–f3–g4–h5 and takes a free knight. Deceptive chess starts with seeing these long, quiet lines that opponents forget about.']
      ],
      mistakePly: 7, gambitPlies: [4]
    },
    {
      id: 'vienna-punish-nc6-ng4', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: …Ng4? after f4 (2…Nc6 line)',
      summary: 'The knight jump to g4 (aiming at f2 and e3 with the bishop on c5) is a common idea — but with the e2-square empty your queen sees g4 directly.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nc6', 'Develop.'], ['Bc4', 'Aim at f7.'], ['Nf6', 'Develop.'],
        ['d3', 'Solid centre.'], ['Bc5', 'Active bishop.'], ['f4', 'The f-pawn advance.'],
        ['Ng4', 'Black hopes for …Nf2 forking your queen and rook, or …Ne3. But the knight is loose on g4.'],
        ['Qxg4', 'Simply take it. Your queen on d1 attacks g4 through the empty e2 and f3 squares. Black\'s "attack" disappears and you are a piece up.']
      ],
      mistakePly: 9
    },

    /* ===================== WHITE vs OTHER DEFENCES ===================== */
    {
      id: 'alapin-d5', repertoire: 'white-e4', side: 'w', kind: 'main',
      name: 'Alapin Sicilian: 2…d5',
      summary: 'Black hits your centre immediately and recaptures with the queen. You gain time by developing with threats against the queen and aim for a free, open game. If Black takes on d4, recapture with the c-pawn.',
      moves: [
        ['e4', 'Centre.'],
        ['c5', 'The Sicilian — the most popular defence to 1.e4.'],
        ['c3', 'The Alapin: prepare d4, so that after …cxd4 you can recapture with a pawn and keep two centre pawns. Far less theory than the Open Sicilian.'],
        ['d5', 'Black challenges e4 at once.'],
        ['exd5', 'Take. Black will recapture with the queen.'],
        ['Qxd5', 'The queen comes to the centre early — usually fine here because your c3-pawn takes the c3-square away from your own knight.'],
        ['d4', 'Build the centre and open the c1-bishop.'],
        ['Nf6', 'Black develops.'],
        ['Nf3', 'Develop. Your plan: Be2, O-O, and later Nc3 or c4 with tempo on the queen.'],
        ['e6', 'Black opens the f8-bishop.'],
        ['Be2', 'Quiet development and castling. If Black plays …cxd4 cxd4 you get an isolated d-pawn: an attacking asset (outpost on e5, open c- and e-files) as long as you keep pieces active.']
      ]
    },
    {
      id: 'alapin-nf6', repertoire: 'white-e4', side: 'w', kind: 'main',
      name: 'Alapin Sicilian: 2…Nf6',
      summary: 'Black attacks e4. You push e5 to gain space and chase the knight, then build a big centre. The pin Bb5 adds pressure on Black\'s defenders.',
      moves: [
        ['e4', 'Centre.'],
        ['c5', 'Sicilian.'],
        ['c3', 'Alapin.'],
        ['Nf6', 'Attack e4. Since c3 took the knight\'s square, e4 has no piece defender.'],
        ['e5', 'Gain space with tempo — the knight must move.'],
        ['Nd5', 'The best square: central and safe. (3…Ne4? is a mistake — see the punish lesson.)'],
        ['d4', 'Build the centre.'],
        ['cxd4', 'Black trades.'],
        ['Nf3', 'Develop first; you can recapture on d4 next move.'],
        ['Nc6', 'Black develops and adds pressure on d4 and e5.'],
        ['cxd4', 'Recapture with the pawn: two strong centre pawns.'],
        ['d6', 'Black attacks your e5-pawn.'],
        ['Bc4', 'Develop and hit the d5-knight.'],
        ['Nb6', 'The knight retreats and attacks your bishop.'],
        ['Bb5', 'Pin the c6-knight, which is one of the pieces attacking your centre — pinned pieces defend and attack badly. Plans: O-O, Nc3, and keep e5 protected. If Black takes on e5, recapture with the knight.']
      ]
    },
    {
      id: 'alapin-punish-ne4', repertoire: 'white-e4', side: 'w', kind: 'punish',
      name: 'Punish it: 3…Ne4?! knight in a trap',
      summary: 'After 2…Nf6 3.e5 the knight must retreat. On e4 it looks active, but after d3 it has NO safe square: f6 and d6 are covered by your e5-pawn, g5 by your bishop, c5 is blocked by Black\'s own pawn, and c3/f2/g3 just lose it. This is the "trapped piece" pattern.',
      moves: [
        ['e4', 'Centre.'], ['c5', 'Sicilian.'], ['c3', 'Alapin.'], ['Nf6', 'Attack e4.'],
        ['e5', 'Chase the knight.'],
        ['Ne4', 'A mistake: the knight goes forward instead of to d5.'],
        ['d3', 'Attack it again. Count its squares: d6 and f6 (your pawn covers them), g5 (your bishop), c5 (its own pawn), g3 (your h-pawn). The knight is trapped — Black can only get a pawn or two for it. (4.Nf3 is also strong, but d3 is the cleanest.)']
      ],
      mistakePly: 5, alsoGood: ['Nf3']
    },
    {
      id: 'french-advance', repertoire: 'white-e4', side: 'w', kind: 'main',
      name: 'Advance French: 3.e5',
      summary: 'You grab space with e5 and support your d4-pawn with c3 and Nf3. Black attacks the base of your chain (d4) with …c5, …Nc6 and …Qb6. Keep d4 safe, then use your kingside space.',
      moves: [
        ['e4', 'Centre.'],
        ['e6', 'The French Defence: Black prepares …d5.'],
        ['d4', 'Take the full centre.'],
        ['d5', 'Black challenges e4.'],
        ['e5', 'The Advance Variation: gain space and lock Black\'s c8-bishop behind the e6-pawn.'],
        ['c5', 'Black attacks the base of your pawn chain — the standard French plan.'],
        ['c3', 'Support d4 with a pawn so that …cxd4 can be met by cxd4.'],
        ['Nc6', 'More pressure on d4.'],
        ['Nf3', 'A third defender of d4.'],
        ['Qb6', 'The queen hits d4 and b2.'],
        ['a3', 'A useful waiting move: you prepare b4 to gain queenside space. (6.Bd3 is a gambit with a famous trap — see the trap lesson.)']
      ]
    },
    {
      id: 'french-trap-bb5', repertoire: 'white-e4', side: 'w', kind: 'trap', soundness: 'conditional', lessonOnly: true,
      name: 'Trap: Milner-Barry gambit and Bb5+',
      summary: 'With 6.Bd3 you offer the d4-pawn. If Black grabs it with the knight and then the queen, Bb5+ uncovers your queen\'s attack on d4 — a discovered attack that wins Black\'s queen. CONDITIONAL: correct for Black is 7…Bd7!, after which White is simply gambiting a pawn for development. This is why the main repertoire uses 6.a3.',
      moves: [
        ['e4', 'Centre.'], ['e6', 'French.'], ['d4', 'Centre.'], ['d5', 'Challenge.'], ['e5', 'Advance.'], ['c5', 'Hit the chain.'],
        ['c3', 'Support.'], ['Nc6', 'Pressure.'], ['Nf3', 'Defend.'], ['Qb6', 'Pressure on d4 and b2.'],
        ['Bd3', 'A gambit: you develop and allow Black to take on d4.'],
        ['cxd4', 'Black trades.'],
        ['cxd4', 'Recapture.'],
        ['Nxd4', 'Grabbing the pawn — the beginning of the trap. (Correct: 7…Bd7, preventing the coming check.)'],
        ['Nxd4', 'Trade knights.'],
        ['Qxd4', 'Black\'s queen takes the pawn. It looks like Black has just won a pawn…'],
        ['Bb5+', 'Discovered attack! The bishop moves with check, uncovering your queen on d1 against Black\'s queen on d4. Black must answer the check, and next you play Qxd4.']
      ],
      mistakePly: 15, gambitPlies: [10, 14]
    },
    {
      id: 'caro-advance-white', repertoire: 'white-e4', side: 'w', kind: 'main',
      name: 'Advance Caro-Kann (as White): 3.e5',
      summary: 'Against the Caro-Kann you take space with e5 and develop quietly (the "Short System"). Black\'s plan is …c5 against d4; meet it calmly and keep your pieces flexible.',
      moves: [
        ['e4', 'Centre.'],
        ['c6', 'The Caro-Kann.'],
        ['d4', 'Take the centre.'],
        ['d5', 'Black challenges e4.'],
        ['e5', 'The Advance Variation: space on the kingside.'],
        ['Bf5', 'Black develops the bishop outside the pawn chain — the point of the Caro-Kann.'],
        ['Nf3', 'Quiet development: Nf3, Be2, O-O.'],
        ['e6', 'Black builds the chain.'],
        ['Be2', 'Prepare to castle.'],
        ['c5', 'Black hits d4.'],
        ['Be3', 'Protect d4 with a piece and keep the option of dxc5 when it gains time. Plans: O-O, c3 or Nbd2, and use the e5-pawn for kingside play.']
      ]
    },

    /* ===================== CARO-KANN (BLACK) ===================== */
    {
      id: 'caro-classical', repertoire: 'caro', side: 'b', kind: 'main',
      name: 'Classical Caro-Kann: 4…Bf5',
      summary: 'The heart of your Black repertoire. Develop the light-squared bishop actively, answer h4–h5 calmly, then play …e6, …Ngf6 and later strike with …c5. Solid first, counterattack later.',
      moves: [
        ['e4', 'White\'s most common first move.'],
        ['c6', 'The Caro-Kann. It prepares …d5 with pawn support, so you keep a pawn in the centre after trades — and your light-squared bishop can come out before …e6.'],
        ['d4', 'White takes the full centre.'],
        ['d5', 'Challenge e4 immediately.'],
        ['Nc3', 'White defends e4 with a piece. (3.e5 is the Advance, 3.exd5 the Exchange — separate lessons.)'],
        ['dxe4', 'Release the tension: you trade pawns and White\'s knight recaptures.'],
        ['Nxe4', 'White\'s knight is now centralised.'],
        ['Bf5', 'The Classical Variation: develop the bishop to its best diagonal while attacking the knight. This is the reason the Caro-Kann exists — the bishop gets out before …e6 shuts it in.'],
        ['Ng3', 'The knight retreats with tempo, attacking your bishop.'],
        ['Bg6', 'Keep the bishop on its active diagonal.'],
        ['h4', 'White threatens h5, chasing your bishop.'],
        ['h6', 'Important! This frees the h7-square for the bishop. Without …h6, after h5 the bishop would have to give up its diagonal (…Bf5) and could be traded off by the g3-knight.'],
        ['Nf3', 'White develops.'],
        ['Nd7', 'This knight controls e5 (stopping Ne5 ideas) and prepares …Ngf6.'],
        ['h5', 'White gains space on the kingside.'],
        ['Bh7', 'The bishop drops back — exactly why you played …h6.'],
        ['Bd3', 'White offers to trade off your good bishop.'],
        ['Bxd3', 'Trade. Your position becomes freer and you no longer need to worry about the bishop.'],
        ['Qxd3', 'White recaptures.'],
        ['e6', 'Now that your bishop is outside the pawn chain, …e6 is perfect: it opens the f8-bishop and controls d5.'],
        ['Bd2', 'White prepares to castle queenside.'],
        ['Ngf6', 'Develop and protect your king.'],
        ['O-O-O', 'Kings on opposite sides — both sides can attack.'],
        ['Be7', 'Finish developing. Typical plans: …Qc7, castle, and strike White\'s centre with …c5. Your structure has no weaknesses — make White prove something.']
      ]
    },
    {
      id: 'caro-advance', repertoire: 'caro', side: 'b', kind: 'main',
      name: 'Advance Variation: 3.e5 Bf5',
      summary: 'White grabs space. You develop the bishop outside the chain first, then play …e6 and hit the base of White\'s pawn chain with …c5.',
      moves: [
        ['e4', 'King\'s pawn.'],
        ['c6', 'Caro-Kann.'],
        ['d4', 'White takes the centre.'],
        ['d5', 'Challenge it.'],
        ['e5', 'The Advance Variation: White gains space and blocks the centre.'],
        ['Bf5', 'Again — bishop out before …e6.'],
        ['Nf3', 'Quiet development (the "Short System").'],
        ['e6', 'Now close the chain. Your bishop is already outside it.'],
        ['Be2', 'White prepares to castle.'],
        ['c5', 'Strike at the base of White\'s pawn chain (d4)! Typical follow-ups: …Nc6, …Qb6 and …cxd4 to pressure d4. Attack chains at their base, not their head.']
      ]
    },
    {
      id: 'caro-exchange', repertoire: 'caro', side: 'b', kind: 'main',
      name: 'Exchange Variation: 3.exd5',
      summary: 'A symmetrical structure. Develop actively (…Nc6, …Nf6, …Bg4), keep b7 protected, and later use the half-open c-file and a queenside minority attack.',
      moves: [
        ['e4', 'King\'s pawn.'],
        ['c6', 'Caro-Kann.'],
        ['d4', 'White takes the centre.'],
        ['d5', 'Challenge it.'],
        ['exd5', 'The Exchange Variation.'],
        ['cxd5', 'Recapture with the c-pawn — you now have a half-open c-file.'],
        ['Bd3', 'White aims the bishop at h7.'],
        ['Nc6', 'Develop and pressure d4.'],
        ['c3', 'White supports d4.'],
        ['Nf6', 'Develop. This also guards h7.'],
        ['Bf4', 'White develops.'],
        ['Bg4', 'Get the bishop out before …e6 — and it attacks White\'s queen on d1.'],
        ['Qb3', 'White counterattacks the b7-pawn (and eyes d5).'],
        ['Qd7', 'The calm way to protect b7: the queen guards it along the 7th rank. Next: …e6, …Bd6, castle. Don\'t grab material if it means falling behind in development.']
      ]
    },
    {
      id: 'caro-panov', repertoire: 'caro', side: 'b', kind: 'main',
      name: 'Panov Attack: 3.exd5 cxd5 4.c4',
      summary: 'White attacks your d5-pawn with c4, aiming for an isolated-pawn position. Develop with …Nf6 and …e6, and if White takes on d5, recapture with the knight. Your target later: White\'s isolated d4-pawn.',
      moves: [
        ['e4', 'King\'s pawn.'],
        ['c6', 'Caro-Kann.'],
        ['d4', 'Centre.'],
        ['d5', 'Challenge.'],
        ['exd5', 'Exchange…'],
        ['cxd5', 'Recapture.'],
        ['c4', '…but now the Panov: White attacks d5 again.'],
        ['Nf6', 'Defend d5 with a piece and develop.'],
        ['Nc3', 'More pressure on d5.'],
        ['e6', 'Solid: support d5 and open the bishop.'],
        ['Nf3', 'White develops.'],
        ['Be7', 'Develop and prepare to castle.'],
        ['cxd5', 'White releases the tension.'],
        ['Nxd5', 'Recapture with the knight: it sits on a great central square in front of White\'s isolated d-pawn. Plans: …O-O, …Nc6, …Bf6 and pressure on d4. Trade pieces — isolated pawns get weaker in endgames.']
      ]
    },
    {
      id: 'caro-two-knights', repertoire: 'caro', side: 'b', kind: 'main',
      name: 'Two Knights: 2.Nc3 d5 3.Nf3',
      summary: 'White develops knights instead of playing d4. Pin the f3-knight with …Bg4, trade it, and build the solid …e6 / …Nf6 setup. White gets the bishop pair but no weaknesses to attack in your position.',
      moves: [
        ['e4', 'King\'s pawn.'],
        ['c6', 'Caro-Kann.'],
        ['Nc3', 'White develops a knight first.'],
        ['d5', 'Same idea: challenge e4.'],
        ['Nf3', 'The Two Knights Variation.'],
        ['Bg4', 'Pin the knight to the queen and prepare to trade it.'],
        ['h3', 'White asks the bishop what it wants.'],
        ['Bxf3', 'Trade — this is the point of …Bg4. White recaptures with the queen.'],
        ['Qxf3', 'White\'s queen is active, but Black has no weaknesses.'],
        ['e6', 'Solid: d5 is supported and your f8-bishop is free.'],
        ['d3', 'White keeps the centre closed.'],
        ['Nf6', 'Develop. Plans: …Nbd7, …Be7 or …Bb4, castle, and later …d4 or …dxe4 to open lines in the centre.']
      ]
    },
    {
      id: 'caro-trap-nd6', repertoire: 'caro', side: 'b', kind: 'trap-avoid', soundness: 'conditional',
      lessonOnly: true,
      name: 'Trap to avoid: 5.Qe2 and Nd6#',
      summary: 'A famous trap in the 4…Nd7 Caro-Kann. 5.Qe2 is a reasonable move for White, but it only wins if Black plays the natural-looking …Ngf6??. This is a CONDITIONAL trap: it works only when the opponent blunders. Safe instead: 5…Ndf6 (the engine check finds no tactic for White after it).',
      safeAlternative: { afterPly: 9, move: 'Ndf6' },
      moves: [
        ['e4', 'King\'s pawn.'],
        ['c6', 'Caro-Kann.'],
        ['d4', 'Centre.'],
        ['d5', 'Challenge.'],
        ['Nc3', 'Main move.'],
        ['dxe4', 'Release the tension.'],
        ['Nxe4', 'Knight recaptures.'],
        ['Nd7', 'The Karpov Variation (an alternative to 4…Bf5), preparing …Ngf6.'],
        ['Qe2', 'Sneaky! The queen looks oddly placed, but it now stares down the e-file at your king.'],
        ['Ngf6', 'The natural move — and a blunder. (Safe was 5…Ndf6.)'],
        ['Nd6#', 'Smothered mate! The e7-pawn cannot capture because it is pinned to the king by the queen on e2, and the king is boxed in by its own pieces. Lesson: when a queen lines up with your king on an open file, check every knight check.']
      ]
    },

    /* ===================== BLACK vs 1.d4 ===================== */
    {
      id: 'd4-london', repertoire: 'vs-d4', side: 'b', kind: 'main',
      name: 'vs the London System: 2.Bf4',
      summary: 'Against the London, play …c5 early to pressure d4, then …Nc6, …e6, …Bd6 to challenge White\'s strong f4-bishop. You know the London from the White side — now you know its weak spots: b2 and d4.',
      moves: [
        ['d4', 'Queen\'s pawn.'],
        ['d5', 'Your setup starts with …d5: claim the centre.'],
        ['Bf4', 'The London System.'],
        ['Nf6', 'Develop, control e4.'],
        ['e3', 'White supports d4 and opens the f1-bishop.'],
        ['c5', 'Hit d4 at once. The London bishop has left c1, so b2 can become weak after …Qb6.'],
        ['c3', 'White supports d4.'],
        ['Nc6', 'More pressure on d4.'],
        ['Nd2', 'White prepares Ngf3 and keeps e4 under control.'],
        ['e6', 'Open your f8-bishop.'],
        ['Ngf3', 'White develops.'],
        ['Bd6', 'Challenge the f4-bishop — London players hate losing it.'],
        ['Bg3', 'White keeps the bishop.'],
        ['O-O', 'Castle. Next: …Qe7 or …Qc7 and …e5, or …b6 with …Bb7. Look for …Qb6 whenever b2 is only defended once.']
      ]
    },
    {
      id: 'd4-qgd', repertoire: 'vs-d4', side: 'b', kind: 'main',
      name: 'vs the Queen\'s Gambit: Orthodox setup',
      summary: 'Against 2.c4, keep your d5-pawn with …e6, develop with …Nf6, …Nbd7, …Be7 and castle. Later free your position with …c6 and …dxc4 or …Ne4 trades.',
      moves: [
        ['d4', 'Queen\'s pawn.'],
        ['d5', 'Claim the centre.'],
        ['c4', 'The Queen\'s Gambit: White offers the c-pawn to deflect your d5-pawn.'],
        ['e6', 'Decline: support d5 with a pawn. Solid and simple.'],
        ['Nc3', 'White adds pressure on d5.'],
        ['Nf6', 'Defend d5 again and develop.'],
        ['Bg5', 'White pins the knight to your queen.'],
        ['Nbd7', 'A useful move: it supports f6 and sets a trap (see the Elephant Trap lesson).'],
        ['e3', 'White supports d4.'],
        ['Be7', 'Break the pin: now the f6-knight is defended and no longer pinned to the queen.'],
        ['Nf3', 'White develops.'],
        ['O-O', 'Castle.'],
        ['Rc1', 'White prepares pressure on the c-file.'],
        ['c6', 'Strengthen d5 and prepare …dxc4 followed by …Nd5 to trade pieces and free your position.']
      ]
    },
    {
      id: 'd4-elephant-trap', repertoire: 'vs-d4', side: 'b', kind: 'punish', soundness: 'sound',
      name: 'The Elephant Trap (…Nbd7 and Nxd5?)',
      summary: 'After …Nbd7 it looks like White can win a pawn on d5 because your f6-knight is pinned. It is an illusion: …Nxd5! gives up your queen for a moment, then …Bb4+ wins it back with interest. Your 4…Nbd7 is a perfectly good move, so this trap costs you nothing — a "sound" trap.',
      moves: [
        ['d4', 'Queen\'s pawn.'], ['d5', 'Centre.'], ['c4', 'Queen\'s Gambit.'], ['e6', 'Decline.'], ['Nc3', 'Pressure d5.'], ['Nf6', 'Develop.'],
        ['Bg5', 'Pin.'],
        ['Nbd7', 'The key move of the trap — natural development.'],
        ['cxd5', 'White exchanges…'],
        ['exd5', 'Recapture.'],
        ['Nxd5', 'The mistake: White thinks your f6-knight is pinned and cannot recapture.'],
        ['Nxd5', 'It is NOT really pinned: you can give up the queen…'],
        ['Bxd8', 'White takes your queen.'],
        ['Bb4+', 'Zwischenzug (in-between move)! Check — and White can only block with the queen.'],
        ['Qd2', 'The only move.'],
        ['Bxd2+', 'Take the queen with check.'],
        ['Kxd2', 'White recaptures.'],
        ['Kxd8', 'And you take the bishop. Count: you are a whole piece up. Pattern: a pin is not real if the "pinned" piece can move with a bigger threat.']
      ],
      mistakePly: 10, gambitPlies: [11]
    },
    {
      id: 'd4-fianchetto', repertoire: 'vs-d4', side: 'b', kind: 'main',
      name: 'vs the fianchetto (2.Nf3, 3.g3)',
      summary: 'Against White\'s king-side fianchetto (a King\'s-Indian-style setup), develop your light-squared bishop to f5 before …e6, then build the same solid structure with …c6.',
      moves: [
        ['d4', 'Queen\'s pawn.'],
        ['d5', 'Centre.'],
        ['Nf3', 'Flexible development.'],
        ['Nf6', 'Same setup.'],
        ['g3', 'White prepares Bg2 (a fianchetto).'],
        ['Bf5', 'Since White is slow, get your bishop out before …e6.'],
        ['Bg2', 'The fianchettoed bishop aims down the long diagonal.'],
        ['e6', 'Now build the chain.'],
        ['O-O', 'White castles.'],
        ['Be7', 'Develop and prepare to castle.'],
        ['c4', 'White hits d5.'],
        ['c6', 'Support d5 with a pawn — a rock-solid Slav-style structure. Next: …O-O, …Nbd7, and …h6 to give your bishop a retreat square.']
      ]
    },
    {
      id: 'd4-colle', repertoire: 'vs-d4', side: 'b', kind: 'main',
      name: 'vs the Colle / e3 systems',
      summary: 'Against slow setups with e3, Bd3 and c3, use exactly the same plan as against the London: …c5, …Nc6, …e6, …Bd6 and castle. One setup for many openings.',
      moves: [
        ['d4', 'Queen\'s pawn.'],
        ['d5', 'Centre.'],
        ['Nf3', 'Development.'],
        ['Nf6', 'Same setup.'],
        ['e3', 'A quiet system.'],
        ['e6', 'Open your f8-bishop.'],
        ['Bd3', 'White aims at h7.'],
        ['c5', 'Pressure d4.'],
        ['c3', 'White supports d4.'],
        ['Nc6', 'More pressure.'],
        ['Nbd2', 'White prepares e4.'],
        ['Bd6', 'Develop; your bishop also eyes h2.'],
        ['O-O', 'White castles.'],
        ['O-O', 'Castle. White usually aims for e3–e4; be ready to answer with …cxd4 and …dxe4 or …Qc7 to keep the centre under control.']
      ]
    },

    /* ===================== SCOTCH ===================== */
    {
      id: 'scotch-mieses', repertoire: 'scotch', side: 'w', kind: 'main',
      name: 'Scotch: 4…Nf6 (Mieses)',
      summary: 'After 4…Nf6 you trade on c6 and push e5, gaining space and kicking the knight. Black\'s pieces get tangled; you develop quickly.',
      moves: [
        ['e4', 'Centre.'],
        ['e5', 'Mirror.'],
        ['Nf3', 'Develop and attack e5.'],
        ['Nc6', 'Defend e5.'],
        ['d4', 'The Scotch: open the centre at once.'],
        ['exd4', 'Black takes.'],
        ['Nxd4', 'Recapture with the knight — a strong central piece.'],
        ['Nf6', 'Black attacks e4.'],
        ['Nxc6', 'Trade first, so that after …bxc6 Black\'s pawns are split.'],
        ['bxc6', 'Black recaptures toward the centre.'],
        ['e5', 'Kick the knight with gain of time.'],
        ['Qe7', 'Black pins your e5-pawn to your king.'],
        ['Qe2', 'Break the pin and protect e5.'],
        ['Nd5', 'The knight finds a central square.'],
        ['c4', 'Kick it again. Plans: g3, Bg2 or b3/Bb2, castle; Black\'s queen and knight are awkwardly placed.']
      ]
    },
    {
      id: 'scotch-classical', repertoire: 'scotch', side: 'w', kind: 'main',
      name: 'Scotch: 4…Bc5 (Classical)',
      summary: 'Black attacks your d4-knight. Defend it with Be3 and c3, then develop with Bc4 and castle.',
      moves: [
        ['e4', 'Centre.'],
        ['e5', 'Mirror.'],
        ['Nf3', 'Develop.'],
        ['Nc6', 'Defend.'],
        ['d4', 'Scotch.'],
        ['exd4', 'Black takes.'],
        ['Nxd4', 'Recapture.'],
        ['Bc5', 'Black attacks the d4-knight.'],
        ['Be3', 'Defend it with a developing move.'],
        ['Qf6', 'Black adds a second attacker on d4.'],
        ['c3', 'A third defender: d4 is safe. (Your b1-knight will come out via d2.)'],
        ['Nge7', 'Black develops — choosing e7 so the f-pawn and queen stay flexible.'],
        ['Bc4', 'Develop actively, eyeing f7. Next: O-O, Nd2. Watch for …Ne5 hitting your bishop and …Ng6 ideas.']
      ]
    },
    /* ---------- Added after Stockfish checks (Lichess cloud analysis, depth 23–50) ---------- */
    {
      id: 'vienna-nc6-gambit', repertoire: 'vienna', side: 'w', kind: 'main',
      name: 'Vienna Gambit vs 3…Nc6?!: chase the knights',
      summary: 'After 3.f4 the natural developing move 3…Nc6?! is already inaccurate. Take on e5 and use your pawns to chase the knights back: 4.fxe5 Nxe5 5.d4 Ng6 6.e5 Ng8. Stockfish rates White clearly better (about +1.2): big centre, free development, Black\'s knights back home.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'The Vienna Gambit.'], ['Nc6', 'Natural, but it lets you take on e5 for free (the c6-knight can recapture, but then your pawns kick it).'],
        ['fxe5', 'Take. Black\'s knight will recapture, and then it becomes a target.'],
        ['Nxe5', 'Black wins the pawn back…'],
        ['d4', '…and you gain time: the pawn attacks the knight.'],
        ['Ng6', 'The knight retreats.'],
        ['e5', 'Kick the other knight too. Your pawns take space with tempo.'],
        ['Ng8', 'Back to its starting square.'],
        ['Nf3', 'Develop. You lead in development and own the centre. Plan: Bd3 (or Bc4), O-O, and an attack on the f-file.']
      ],
      gambitPlies: [4]
    },
    {
      id: 'vienna-punish-d5', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 4…d5? in the accepted gambit',
      summary: 'After 3…exf4 4.e5 the f6-knight is attacked. 4…d5? (instead of moving the knight) simply loses it: 5.exf6. Black gets only a pawn or two for the piece (Stockfish about +2.2). Pattern: when a pawn attacks a piece, check that the piece actually moves.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'The Vienna Gambit.'], ['exf4', 'Black accepts.'], ['e5', 'Attack the knight.'],
        ['d5', 'A counter-strike in the centre — but it ignores the attacked knight.'],
        ['exf6', 'Take the knight. After …Qxf6, Qe2+ and Nxd5 are strong too, but the main point is simply: you are a piece up.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 24, mistake: [89, 220], punish: [220, 71] },
      mistakePly: 7, gambitPlies: [4]
    },
    {
      id: 'vienna-punish-nc6-exf4', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 4…Nc6? in the accepted gambit',
      summary: 'Another way to "forget" the attacked knight: 4…Nc6? develops a piece but leaves f6 hanging. 5.exf6 wins a piece for a pawn (Stockfish about +2.4).',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'The Vienna Gambit.'], ['exf4', 'Black accepts.'], ['e5', 'Attack the knight.'],
        ['Nc6', 'Develops — but the f6-knight is still attacked.'],
        ['exf6', 'Take it. Always ask: "did my opponent answer my threat?" If not, cash in.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 24, mistake: [89, 242], punish: [242, 75] },
      mistakePly: 7, gambitPlies: [4]
    },
    {
      id: 'vienna-punish-bc5', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 3…Bc5? against the Vienna Gambit',
      summary: '3…Bc5? leaves e5 unprotected. 4.fxe5 attacks the f6-knight. If Black tries the trick 4…Nxe4, then 5.Nxe4 and after 5…Qh4+ 6.Ng3 Bxg1 7.Rxg1 you are a piece up (Stockfish about +3). Black\'s best, 4…Ng8, is also clearly worse for Black.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nf6', 'Develop.'], ['f4', 'The Vienna Gambit.'], ['Bc5', 'Develops toward f2 — but e5 is now hanging.'],
        ['fxe5', 'Win the pawn and attack the knight.'],
        ['Nxe4', 'The trick: Black takes back on e4, hoping for …Qh4+ ideas.'],
        ['Nxe4', 'Just take. After …Qh4+ block with Ng3; after …Bxg1 Rxg1 you have an extra piece.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 30, mistake: [-21, 309], punish: [309, 4] },
      mistakePly: 5, gambitPlies: [4]
    },
    {
      id: 'vienna-punish-nxe4-f4', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: …Nxe4? after f4 (2…Nc6 line)',
      summary: 'With your pawn on d3, e4 is defended twice (d3-pawn and c3-knight). The "fork trick" 5…Nxe4? fails: 6.dxe4 and Black has only a pawn for the knight (Stockfish about +3). 6.Nxe4 also wins, but the pawn capture is cleanest.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nc6', 'Develop.'], ['Bc4', 'Aim at f7.'], ['Nf6', 'Develop.'], ['d3', 'Protect e4 and open the c1-bishop.'], ['Bc5', 'Develop.'], ['f4', 'The f-pawn advance — your main plan.'],
        ['Nxe4', 'Grabs the e4-pawn, hoping for …Qh4+ or …Bf2+ tricks.'],
        ['dxe4', 'Take the knight. Black\'s tricks don\'t work: your king is safe enough and you are a piece up.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 20, mistake: [-8, 296], punish: [296, 195] },
      mistakePly: 9, gambitPlies: [8], alsoGood: ['Nxe4']
    },
    {
      id: 'vienna-punish-nxe4-d3', repertoire: 'vienna', side: 'w', kind: 'punish',
      name: 'Punish it: 4…Nxe4? (2…Nc6 line)',
      summary: 'After 4.d3 the e4-pawn is protected twice. 4…Nxe4? just loses a knight for a pawn: 5.dxe4 (Stockfish about +3.8). The lesson for both sides: count defenders before you capture.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nc3', 'Vienna.'], ['Nc6', 'Develop.'], ['Bc4', 'Aim at f7.'], ['Nf6', 'Develop.'], ['d3', 'Protect e4 and open the c1-bishop.'],
        ['Nxe4', 'Takes a pawn that is protected twice.'],
        ['dxe4', 'Take back with the pawn — this also opens your c1-bishop.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 23, mistake: [6, 377], punish: [377, 55] },
      mistakePly: 7
    },
    {
      id: 'scotch-steinitz', repertoire: 'scotch', side: 'w', kind: 'main',
      name: 'Scotch: 4…Qh4 (Steinitz)',
      summary: 'The queen attacks e4 early. The best answer is development: 5.Nc3 Bb4 6.Be2! offers the e4-pawn. After 6…Qxe4 7.Nb5! Black must give up the dark-squared bishop and the king loses castling rights: 7…Bxc3+ 8.bxc3 Kd8 9.O-O. Stockfish: White better (about +0.7) despite the pawn.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Attack e5.'], ['Nc6', 'Defend.'], ['d4', 'The Scotch: strike in the centre.'], ['exd4', 'Black takes.'], ['Nxd4', 'Recapture with a central knight.'],
        ['Qh4', 'An early queen attack on e4.'],
        ['Nc3', 'Develop and defend e4.'],
        ['Bb4', 'Pin the knight, so e4 is attacked again.'],
        ['Be2', 'Develop and offer the pawn — a gambit Stockfish likes.'],
        ['Qxe4', 'Black takes. Now the queen is in the centre where your pieces can hit it.'],
        ['Nb5', 'Threat: Nxc7+ forking king and rook. (Only this knight can go to b5 — the c3-knight is pinned.)'],
        ['Bxc3+', 'Black gives up the bishop to stop the fork ideas.'],
        ['bxc3', 'Recapture. Your bishops now have open lines.'],
        ['Kd8', 'The king must guard c7 and can no longer castle.'],
        ['O-O', 'Castle and bring the rook to e1. Plan: Re1, Bf3, Ba3 — Black\'s king in the centre is your target.']
      ],
      gambitPlies: [10]
    },
    {
      id: 'scotch-punish-qxg2', repertoire: 'scotch', side: 'w', kind: 'punish',
      name: 'Punish it: 7…Qxg2? in the Steinitz',
      summary: 'Grabbing a second pawn with 7…Qxg2? lets you hit the queen with 8.Bf3!, and Nxc7+ (forking king and rook) is coming. Stockfish about +1.9. 8.Nxc7+ at once is also strong.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Attack e5.'], ['Nc6', 'Defend.'], ['d4', 'The Scotch: strike in the centre.'], ['exd4', 'Black takes.'], ['Nxd4', 'Recapture with a central knight.'],
        ['Qh4', 'Early queen.'], ['Nc3', 'Develop.'], ['Bb4', 'Pin.'], ['Be2', 'Offer the pawn.'], ['Qxe4', 'Taken.'],
        ['Nb5', 'Threat: Nxc7+.'],
        ['Qxg2', 'Greedy: the queen takes another pawn and attacks your rook.'],
        ['Bf3', 'Attack the queen and save the rook. The queen must run, and then Nxc7+ (or Bf4 hitting c7) wins material.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 27, mistake: [59, 194], punish: [194, -20] },
      mistakePly: 13, gambitPlies: [10], alsoGood: ['Nxc7']
    },
    {
      id: 'scotch-punish-nf6', repertoire: 'scotch', side: 'w', kind: 'punish',
      name: 'Punish it: 5…Nf6? in the Classical',
      summary: 'After 4…Bc5 5.Be3 Black\'s bishop on c5 has no defender — only your own knight on d4 stands between it and your e3-bishop. 5…Nf6? (natural development) loses a piece: 6.Nxc6! moves the knight off the diagonal with a capture (a discovered attack), and after …bxc6 7.Bxc5, or …dxc6 7.Qxd8+ Kxd8 8.Bxc5 (Stockfish about +4). Black had to play 5…Qf6 or 5…Bb6.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Attack e5.'], ['Nc6', 'Defend.'], ['d4', 'The Scotch: strike in the centre.'], ['exd4', 'Black takes.'], ['Nxd4', 'Recapture with a central knight.'],
        ['Bc5', 'Black attacks the d4-knight.'],
        ['Be3', 'Defend the knight — and now your bishop faces Black\'s bishop.'],
        ['Nf6', 'Natural development — but now nothing defends the c5-bishop once the c6-knight disappears.'],
        ['Nxc6', 'Capture — and by moving off d4, your knight uncovers the e3-bishop\'s attack on the undefended c5-bishop.'],
        ['bxc6', 'Black recaptures.'],
        ['Bxc5', 'A whole bishop. (If Black had taken with the d-pawn, trade queens first with Qxd8+ and then take on c5.)']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 38, mistake: [21, 631], punish: [631, 55] },
      mistakePly: 9
    },
    {
      id: 'scotch-punish-nge7', repertoire: 'scotch', side: 'w', kind: 'punish',
      name: 'Punish it: 5…Nge7? in the Classical',
      summary: 'Same pattern as 5…Nf6?: the c5-bishop depends on nothing. 6.Nxc6 and 7.Bxc5 win a piece (Stockfish about +4.4). Pattern: a discovered attack — your own knight on d4 was blocking the e3–c5 diagonal, and moving it away with a capture opens the attack.',
      moves: [
        ['e4', 'Centre.'], ['e5', 'Mirror.'], ['Nf3', 'Attack e5.'], ['Nc6', 'Defend.'], ['d4', 'The Scotch: strike in the centre.'], ['exd4', 'Black takes.'], ['Nxd4', 'Recapture with a central knight.'],
        ['Bc5', 'Black attacks the d4-knight.'],
        ['Be3', 'Defend.'],
        ['Nge7', 'Development toward g6 or f5 — but the c5-bishop is loose.'],
        ['Nxc6', 'Capture, and uncover the e3-bishop\'s attack on c5.'],
        ['bxc6', 'Recapture.'],
        ['Bxc5', 'Win the bishop.']
      ],
      stockfish: { source: 'Lichess cloud Stockfish', depth: 27, mistake: [21, 437], punish: [437, 63] },
      mistakePly: 9
    }
  ];

  root.CT = root.CT || {};
  root.CT.Data = root.CT.Data || {};
  root.CT.Data.repertoires = repertoires;
  root.CT.Data.openingLines = lines;
  root.CT.Data.openingsComingSoon = comingSoon;
  if (typeof module !== 'undefined' && module.exports) module.exports = { repertoires: repertoires, lines: lines, comingSoon: comingSoon };
})(typeof window !== 'undefined' ? window : globalThis);
