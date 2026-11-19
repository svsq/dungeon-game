"""Face detail of the hero's head in a frame: python3 tools/measure/chars_style/facefeat.py ON_DIR OFF_DIR state [state ...]
Hero mask as heromask.py; head band = rows 4..16 % of the silhouette height below its top, columns of the mask in those rows
minus the outline (pixels with L < 12) and minus the staff/bow (the right-most 30 % of the band's width). Prints the count of
dark feature pixels (L 12..32: eye, brows, beard shadow), the share of grey hair/beard (C < 14, L > 40) and the L spread p10..p90."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

on_dir, off_dir, states = sys.argv[1], sys.argv[2], sys.argv[3:]
for st in states:
    a = np.asarray(Image.open(os.path.join(ROOT, on_dir, st + '.png')).convert('RGB')).astype(float)
    b = np.asarray(Image.open(os.path.join(ROOT, off_dir, st + '.png')).convert('RGB')).astype(float)
    m = np.abs(a - b).sum(-1) > 30
    ys, xs = np.where(m)
    keep = (np.abs(ys - np.median(ys)) < 70) & (np.abs(xs - np.median(xs)) < 70)
    ys, xs = ys[keep], xs[keep]
    top, H = ys.min(), ys.max() - ys.min()
    sel = (ys >= top + 0.04 * H) & (ys < top + 0.16 * H)
    hy, hx = ys[sel], xs[sel]
    x0, x1 = np.percentile(hx, 5), np.percentile(hx, 70)
    k = (hx >= x0) & (hx <= x1)
    L, A, B = lab(a[hy[k], hx[k]])
    C = np.hypot(A, B)
    L, C = L[L >= 12], C[L >= 12]
    print(f'{st:14s} px {len(L):3d}  dark feat {((L < 32)).sum():3d} ({(L < 32).mean():4.0%})  grey {((C < 14) & (L > 40)).mean():4.0%}  L p10..p90 {np.percentile(L, 10):3.0f}..{np.percentile(L, 90):3.0f}')
