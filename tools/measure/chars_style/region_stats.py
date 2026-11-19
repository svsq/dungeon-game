"""Lab of a box and its red share: python3 tools/measure/chars_style/region_stats.py IMG X0 Y0 X1 Y1 [label]
Prints the box's pixel count, the share and count of cloak-red pixels (a* > 18, hue < 50 or > 340, L* < 45), their mean Lab and L* spread
(a flat fill has a small spread; quilting adds dark seams), and the count of near-black pixels (L* < 12: a gap or an outline)."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

p, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
a = np.asarray(Image.open(os.path.join(ROOT, p)).convert('RGB').crop((x0, y0, x1, y1))).astype(float).reshape(-1, 3)
L, A, B = lab(a)
h = np.degrees(np.arctan2(B, A)) % 360
red = (A > 18) & ((h < 50) | (h > 340)) & (L < 45)
print(f"{sys.argv[6] if len(sys.argv) > 6 else p}: box {x1 - x0}x{y1 - y0}={len(L)} px, red {red.sum()} ({100 * red.mean():.0f}%)"
      + (f", red Lab {L[red].mean():.1f} {A[red].mean():.1f} {B[red].mean():.1f}, red L sd {L[red].std():.1f}" if red.any() else '')
      + f", all Lab {L.mean():.1f} {A.mean():.1f} {B.mean():.1f}, L sd {L.std():.1f}, near-black {(L < 12).sum()}")
