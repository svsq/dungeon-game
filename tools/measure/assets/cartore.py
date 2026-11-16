# cartore.py (TASKS 2133): L*, b* of the cart's load on cartload.js's crops (x4), the head-on cart at the adit against the 3/4 one at the
# rails' end, each load; the heap's box by eye on the r10 crops, wood (warm, a* > 12 and b* > 20) and ink (L* < 10) left out.
# run: python3 tools/measure/assets/cartore.py frames/fix_2133/after/cartload [more dirs]
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'fidelity'))
from labc import lab, load
BOX = {'adit': {3: (290, 165, 362, 245), 2: (295, 235, 350, 268), 1: (298, 215, 345, 268)},
  'end': {3: (230, 195, 372, 320), 2: (215, 292, 292, 332), 1: (276, 244, 320, 294)}}
for d in sys.argv[1:]:
  for tag, loads in BOX.items():
    for ld, b in loads.items():
      L, A, B = lab(load(os.path.join(d, f'{tag}_l{ld}.png'), box=b)); m = (L >= 10) & ~((A > 12) & (B > 20))
      print(f'{d:40s} {tag:4s} load {ld}  n {m.sum():5d}  L* p50 {np.median(L[m]):5.1f} p90 {np.percentile(L[m], 90):5.1f}  b* {np.median(B[m]):5.1f}')
