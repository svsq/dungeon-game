# how alike two class portraits are: the face box (the middle 40 % across, 20–75 % down) of each portrait, grey, 48×48,
# normalised; the correlation of their edges (Sobel) — 1.0 the same drawing, ~0.2 two unrelated faces
#   python3 tools/measure/chars_menu/facesim.py
import os, itertools
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
P = {'warrior': 'portrait.png', 'mage': 'portrait_mage.png', 'archer': 'portrait_archer.png'}
def face(n):
    im = Image.open(os.path.join(ROOT, 'live/assets', n)).convert('L'); w, h = im.size
    c = im.crop((int(w * 0.38), int(h * 0.2), int(w * 0.78), int(h * 0.75))).resize((48, 48), Image.BILINEAR)
    e = np.asarray(c.filter(ImageFilter.FIND_EDGES)).astype(float); e -= e.mean(); return e / (np.linalg.norm(e) + 1e-9)
F = {k: face(v) for k, v in P.items()}
for a, b in itertools.combinations(F, 2):
    best = max((np.roll(np.roll(F[a], dy, 0), dx, 1) * F[b]).sum() for dy in range(-4, 5) for dx in range(-4, 5))
    print(f'{a:8s} {b:8s} edge corr {best:.2f}')
