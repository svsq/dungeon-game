"""ref critic r4: the bowstring is one unbroken line (2189). For every archer view of grab.mjs with the nock joints: sample the line
   nockA -> nockB every 0.5 px, a sample is string if a pixel within 1.5 px of it differs from the hero-less frame and is lighter than
   its neighbours across the line; prints the longest run of missing samples in px and the covered share.
   python3 tools/measure/chars_ref/string_r4.py [frames/critic_chars_r4_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r4_ref')
J = json.load(open(OUT / 'game/joints.json'))
for v, r in J.items():
    j = r['joints']
    if 'nockA' not in j:
        continue
    bx, by = r['box'][:2]; at = r.get('at'); k = at[2] if at else 1
    P = (lambda p: (at[0] + (p[0] - at[0]) * k - bx, at[1] + (p[1] - at[1]) * k - by)) if at else (lambda p: (p[0] - bx, p[1] - by))
    A = np.asarray(Image.open(OUT / f'game/{v}_all.png').convert('RGB')).astype(int); L = A.mean(2)
    a, b = np.array(P(j['nockA'])), np.array(P(j['nockB'])); n = int(np.hypot(*(b - a)) * 2) + 1
    d = (b - a) / np.linalg.norm(b - a); nx = np.array([-d[1], d[0]])
    hit = []
    for t in np.linspace(0.06, 0.94, n):
        p = a + t * (b - a); best = 0
        for o in np.arange(-1.5, 1.6, 0.5):
            q = p + o * nx; x, y = int(q[0]), int(q[1])
            if not (0 <= x < A.shape[1] and 0 <= y < A.shape[0]): continue
            side = [L[int(q[1] + s * nx[1] * 3), int(q[0] + s * nx[0] * 3)] for s in (-1, 1)]
            if L[y, x] > 120 and L[y, x] > min(side) + 25: best = 1
        hit.append(best)
    hit = np.array(hit); gaps = np.diff(np.flatnonzero(np.r_[1, hit, 1])) - 1
    print(f'{v:22s} string length {np.linalg.norm(b-a):5.1f} px  covered {hit.mean():.2f}  longest gap {gaps.max()*0.5:4.1f} px')
