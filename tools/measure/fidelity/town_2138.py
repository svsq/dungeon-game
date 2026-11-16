import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from labc import lab, load
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')
# town_fidelity_r10 2, measured by hand in the report, as a script (TASKS 2138): the crown of the tree by the fire, ref box | zone_town box
CROWN = ((830, 395, 940, 440), (1150, 385, 1210, 415))
for nm, p, b in (('ref', REF, CROWN[0]), ('game', sys.argv[1], CROWN[1])):
  L = lab(load(p, box=b))[0]
  print(f'{nm:4s} crown L50 {np.median(L):5.1f} L90 {np.percentile(L, 90):5.1f}')
