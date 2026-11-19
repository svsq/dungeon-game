#!/usr/bin/env python3
"""Mean L* per texel column over a band of rows of a layers_r4.cjs composite (DUMP=1), with the owner most often on top in that column:
python3 tools/measure/chars_assets/bandprofile_r4.py <out.json> <row0> <row1> <col0> <col1>. Shows the dark slot between the near
sleeve and the torso as a dip, and whose texels make it."""
import json, sys, numpy as np
from PIL import Image
from collections import Counter
f, r0, r1, c0, c1 = sys.argv[1], *map(int, sys.argv[2:6]); d = json.load(open(f)); W, H = d['W'], d['H']
own = np.array(d['own']).reshape(H, W); img = np.asarray(Image.open(f.replace('.json', '.png')).convert('RGB')).astype(float) / 255
lin = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4); Y = lin @ [0.2126, 0.7152, 0.0722]; L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
short = lambda n: n.split('__')[-1] if n else '-'
for c in range(c0, c1):
    col = L[r0:r1, c]; ow = Counter(short(d['names'][o]) if o >= 0 else 'empty' for o in own[r0:r1, c]).most_common(2)
    print(f'col {c:3d} (world x {(c + d["x0"]) / d["Z"]:6.1f})  L* {col.mean():5.1f}  dark share {(col < 25).mean():4.2f}  ' + '#' * int(col.mean() / 2) + '   ' + ', '.join(f'{k} {v}' for k, v in ow))
