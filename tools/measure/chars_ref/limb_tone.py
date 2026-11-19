"""ref critic r3: left/right tone of the limbs as they show in the drawn hero (arms.mjs: the median colour of each part's
   visible pixels), Lab and dE76 between the L and R part; the forearm R is the cuff when the fist is drawn on its own.
   python3 tools/measure/chars_ref/limb_tone.py [frames/critic_chars_r3_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from measure import lab

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r3_ref')
A = json.load(open(OUT / 'arms/arms.json'))
res = {}
for v, r in A.items():
    row = {}
    for n, l, rr in [('thigh', 'thighL', 'thighR'), ('shin', 'shinL', 'shinR'), ('foot', 'footL', 'footR'), ('uarm', 'uarmL', 'uarmR'), ('farm', 'farmL', 'cuffR' if 'cuffR' in r else 'farmR')]:
        if r.get(l, {}).get('rgb') and r.get(rr, {}).get('rgb'):
            a, b = lab(np.array(r[l]['rgb'])), lab(np.array(r[rr]['rgb']))
            row[n] = (round(float(np.linalg.norm(a - b)), 1), round(float(a[0]), 1), round(float(b[0]), 1), r[l]['vis'], r[rr]['vis'])
    res[v] = row
    print(f'{v:24s}', '  '.join(f'{n} dE {d[0]:4.1f} (L* {d[1]}/{d[2]}, px {d[3]}/{d[4]})' for n, d in row.items()))
json.dump(res, open(OUT / 'limb_tone.json', 'w'), indent=1)
