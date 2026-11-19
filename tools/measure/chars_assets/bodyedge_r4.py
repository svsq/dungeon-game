#!/usr/bin/env python3
"""The torso's near (cape-side, left in the texture) edge under the shoulder: python3 tools/measure/chars_assets/bodyedge_r4.py <rig>__body_menu [y0 y1]
Per texel row, from the leftmost opaque texel rightward until the first run of 3 lit texels (L* >= 40): the texels' L* class
(# dark < 25, + mid 25-40, o lit >= 40, ' ' transparent) and the dark count. The dark run is the torso's own outline and armpit shade:
opaque, so the sleeve copy under the body (2188) cannot cover it and heroShoulderCheck (alpha only) cannot see it."""
import sys, numpy as np
from PIL import Image
n = sys.argv[1]; im = np.asarray(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float)
rgb = im[..., :3] / 255; lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4); Y = lin @ [0.2126, 0.7152, 0.0722]
L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y); A = im[..., 3] > 127
y0, y1 = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (0, im.shape[0])
tot = 0
for y in range(y0, y1):
    xs = np.nonzero(A[y])[0]
    if not len(xs): continue
    x = xs[0]; s = ''; d = 0
    while x < im.shape[1] - 3 and not (A[y, x:x + 3].all() and (L[y, x:x + 3] >= 40).all()):
        c = ' ' if not A[y, x] else '#' if L[y, x] < 25 else '+' if L[y, x] < 40 else 'o'; s += c; d += c == '#'; x += 1
    tot += d
    print(f'{y:4d} from x {xs[0]:3d}: {s:<40s} dark {d}')
print('dark total', tot)
