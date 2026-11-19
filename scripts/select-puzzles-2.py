# Choose the SECOND puzzle pack (more and harder puzzles) from the CC0 Lichess puzzle database.
# Streams the CSV from stdin (zstdcat lichess_db_puzzle.csv.zst | python3 select-puzzles-2.py js/data/puzzlepack.js),
# skips puzzles already in the first pack, keeps only well-tested, popular puzzles, and samples each group with a
# seeded reservoir so the result is the same every run. Output: selected2.json for build-puzzlepack.js.
import csv, json, random, re, sys, collections

random.seed(29)
first = set(re.findall(r'(?:^|\\n|")([0-9A-Za-z]{5})\|', open(sys.argv[1]).read())) if len(sys.argv) > 1 else set()
print('first pack ids:', len(first), file=sys.stderr)

def good(x, pop=80, plays=100, rd=90):
    return int(x['Popularity']) >= pop and int(x['NbPlays']) >= plays and int(x['RatingDeviation']) <= rd

COMBO = {'sacrifice', 'deflection', 'attraction', 'clearance', 'interference', 'capturingDefender', 'xRayAttack', 'intermezzo', 'quietMove', 'mateIn3', 'mateIn4', 'mateIn5'}
MOTIFS = ['fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'doubleCheck', 'defensiveMove', 'trappedPiece',
          'mateIn1', 'mateIn2', 'smotheredMate', 'backRankMate', 'deflection', 'attraction', 'intermezzo', 'quietMove', 'exposedKing', 'kingsideAttack']

# group -> (capacity, list, seen-count) — reservoir sampling per group
groups = {}
def reservoir(name, cap, x):
    g = groups.setdefault(name, [cap, [], 0])
    g[2] += 1
    if len(g[1]) < cap: g[1].append(x)
    else:
        j = random.randrange(g[2])
        if j < cap: g[1][j] = x

n = 0
for x in csv.DictReader(sys.stdin):
    n += 1
    if x['PuzzleId'] in first: continue
    r = int(x['Rating']); t = set(x['Themes'].split())
    if not good(x): continue
    tags = (x.get('OpeningTags') or '').split()  # current CSV: "Family Family_Variation"; older: separate columns
    slim = {'PuzzleId': x['PuzzleId'], 'FEN': x['FEN'], 'Moves': x['Moves'], 'Rating': x['Rating'], 'Themes': x['Themes'], 'GameUrl': x.get('GameUrl', ''),
            'OpeningFamily': x.get('OpeningFamily') or (tags[0] if tags else ''), 'OpeningVariation': x.get('OpeningVariation') or (tags[1] if len(tags) > 1 else '')}
    # 1. Rating ladder 600-2200: more puzzles everywhere, extra above 1000 (the harder ones)
    if 600 <= r < 2200:
        reservoir('band%d' % (r // 100), 400 if r < 1000 else 650, slim)
    # 2. Back-rank combinations (the mate needs a sacrifice / deflection / longer sequence first)
    if 'backRankMate' in t and 'smotheredMate' not in t and t & COMBO and 800 <= r <= 2200:
        reservoir('backrank-combo', 700, slim)
    # 3. Every motif the app trains and the Coach's Lab tests, 600-2000
    if 600 <= r <= 2000:
        for m in MOTIFS:
            if m in t: reservoir('motif-' + m, 260, slim)
    # 4. Defence: only-move defensive puzzles for the hidden-threat and defence training
    if 'defensiveMove' in t and 700 <= r <= 2000:
        reservoir('defence', 400, slim)
print('rows read:', n, file=sys.stderr)

chosen = {}
for name, (cap, lst, seen) in sorted(groups.items()):
    flag = 'B' if name == 'backrank-combo' else 'H' if name.startswith('band') and int(name[4:]) >= 10 else ''
    for x in lst:
        prev = chosen.get(x['PuzzleId'])
        chosen[x['PuzzleId']] = (x, ''.join(sorted(set((prev[1] if prev else '') + flag))))
    print(name, 'kept', len(lst), 'of', seen, file=sys.stderr)

out = [{'id': x['PuzzleId'], 'fen': x['FEN'], 'moves': x['Moves'], 'rating': int(x['Rating']), 'themes': x['Themes'], 'open': x['OpeningFamily'],
        'var': x['OpeningVariation'], 'flag': f, 'game': x['GameUrl']} for x, f in chosen.values()]
out.sort(key=lambda p: p['id'])
json.dump(out, open('selected2.json', 'w'))
c = collections.Counter(p['flag'] or '-' for p in out)
print(len(out), 'selected', dict(c), file=sys.stderr)
