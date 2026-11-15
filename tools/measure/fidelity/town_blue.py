import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from labc import lab, load
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')
# cold light pools of the enchanter and the altar: share of pixels with b* < -10 (blue) and their mean L, ref box vs game box (zone_town)
PAIRS = {'altar': ((930, 580, 1070, 690), (1270, 620, 1420, 760)), 'enchanter': ((980, 430, 1110, 530), (1370, 450, 1510, 560))}
def blue(p, box):
  L, A, B = lab(load(p, box=box)); m = B < -10
  return m.mean() * 100, (L[m].mean() if m.any() else 0), (B[m].mean() if m.any() else 0), np.percentile(L, 95)
for k, (rb, gb) in PAIRS.items():
  r = blue(REF, rb); g = blue(sys.argv[1], gb)
  print(f'{k:10s} ref blue={r[0]:5.1f}% L={r[1]:5.1f} b={r[2]:6.1f} L95={r[3]:5.1f} | game blue={g[0]:5.1f}% L={g[1]:5.1f} b={g[2]:6.1f} L95={g[3]:5.1f}')
