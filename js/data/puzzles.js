/*
 * puzzles.js — Tactical concepts and practice puzzles.
 * Every puzzle is checked automatically by tests/content.test.js:
 *   - the FEN is legal and every move in `line` is legal;
 *   - "mate" puzzles: the mini-engine proves the mate is forced in `mateIn` moves;
 *   - "material" puzzles: the first move must beat every other move by a clear margin,
 *     and each opponent reply in `line` must be that side's best defence.
 * Alternative first moves that are equally good are listed in `alsoAccept`.
 */
(function (root) {
  'use strict';

  var themes = {
    'hanging': {
      name: 'Hanging pieces',
      tier: 1,
      what: 'A piece is "hanging" when it can be captured for free — nothing defends it, or it is defended fewer times than it is attacked.',
      idea: 'Before every move, ask two questions: "What did my opponent\'s last move leave undefended?" and "What does my move leave undefended?" At 400–800, most games are decided by hanging pieces, not deep combinations.',
      deception: 'Hanging-piece blindness is the root of every trap. Your opponent sees the attack on their queen only if they look — your job is to make the attack arrive from a direction they are not watching.'
    },
    'mate1': {
      name: 'Checkmate in one',
      tier: 1,
      what: 'A position where one move ends the game. Look for checks first, then ask: can the king escape, can the check be blocked, can the checking piece be captured?',
      idea: 'Train the habit "checks, captures, threats" — always look at every check first. Mating patterns (back rank, smothered mate, queen + support) repeat constantly.',
      deception: 'Many mates come from pieces that look far away — a rook on the first rank or a bishop on the long diagonal. Players who only look at nearby pieces miss them.'
    },
    'fork': {
      name: 'Forks',
      tier: 1,
      what: 'A fork is one piece attacking two (or more) enemy pieces at the same time. The opponent can only save one.',
      idea: 'Knights are the best forkers because their attack shape is hard to see. Look for two valuable enemy pieces that are a "knight jump" apart from the same square — especially when one of them is the king (a check fork cannot be ignored).',
      deception: 'A knight fork often starts with a quiet knight move that "does nothing" — until the next jump hits two pieces at once.'
    },
    'pin': {
      name: 'Pins',
      tier: 1,
      what: 'A pin is when a piece cannot move (or should not move) because a more valuable piece is behind it on the same line. An absolute pin is against the king — the pinned piece is not allowed to move at all.',
      idea: 'Attack the pinned piece again, especially with a pawn. A pinned piece cannot run away, so a cheap attacker wins it.',
      deception: 'Pins are invisible to players who only count attackers and defenders — a pinned defender does not really defend.'
    },
    'skewer': {
      name: 'Skewers',
      tier: 1,
      what: 'A skewer is a "reverse pin": you attack a valuable piece, it moves away, and you capture the piece behind it on the same line.',
      idea: 'Look for the enemy king or queen on the same line (rank, file or diagonal) as another undefended piece. A check from a long-range piece forces the king to step aside.',
      deception: 'The skewer works because the opponent is forced to move the front piece — they cannot choose to give up the less valuable piece.'
    },
    'discovered': {
      name: 'Discovered attacks',
      tier: 1,
      what: 'A discovered attack happens when one piece moves out of the way and uncovers an attack by a piece behind it. When the uncovered attack is a check, it is a discovered check — extremely powerful, because the piece that moved can do whatever it wants.',
      idea: 'Look for your rooks, bishops and queen standing behind your own pieces and pointing at enemy pieces or the king.',
      deception: 'This is the most "hidden" tactic: the dangerous piece is not the one that moves. Opponents watch the moving piece and miss the attacker behind it.'
    },
    'remove-defender': {
      name: 'Removing the defender',
      tier: 2,
      what: 'If one enemy piece is guarding something important (a square, a piece, the king), capture or chase away that guard — then the thing it guarded falls.',
      idea: 'Ask "who is defending that?" and then "can I capture or attack the defender?" Often you capture the defender even if the trade looks equal, because what follows wins much more.',
      deception: 'The first move looks like a simple trade. The point only appears one move later.'
    },
    'overload': {
      name: 'Overloaded defenders',
      tier: 2,
      what: 'A defender is overloaded when it has two jobs at once. Make it do one job and the other job is abandoned.',
      idea: 'Look for a piece that both guards a piece and guards a square (like the back rank). Capture what it guards — if it recaptures, it leaves its other post.',
      deception: 'Overloaded pieces look perfectly safe because every target is "defended". Count the jobs, not just the defenders.'
    },
    'double-attack': {
      name: 'Double attacks',
      tier: 1,
      what: 'Any move that creates two threats at once — often a check plus an attack on a loose piece. The queen is the strongest double-attacker.',
      idea: 'Undefended ("loose") pieces are targets: if the enemy king and a loose piece can be attacked from the same square, a check wins the loose piece.',
      deception: 'Loose pieces drop off. A piece that is safe now can be lost to a check later, so keep your own pieces defended.'
    },
    'smothered': {
      name: 'Smothered mate',
      tier: 1,
      what: 'A checkmate delivered by a knight against a king that is surrounded (smothered) by its own pieces.',
      idea: 'Kings in the corner with pawns in front are vulnerable. A queen sacrifice can force an enemy rook onto the last escape square.',
      deception: 'A queen sacrifice that looks like a blunder becomes checkmate — the classic "Philidor\'s legacy".'
    },
    'mate-patterns': {
      name: 'Mating patterns',
      tier: 1,
      what: 'A handful of checkmate shapes appear again and again: Anastasia\'s mate (knight + rook on the edge), the Arabian mate (rook + knight in the corner), the Epaulette mate (king boxed in by its own rooks) and the long-diagonal mate (queen + bishop against g7).',
      idea: 'Learn the shapes, not the positions. When you see the enemy king boxed in by its own pieces, look for the matching pattern and count which escape squares you still need to cover.',
      deception: 'Most opponents defend against the piece that is attacking now. Patterns let you see the mate two pieces away — before your opponent realises the net is being built.'
    },
    'back-rank': {
      name: 'Back-rank mates',
      tier: 2,
      what: 'A king on its first rank, hemmed in by its own pawns, can be mated by a rook or queen along that rank. Often you must first remove or overload the one piece guarding the back rank.',
      idea: 'Count attackers and defenders of the back rank. If you have two heavy pieces on an open file and the opponent has one defender, a sacrifice on the back rank usually wins.',
      deception: 'A queen sacrifice that looks like a blunder (the opponent just takes it) is the point: the defender is dragged onto the back rank and your second piece mates.'
    },
    'decoy': {
      name: 'Decoys & sacrifices',
      tier: 2,
      what: 'A decoy forces an enemy piece — often the king — onto a square where it gets mated or forked. Usually it is a sacrifice: you give material so the opponent must capture.',
      idea: 'Ask: "Which square would I like the enemy king (or queen) to stand on?" Then look for a capture or check that forces it there.',
      deception: 'This is the heart of deceptive chess: the sacrifice looks like a mistake, the opponent happily takes, and only then does the real point appear.'
    },
    'zwischenzug': {
      name: 'Zwischenzug (in-between move)',
      tier: 2,
      what: 'Instead of making the "obvious" recapture, you first play a stronger move — usually a check or a bigger threat — and recapture later.',
      idea: 'Before every recapture, ask: "Do I have a check or threat first?" The opponent expects the recapture and is unprepared for the move in between.',
      deception: 'Zwischenzugs break your opponent\'s calculation: they counted a trade, but the trade happens on your terms.'
    },
    'trapped-piece': {
      name: 'Trapping pieces',
      tier: 2,
      what: 'A piece is trapped when it is attacked (or about to be) and every square it could go to is covered. Then you can win it at leisure.',
      idea: 'Pieces that grab pawns on the edge (a2, h2, a7, h7) are the classic victims. Count the escape squares before attacking: take away the last one first.',
      deception: 'The quiet move that cuts off the escape (often a simple pawn move) does not look like an attack at all — but the piece is already lost.'
    },
    'quiet-move': {
      name: 'Quiet moves',
      tier: 3,
      what: 'A quiet move is neither a check nor a capture, yet it creates a threat the opponent cannot meet. Often it is the strongest move in the position.',
      idea: 'When checks and captures do not work, ask: "Which square does my piece need to stand on so that next move I mate or win material?" Then check whether the opponent can stop it.',
      deception: 'Opponents look for checks and captures. A calm move that sets up an unstoppable threat is the hardest kind of attack to see — the essence of hidden threats.'
    },
    'windmill': {
      name: 'Windmill (repeated discovered checks)',
      tier: 4,
      what: 'A rook and a bishop (or queen) take turns: the rook moves and uncovers a check from the bishop, the king steps aside, the rook returns with check — and repeats, collecting material or delivering mate.',
      idea: 'Look for your rook on the 7th rank in front of the enemy king with your bishop behind it on the long diagonal. Every rook move is then a discovered check.',
      deception: 'A windmill looks harmless until it starts turning; each check gains a tempo, so the opponent never gets time to defend.'
    }
  };

  var puzzles = [
    /* ---------- Tier 1: hanging pieces ---------- */
    {
      id: 'hang-01', theme: 'hanging', level: 1, goal: 'material', title: 'The careless queen',
      fen: 'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
      line: ['Nxg5'],
      prompt: 'White to move. Black\'s queen just came out early. Punish it.',
      hint: 'Which white piece attacks g5?',
      explain: 'The knight on f3 attacks g5, and nothing defends Black\'s queen there (the c8-bishop is blocked by the d7-pawn). Nxg5 wins the queen for free.',
      pitfalls: 'Nxe5 grabs a pawn but lets the queen escape — and the queen even attacks your knight and g2. Always look for the biggest capture first.'
    },
    {
      id: 'hang-02', mirror: true, theme: 'hanging', level: 1, goal: 'material', title: 'Count the defenders',
      fen: '6k1/ppp2ppp/8/3b4/8/2N5/PPP2PPP/6K1 w - - 0 1',
      line: ['Nxd5'],
      prompt: 'White to move. Is anything undefended?',
      hint: 'Check every black piece: who defends it?',
      explain: 'The bishop on d5 has no defenders. Your knight on c3 captures it for free.',
      pitfalls: 'Any quiet move gives Black time to move the bishop. When something hangs, take it — unless taking walks into a trap (it does not here).'
    },
    {
      id: 'hang-03', theme: 'hanging', level: 1, goal: 'material', title: 'Queen walks into a knight',
      fen: 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 3 3',
      line: ['Nxh5'],
      prompt: 'Black to move. White\'s queen has wandered to h5.',
      hint: 'Your knight on f6 attacks two squares on the h-file and e-file…',
      explain: 'The f6-knight attacks h5. Nothing protects the white queen, so Nxh5 wins it. Early queen adventures are risky exactly because of tempo-gaining attacks like this.',
      pitfalls: 'Nxe4 wins only a pawn and lets the queen live (and Qxf7+ even becomes possible). Look at the most valuable target first.'
    },
    /* ---------- Tier 1: mate in one ---------- */
    {
      id: 'mate1-01', mirror: true, theme: 'mate1', level: 1, goal: 'mate', mateIn: 1, title: 'Back-rank mate',
      fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
      line: ['Rd8#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'Black\'s king is trapped behind its own pawns.',
      explain: 'Rd8 checks along the 8th rank. The king cannot step forward because its own pawns on f7, g7 and h7 block it — the classic back-rank mate.',
      pitfalls: 'Other rook checks do not exist; quiet moves let Black make "luft" (an escape square) with …h6 or …g6. Lesson for your own games: give your king an escape square before the back rank becomes a problem.'
    },
    {
      id: 'mate1-02', theme: 'mate1', level: 1, goal: 'mate', mateIn: 1, title: 'Scholar\'s mate pattern',
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      line: ['Qxf7#'],
      prompt: 'White to move. Black\'s last move (…Nf6) attacked your queen — but missed something.',
      hint: 'f7 is only defended by the king.',
      explain: 'Qxf7 is checkmate: the queen is protected by the bishop on c4, so the king cannot capture it, and every escape square is covered or blocked.',
      pitfalls: 'Retreating the queen is "safe" but throws away the win. When your opponent attacks your queen, check whether you have something even bigger first.'
    },
    {
      id: 'mate1-03', mirror: true, theme: 'mate1', level: 1, goal: 'mate', mateIn: 1, title: 'Smothered in the corner',
      fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
      line: ['Nf7#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'The black king has no squares — its own pieces fill them.',
      explain: 'Nf7 checks h8. The king is surrounded by its own rook and pawns and the knight cannot be captured or blocked: smothered mate.',
      pitfalls: 'Nxh7 wins a pawn but is not mate (the king takes back). Checks first!'
    },
    {
      id: 'mate1-04', mirror: true, theme: 'mate1', level: 1, goal: 'mate', mateIn: 1, title: 'King and rook teamwork',
      fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
      line: ['Rh8#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'Your king already controls a7 and b7.',
      explain: 'Rh8 checks along the 8th rank and also covers b8. Your king covers a7 and b7, so Black\'s king has nowhere to go.',
      pitfalls: 'Ra1+ is check, but the king escapes to b8. A good check takes away the escape squares too.'
    },
    /* ---------- Tier 1: forks ---------- */
    {
      id: 'fork-01', mirror: true, theme: 'fork', level: 1, goal: 'material', title: 'Royal fork',
      fen: 'r3k3/pp3ppp/8/1N6/8/8/PP3PPP/6K1 w - - 0 1',
      line: ['Nc7+', 'Kd7', 'Nxa8'],
      prompt: 'White to move. Win material.',
      hint: 'Find a square where the knight checks the king and attacks another piece.',
      explain: 'Nc7+ attacks the king on e8 and the rook on a8 at once. Black must deal with the check, then Nxa8 wins the rook.',
      pitfalls: 'Nxa7 grabs a pawn but the knight gets trapped on the edge. Nd6+ is a check that attacks nothing else. A fork needs two targets.'
    },
    {
      id: 'fork-02', mirror: true, theme: 'fork', level: 1, goal: 'material', title: 'Check and grab the queen',
      fen: '6k1/3q1p1p/6p1/8/4N3/8/5PPP/6K1 w - - 0 1',
      line: ['Nf6+', 'Kg7', 'Nxd7'],
      prompt: 'White to move. Win the queen.',
      hint: 'Which square is a knight-jump from both g8 and d7?',
      explain: 'Nf6+ forks king and queen. Black\'s g-pawn has already moved to g6, so nothing can capture the knight on f6. After the king moves, Nxd7 wins the queen.',
      pitfalls: 'Nc5 attacks the queen but she simply moves away. With a check, the opponent has no time to save the queen.'
    },
    {
      id: 'fork-03', mirror: true, theme: 'fork', level: 1, goal: 'material', title: 'Black\'s knight fork',
      fen: '4k3/pp3ppp/8/8/3n4/8/PP3PPP/R3K3 b - - 0 1',
      line: ['Nc2+', 'Kd2', 'Nxa1'],
      prompt: 'Black to move. Win material.',
      hint: 'The white king and rook are both on the first rank.',
      explain: 'Nc2+ checks the king on e1 and attacks the rook on a1. After the king moves, Nxa1 wins the rook.',
      pitfalls: 'Nf3+ is check but attacks nothing valuable — gxf3 simply wins your knight. Look for checks that hit something else too.'
    },
    /* ---------- Tier 1: pins ---------- */
    {
      id: 'pin-01', mirror: true, theme: 'pin', level: 1, goal: 'material', title: 'Attack the pinned knight',
      fen: 'r3k2r/1pp2ppp/2n5/1B6/3P4/8/PPP2PPP/R3K2R w KQkq - 0 1',
      line: ['d5'],
      alsoAccept: [],
      prompt: 'White to move. The black knight on c6 is pinned. Exploit it.',
      hint: 'A pinned piece cannot run away. Attack it with something cheap.',
      explain: 'The knight on c6 is pinned to the king by the bishop on b5, so it is not allowed to move. d5 attacks it with a pawn; next move dxc6 wins a whole piece.',
      pitfalls: 'Bxc6+ just trades bishop for knight — no profit. The point of a pin is to pile up on the pinned piece, not to cash it in immediately.'
    },
    {
      id: 'pin-02', mirror: true, theme: 'pin', level: 1, goal: 'material', title: 'Pinned on the e-file',
      fen: '4k3/pp3ppp/3p4/4n3/8/8/PPP2PPP/4R1K1 w - - 0 1',
      line: ['f4'],
      prompt: 'White to move. Look down the e-file.',
      hint: 'Your rook pins the knight to the king. Which pawn can attack the knight?',
      explain: 'The rook on e1 pins the e5-knight to the black king. f4 attacks the knight with a pawn, and the knight cannot escape. White wins a piece for a pawn.',
      pitfalls: 'Rxe5+? dxe5 loses your rook for a knight — the knight was defended by the d6-pawn. Use the pin, do not trade into it.'
    },
    /* ---------- Tier 1: skewer ---------- */
    {
      id: 'skewer-01', mirror: true, theme: 'skewer', level: 1, goal: 'material', title: 'Rook skewer',
      fen: '8/8/8/8/2k4q/8/8/R5K1 w - - 0 1',
      line: ['Ra4+', 'Kd5', 'Rxh4'],
      prompt: 'White to move. The black king and queen are on the same rank.',
      hint: 'Check the king along the 4th rank.',
      explain: 'Ra4+ checks the king along the 4th rank. The king must step off the rank, and then Rxh4 captures the queen standing behind it.',
      pitfalls: 'Ra8 or other rook moves do nothing. The skewer only works because the check forces the king to move first.'
    },
    /* ---------- Tier 1: discovered attack ---------- */
    {
      id: 'disc-01', mirror: true, theme: 'discovered', level: 1, goal: 'material', title: 'Discovered check',
      fen: '4k3/pp3ppp/8/4N3/2q5/8/PP3PPP/4R1K1 w - - 0 1',
      line: ['Nxc4+'],
      prompt: 'White to move. Your knight is standing between your rook and the black king.',
      hint: 'If the knight moves, the rook gives check. Where should the knight go?',
      explain: 'Any knight move uncovers a check from the rook on e1. Because Black must answer the check, the knight can capture the queen on c4 for free — Black has no time to recapture or escape.',
      pitfalls: 'Every knight move gives a discovered check, but other jumps (Nd3+, Nf3+, Nc6+…) let Black block with the queen on the e-file, and you only win the queen for your rook. With a discovered check, the piece that moves should grab the biggest prize.'
    },
    /* ---------- Tier 1: double attack ---------- */
    {
      id: 'double-01', mirror: true, theme: 'double-attack', level: 1, goal: 'material', title: 'Queen fork with check',
      fen: '6k1/5pp1/7p/r7/8/8/5PPP/3Q2K1 w - - 0 1',
      line: ['Qd8+', 'Kh7', 'Qxa5'],
      prompt: 'White to move. Black\'s rook on a5 is loose (undefended).',
      hint: 'Find a queen check that also attacks a5.',
      explain: 'Qd8+ checks the king along the 8th rank and attacks the rook on a5 along the diagonal. After the king moves, Qxa5 wins the rook.',
      pitfalls: 'Qa4? attacks the rook but the rook simply captures your queen. Make sure your attacking square is safe.'
    },
    /* ---------- Tier 2: remove the defender ---------- */
    {
      id: 'remdef-01', mirror: true, theme: 'remove-defender', level: 2, goal: 'material', title: 'Take away the guard',
      fen: 'r2q1rk1/ppp2ppp/5n2/6B1/8/3B3Q/PPP2PPP/5RK1 w - - 0 1',
      line: ['Bxf6'],
      prompt: 'White to move. Your queen and bishop both aim at h7. What stops Qxh7 mate?',
      hint: 'Who defends h7?',
      explain: 'The knight on f6 is the only defender of h7. Bxf6 removes it. If Black recaptures (…Qxf6 or …gxf6), Qxh7 is checkmate. If Black does not recapture, White is simply a piece up.',
      pitfalls: 'Qxh7+?? Nxh7 loses your queen — the knight was still guarding h7. Remove the defender first, then strike.'
    },
    /* ---------- Tier 2: overload ---------- */
    {
      id: 'overload-01', mirror: true, theme: 'overload', level: 2, goal: 'material', title: 'One rook, two jobs',
      fen: '3q1rk1/5ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1',
      line: ['Qxd8'],
      prompt: 'White to move. Black\'s rook on f8 has two jobs.',
      hint: 'The f8-rook defends the queen AND the back rank.',
      explain: 'Qxd8 takes the queen. If …Rxd8, the rook has left the back rank unguarded and Rxd8 is checkmate. If Black does not recapture, White is a queen up.',
      pitfalls: 'Simply moving the queen elsewhere lets Black trade on d2 or make luft. Count the jobs of each defender.'
    },
    /* ---------- Tier 2: smothered mate in 2 ---------- */
    {
      id: 'smother-01', mirror: true, theme: 'smothered', level: 2, goal: 'mate', mateIn: 2, title: 'Philidor\'s legacy',
      fen: '4r2k/6pp/7N/3Q4/8/8/6PP/6K1 w - - 0 1',
      line: ['Qg8+', 'Rxg8', 'Nf7#'],
      prompt: 'White to move. Checkmate in two.',
      hint: 'Your knight on h6 protects g8. What if you give up your queen there?',
      explain: 'Qg8+! The king cannot take because the knight on h6 guards g8, so the rook must capture. Now the king is completely surrounded by its own pieces, and Nf7 is smothered mate.',
      pitfalls: 'Nf7+ first lets the king out with …Kg8, and Qd5-d8? walks into …Rxd8. The queen sacrifice is the only way to force mate in two.'
    },
    /* ===================== Phase 3 additions ===================== */
    /* ---------- Tier 1: more one-movers ---------- */
    {
      id: 'hang-04', theme: 'hanging', level: 1, goal: 'material', title: 'The knight that came too close',
      fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4',
      line: ['Qxg5'],
      prompt: 'Black to move. White\'s knight just jumped to g5 to attack f7.',
      hint: 'Who defends the knight on g5? Look along the diagonal from your queen.',
      explain: 'The knight on g5 has no defender, and your queen on d8 sees it along the d8–g5 diagonal (e7 and f6 are empty). Qxg5 wins a whole piece — and now your queen also eyes g2.',
      pitfalls: 'Defending f7 with …Qf6 or …d5 is careful but misses a free piece. …Bxf2+ wins only a pawn. When the opponent attacks, first check whether the attacker itself is loose.'
    },
    {
      id: 'fork-04', theme: 'fork', level: 1, goal: 'material', title: 'Fried Liver fork',
      fen: 'r1bqkb1r/pppp1pp1/2n2n1p/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5',
      line: ['Nxf7'],
      prompt: 'White to move. Black chased your knight with …h6 instead of defending f7.',
      hint: 'f7 is only defended by the king — and your bishop on c4 protects your knight there.',
      explain: 'Nxf7 takes a pawn and forks Black\'s queen on d8 and rook on h8. The king cannot recapture because your bishop on c4 guards f7. You will win the exchange (rook for knight) as well.',
      pitfalls: 'Retreating the knight (Nf3) is safe but passive. Bxf7+ gives up your bishop: after …Kxf7 you have nothing. Use the knight, keep the bishop as its bodyguard.'
    },
    {
      id: 'fork-05', theme: 'fork', level: 2, goal: 'material', title: 'The fork trick',
      fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/8/PPPP1PPP/R1BQK1NR b KQkq - 0 4',
      line: ['d5'],
      prompt: 'Black to move. You just gave up your knight on e4 (…Nxe4 Nxe4). How do you get the piece back?',
      hint: 'One pawn move attacks two white pieces at once.',
      explain: 'd5! is a pawn fork: it attacks White\'s bishop on c4 and knight on e4. White can only save one of them, so you win the piece back — and you get a big pawn centre. This is the famous "fork trick", a deceptive sacrifice that is really a trade.',
      pitfalls: 'Any other move leaves you a knight down. The point of the earlier …Nxe4 was exactly this pawn fork.'
    },
    {
      id: 'pin-03', theme: 'pin', level: 1, goal: 'material', title: 'Pinned on the e-file (Black)',
      fen: '4r1k1/5ppp/8/8/4N3/3P4/PPP3PP/4K3 b - - 0 1',
      line: ['f5'],
      prompt: 'Black to move. Look down the e-file from your rook.',
      hint: 'The white knight cannot move. Attack it with a pawn.',
      explain: 'Your rook on e8 pins the knight on e4 to White\'s king. f5 attacks it with a pawn; the knight cannot run, and after …fxe4 dxe4 you have won a knight for a pawn.',
      pitfalls: '…Rxe4+?? dxe4 loses your rook — the d3-pawn defends the knight. Use the pin; do not trade into it.'
    },
    {
      id: 'skewer-02', theme: 'skewer', level: 1, goal: 'material', title: 'Skewer along the second rank',
      fen: '1r4k1/5ppp/8/8/8/8/4K2Q/8 b - - 0 1',
      line: ['Rb2+'],
      prompt: 'Black to move. White\'s king and queen stand on the same rank.',
      hint: 'Give check along the 2nd rank.',
      explain: 'Rb2+ checks the king along the 2nd rank. The king must step off the rank (it cannot block, and the queen cannot capture through the king), then …Rxh2 wins the queen.',
      pitfalls: 'Quiet rook moves give White time to move the queen. A skewer needs check (or a big threat) on the front piece.'
    },
    {
      id: 'disc-02', theme: 'discovered', level: 1, goal: 'material', title: 'Bishop unmasks the rook',
      fen: '4r1k1/5ppp/8/4b3/8/8/PPP4Q/4K3 b - - 0 1',
      line: ['Bxh2+'],
      alsoAccept: ['Bg3+'],
      prompt: 'Black to move. Your bishop stands between your rook and the white king.',
      hint: 'Any bishop move gives a discovered check from the rook. Which one grabs something?',
      explain: 'When the bishop leaves the e-file, your rook on e8 gives check. White must answer the check, so the bishop can take the queen on h2 for free. (…Bg3+ also wins the queen next move.)',
      pitfalls: 'Other bishop moves also give check but win nothing (…Bd6+, …Bf4+). With a discovered check the moving piece should grab the biggest prize.'
    },
    {
      id: 'double-02', theme: 'double-attack', level: 1, goal: 'material', title: 'Queen check and grab',
      fen: '3q2k1/5ppp/8/8/8/8/6PP/R5K1 b - - 0 1',
      line: ['Qd4+'],
      prompt: 'Black to move. White\'s rook on a1 is loose.',
      hint: 'One queen move checks the king and attacks the rook.',
      explain: '…Qd4+ checks the king on g1 along the diagonal and at the same time attacks the rook on a1 along the other diagonal. After the king moves, …Qxa1 wins the rook.',
      pitfalls: '…Qd1+? is check, but the rook simply captures your queen. Make sure your forking square is safe.'
    },
    {
      id: 'smother-02', theme: 'smothered', level: 1, goal: 'mate', mateIn: 1, title: 'Smothered mate for Black',
      fen: '6k1/5ppp/8/8/6n1/8/6PP/6RK b - - 0 1',
      line: ['Nf2#'],
      prompt: 'Black to move. Checkmate in one.',
      hint: 'White\'s king has no free squares.',
      explain: '…Nf2 checks the king on h1. Its neighbours g1, g2 and h2 are all filled by White\'s own pieces, and nothing can capture the knight on f2. Smothered mate.',
      pitfalls: '…Nxh2 wins a pawn but is not mate (the king takes back). Checks first!'
    },
    {
      id: 'pattern-01', theme: 'mate-patterns', level: 1, goal: 'mate', mateIn: 1, mirror: true, title: 'Anastasia\'s mate',
      fen: '8/4N1pk/8/8/8/8/2R5/6K1 w - - 0 1',
      line: ['Rh2#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'Your knight on e7 already guards g8 and g6.',
      explain: 'Rh2 checks the king along the h-file. The knight on e7 covers g6 and g8, the black pawn blocks g7, and the rook covers the rest of the h-file. This shape — knight on e7, rook on the h-file — is called Anastasia\'s mate.',
      pitfalls: 'Rc8? or other checks let the king escape. Find the check that leaves the king zero squares.'
    },
    {
      id: 'pattern-02', theme: 'mate-patterns', level: 1, goal: 'mate', mateIn: 1, mirror: true, title: 'Arabian mate',
      fen: '7k/8/5N2/8/8/8/8/6RK w - - 0 1',
      line: ['Rg8#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'Your knight on f6 protects g8 and covers h7.',
      explain: 'Rg8 checks the king. The king cannot take the rook because the knight on f6 protects it, and the knight also covers h7. One of the oldest mating patterns in chess: the Arabian mate.',
      pitfalls: 'Rh1+?? is impossible (your own king blocks the h-file), and Rg7 is not check. Knight + rook in the corner: rook on the 8th, knight on f6.'
    },
    {
      id: 'pattern-03', theme: 'mate-patterns', level: 1, goal: 'mate', mateIn: 1, mirror: true, title: 'Epaulette mate',
      fen: '3rkr2/8/8/8/8/8/Q4PPP/6K1 w - - 0 1',
      line: ['Qe6#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'The black rooks sit on either side of their king like shoulder pads (epaulettes).',
      explain: 'Qe6 checks the king from the front. The queen also covers d7, e7 and f7, and d8/f8 are blocked by Black\'s own rooks. The king is suffocated by its own pieces.',
      pitfalls: 'Qe2+? lets the king walk to d7 or f7. Qa4+? is met by …Rd7. The queen must cover all three squares in front of the king.'
    },
    {
      id: 'pattern-04', theme: 'mate-patterns', level: 1, goal: 'mate', mateIn: 1, mirror: true, title: 'Long-diagonal mate',
      fen: '6k1/5p1p/6pQ/8/3B4/8/5PPP/6K1 w - - 0 1',
      line: ['Qg7#'],
      prompt: 'White to move. Checkmate in one.',
      hint: 'Your bishop on d4 aims down the long diagonal toward g7.',
      explain: 'Qg7 is mate: the queen is protected by the bishop on d4, and the king\'s other squares (f8, h8) are covered by the queen while f7 and h7 are blocked by its own pawns. Remember this pattern: queen + bishop against a fianchettoed or weakened king.',
      pitfalls: 'Qxh7+?? Kxh7 gives away your queen. The queen needs the bishop\'s protection on g7.'
    },
    {
      id: 'pattern-05', theme: 'mate-patterns', level: 1, goal: 'mate', mateIn: 1, mirror: true, title: 'Corridor mate (Black)',
      fen: '6k1/5ppp/8/8/8/8/1r3PPP/6K1 b - - 0 1',
      line: ['Rb1#'],
      prompt: 'Black to move. Checkmate in one.',
      hint: 'White\'s king is stuck behind its own pawns.',
      explain: '…Rb1 checks along the first rank, and White\'s pawns on f2, g2 and h2 block every escape: a back-rank (corridor) mate.',
      pitfalls: '…Rxf2? wins a pawn but the king takes back. Before taking material, always check for mate.'
    },
    /* ---------- Tier 2 ---------- */
    {
      id: 'backrank-01', theme: 'back-rank', level: 2, goal: 'mate', mateIn: 2, mirror: true, title: 'Queen sacrifice on the back rank',
      fen: '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1',
      line: ['Qe8+', 'Rxe8', 'Rxe8#'],
      prompt: 'White to move. Checkmate in two.',
      hint: 'Black\'s only back-rank defender is the rook on d8. Your queen stands in front of your rook on the e-file.',
      explain: 'Qe8+! Black must take with the rook (…Rxe8), and now the d8-rook has left its post: Rxe8 is back-rank mate. The queen sacrifice works because it drags the only defender onto e8.',
      pitfalls: 'Re8+?? is impossible — your own queen on e2 blocks the rook. Quiet moves give Black time for …h6 (luft). Two heavy pieces vs one defender: sacrifice the first.'
    },
    {
      id: 'backrank-02', theme: 'back-rank', level: 2, goal: 'mate', mateIn: 2, mirror: true, title: 'Back-rank strike for Black',
      fen: '4r1k1/4qppp/8/8/8/8/5PPP/3R2K1 b - - 0 1',
      line: ['Qe1+', 'Rxe1', 'Rxe1#'],
      prompt: 'Black to move. Checkmate in two.',
      hint: 'White\'s rook on d1 is the only back-rank defender.',
      explain: '…Qe1+! White must take with the rook, and then …Rxe1 is mate — White\'s king is trapped by its own pawns.',
      pitfalls: '…Re1+?? is impossible — your own queen on e7 blocks the rook. Quiet moves give White time for h3 (an escape square). Two heavy pieces against one defender: sacrifice the front one.'
    },
    {
      id: 'decoy-01', theme: 'decoy', level: 2, goal: 'mate', mateIn: 2, mirror: true, title: 'Decoy the king to f8',
      fen: '5rk1/5ppp/8/1B6/8/Q7/5PPP/4R1K1 w - - 0 1',
      line: ['Qxf8+', 'Kxf8', 'Re8#'],
      prompt: 'White to move. Checkmate in two.',
      hint: 'Your bishop on b5 already guards e8. Where would you like Black\'s king to stand?',
      explain: 'Qxf8+! Kxf8 forces the king onto f8 (a decoy). Now Re8 is mate: the rook is protected by the bishop on b5, and the king\'s other squares (e7, g8) are covered by the rook while f7 and g7 hold its own pawns.',
      pitfalls: 'Re8? Rxe8 Bxe8 wins nothing. Qe7? is met by …h6 or similar. The queen sacrifice is the only forced mate.'
    },
    {
      id: 'zwisch-01', theme: 'zwischenzug', level: 2, goal: 'material', title: 'In-between check (Elephant Trap)',
      fen: 'r1bBkb1r/pppn1ppp/8/3n4/3P4/8/PP2PPPP/R2QKBNR b KQkq - 0 7',
      line: ['Bb4+', 'Qd2', 'Bxd2+', 'Kxd2', 'Kxd8'],
      prompt: 'Black to move. White has just taken your queen on d8. Before you recapture…',
      hint: 'Is there a check first?',
      explain: '…Bb4+! is the in-between move. White\'s only answer is Qd2 (nothing else can block), so you take the queen with check (…Bxd2+), and only then recapture the bishop on d8. You end up a whole piece ahead.',
      pitfalls: '…Kxd8? at once is natural but leaves you a queen for a bishop down. Always look for a check before recapturing.'
    },
    {
      id: 'trap-01', theme: 'trapped-piece', level: 2, goal: 'material', mirror: true, title: 'The greedy bishop',
      fen: '8/5kpp/8/8/8/8/bPK2PPP/8 w - - 0 1',
      line: ['b3'],
      prompt: 'White to move. Black\'s bishop grabbed a pawn on a2. Can it get out?',
      hint: 'Count the bishop\'s exit squares. Can you close the last one?',
      explain: 'b3! shuts the bishop in: b1 is covered by your king, b3 is a protected pawn, and the bishop has no other squares. Next comes Kb2 and the bishop falls.',
      pitfalls: 'Kb1? or Kb3? chase the bishop but let it escape via b1/b3. Close the door first, then go and collect it.'
    },
    {
      id: 'quiet-01', theme: 'quiet-move', level: 3, goal: 'mate', mateIn: 2, mirror: true, title: 'The calm queen move',
      fen: '6k1/3b1p1p/5Bp1/8/8/4Q3/5PPP/6K1 w - - 0 1',
      line: ['Qh6', 'Bf5', 'Qg7#'],
      prompt: 'White to move. Checkmate in two.',
      hint: 'No check works yet. Where would your queen like to be so that it mates next move?',
      explain: 'Qh6! is quiet — no check, no capture — but it threatens Qg7 mate (protected by the bishop on f6). Black has no way to cover g7: the light-squared bishop cannot reach it and the king has no escape.',
      pitfalls: 'Qe8+? Bxe8 loses your queen — the d7-bishop guards e8. Qe7? threatens nothing decisive. The strongest move is often the quiet one.'
    },
    {
      id: 'anastasia-01', theme: 'decoy', level: 3, goal: 'mate', mateIn: 3, mirror: true, title: 'Anastasia\'s mate in three',
      fen: '5rk1/5ppp/8/3N3Q/8/3R4/5PPP/6K1 w - - 0 1',
      line: ['Ne7+', 'Kh8', 'Qxh7+', 'Kxh7', 'Rh3#'],
      prompt: 'White to move. Checkmate in three.',
      hint: 'Start with a knight check. Then think about the h-file.',
      explain: 'Ne7+ drives the king into the corner (…Kh8). Qxh7+!! decoys it onto h7 (…Kxh7), and Rh3 is mate: the knight on e7 covers g6 and g8, the g7-pawn blocks itself in, and the rook controls the h-file. This is Anastasia\'s mate, set up by a queen sacrifice.',
      pitfalls: 'Qxh7+?? first is answered by …Kxh7 with no follow-up because the king can escape to g8 or g6 later. The knight check must come first to build the net.'
    },
    {
      id: 'windmill-01', theme: 'windmill', level: 4, goal: 'mate', mateIn: 3, title: 'The windmill',
      fen: 'q6k/1n1r2Rp/8/8/8/B7/1B4PP/6K1 w - - 0 1',
      line: ['Rxd7+', 'Kg8', 'Rg7+', 'Kh8', 'Rg6#'],
      prompt: 'White to move. Checkmate in three.',
      hint: 'Every rook move along the 7th rank uncovers a check from your bishop on b2.',
      explain: 'Rxd7+ (discovered check from the b2-bishop) wins the rook. After …Kg8, Rg7+ brings the rook back with check — and since your a3-bishop covers f8, the king must return to h8. Now any rook move down the g-file (Rg6) is a discovered checkmate: g8 is covered by the rook, g7 by the bishop, and h7 is blocked by Black\'s own pawn.',
      pitfalls: 'Rxb7+? also uncovers check but after …Kg8 the windmill is slower. Rxh7+?? gives up the rook. Count the king\'s escape squares at every step: the a3-bishop guarding f8 is what makes the windmill deadly here.'
    }
  ];


  /* ---------- Mirrored twins: the same idea, flipped left to right ----------
   * Used for spaced repetition ("test it again in a different position") and as worked examples.
   * The rules of chess are symmetric left-right (castling aside), so a mirrored tactic still works.
   * tests/content.test.js verifies every twin with the engine as well. */
  var FL = 'abcdefgh';
  function mirrorSquareText(t) {
    return t
      .replace(/\b([a-h])-(file|pawn|pawns|rook|knight|bishop)/g, function (m, f, w) { return FL[7 - FL.indexOf(f)] + '-' + w; })
      .replace(/([a-h])([1-8])/g, function (m, f, r) { return FL[7 - FL.indexOf(f)] + r; })
      .replace(/kingside/g, '\u0001').replace(/queenside/g, 'kingside').replace(/\u0001/g, 'queenside');
  }
  function mirrorSan(san) {
    if (/^O-O/.test(san)) return san;
    return san.replace(/[a-h]/g, function (f) { return FL[7 - FL.indexOf(f)]; });
  }
  function mirrorFen(fen) {
    var parts = fen.split(' ');
    parts[0] = parts[0].split('/').map(function (row) {
      var exp = row.replace(/[1-8]/g, function (n) { return '1'.repeat(+n); });
      return exp.split('').reverse().join('').replace(/1+/g, function (m) { return String(m.length); });
    }).join('/');
    parts[2] = '-';
    parts[3] = parts[3] === '-' ? '-' : FL[7 - FL.indexOf(parts[3][0])] + parts[3][1];
    return parts.join(' ');
  }
  puzzles.filter(function (p) { return p.mirror; }).forEach(function (p) {
    puzzles.push({
      id: p.id + '-m', family: p.id, twin: true, theme: p.theme, level: p.level, goal: p.goal, mateIn: p.mateIn,
      title: p.title + ' (mirrored)', fen: mirrorFen(p.fen), line: p.line.map(mirrorSan),
      alsoAccept: p.alsoAccept ? p.alsoAccept.map(mirrorSan) : undefined,
      prompt: mirrorSquareText(p.prompt), hint: mirrorSquareText(p.hint),
      explain: mirrorSquareText(p.explain) + ' (Same idea as "' + p.title + '", mirrored left to right.)',
      pitfalls: mirrorSquareText(p.pitfalls)
    });
  });
  puzzles.forEach(function (p) { if (!p.family) p.family = p.id; });

  root.CT = root.CT || {};
  root.CT.Data = root.CT.Data || {};
  root.CT.Data.themes = themes;
  root.CT.Data.puzzles = puzzles;
  if (typeof module !== 'undefined' && module.exports) module.exports = { themes: themes, puzzles: puzzles };
})(typeof window !== 'undefined' ? window : globalThis);
