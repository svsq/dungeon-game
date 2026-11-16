import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from labc import lab, load
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')
# r9: windows r8 named without boxes (crypt jambs, forge ring), re-chosen by eye on zone_town; ref box | game box
WIN = {'crypt jambs': ((700, 215, 730, 330), (1000, 250, 1022, 325)), 'forge ring': ((915, 250, 960, 330), (1395, 225, 1425, 270)),
  'hero-fire pave': ((700, 470, 740, 520), (930, 520, 990, 560))}
for k, (rb, gb) in WIN.items():
  for nm, p, b in (('ref', REF, rb), ('game', sys.argv[1], gb)):
    L, A, B = lab(load(p, box=b)); C = np.hypot(A, B)
    print(f'{k:15s} {nm:4s} L10 {np.percentile(L,10):5.1f} L50 {np.median(L):5.1f} a {A.mean():5.1f} b {B.mean():5.1f} C50 {np.median(C):5.1f}')
