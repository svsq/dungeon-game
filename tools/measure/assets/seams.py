# seams.py: wrap seams of the magma repeat textures. For each axis: mean |dRGB| across the wrap (last row/col against the first) over the
# mean of the same between neighbouring interior rows/cols (1.0 = as the inside; pixel-art block edges make the mean, not the median, the base),
# pct: share of inner lines weaker than the wrap (> 99 = the wrap is the strongest line of the tile), inner max/mean: worst baked inner line.
import os, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
for n in ['floor_mg_tex', 'lava_tex', 'shore_mg_tex', 'wall_mg_tex', 'walltop_mg_tex', 'floor_cv_tex']:
    p = os.path.join(ROOT, 'art', 'gen', n + '.png')
    if not os.path.exists(p): continue
    a = np.asarray(Image.open(p).convert('RGB')).astype(float)
    r = []
    for ax in (1, 0):
        b = a if ax == 1 else a.transpose(1, 0, 2)
        d = np.abs(np.diff(b, axis=1)).sum(2).mean(0)          # per column boundary
        wrap = np.abs(b[:, -1] - b[:, 0]).sum(1).mean()
        mu = d.mean(); r.append((wrap / mu, (d < wrap).mean() * 100, d.max() / mu))
    print(f"{n:16s} x: wrap/mean {r[0][0]:.2f} pct {r[0][1]:5.1f} inner max/mean {r[0][2]:.2f}   y: wrap/mean {r[1][0]:.2f} pct {r[1][1]:5.1f} inner max/mean {r[1][2]:.2f}")
