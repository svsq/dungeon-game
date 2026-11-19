"""Mean Lab of a frame region, or of the hero's green cloak pixels.
python3 tools/measure/chars_style/regionlab.py FRAME.png name:x0,y0,x1,y1 [...]     -> mean L a b and the share of L > 70
python3 tools/measure/chars_style/regionlab.py --green ON_DIR OFF_DIR state [...]   -> the hero mask (as heromask.py): olive pixels
(C > 10, hue 80..130) count, their mean Lab and the share of dark olive (L < 60, the signature.py rule) in the silhouette"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402


def rgb(p):
    return np.asarray(Image.open(os.path.join(ROOT, p)).convert('RGB')).astype(float)


if sys.argv[1] == '--green':
    on, off = sys.argv[2], sys.argv[3]
    for st in sys.argv[4:]:
        a, b = rgb(os.path.join(on, st + '.png')), rgb(os.path.join(off, st + '.png'))
        L, A, B = lab(a[np.abs(a - b).sum(-1) > 30])
        C, h = np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360
        g = (C > 10) & (h > 80) & (h < 130)
        print(f'{st:14s} olive px {g.sum():4d} of {len(L)}  ({g.mean():5.1%})  L {L[g].mean():3.0f} a {A[g].mean():3.0f} b {B[g].mean():3.0f}  dark olive {(g & (L < 60)).mean():5.1%}')
else:
    im = rgb(sys.argv[1])
    for spec in sys.argv[2:]:
        name, box = spec.split(':')
        x0, y0, x1, y1 = map(int, box.split(','))
        p = im[y0:y1, x0:x1].reshape(-1, 3)
        p = p[p.sum(1) > 90]
        L, A, B = lab(p)
        print(f'{name:14s} L {L.mean():3.0f} a {A.mean():3.0f} b {B.mean():3.0f}  L>70 {(L > 70).mean():4.0%}')
