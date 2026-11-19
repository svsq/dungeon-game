# the art pixel's size in screen px within a box: for each block size f (1–9) and offset, how far the box is from its own f×f blocks
# (each block filled with its median); the largest f still under 4 (of 255) mean error is the size the art was drawn at
#   blocksize.py <frame.png> <name> <x0> <y0> <x1> <y1> [...]
import sys
import numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); a = sys.argv[2:]
for k in range(0, len(a), 5):
    name, x0, y0, x1, y1 = a[k], *map(int, a[k + 1:k + 5]); errs = {}
    for f in range(1, 10):
        best = 1e9
        for ox in range(f):
            for oy in range(f):
                c = im[y0 + oy:y1, x0 + ox:x1]; h, w = (c.shape[0] // f) * f, (c.shape[1] // f) * f
                if h < f or w < f: continue
                c = c[:h, :w]; b = c.reshape(h // f, f, w // f, f, 3); m = np.median(b, axis=(1, 3), keepdims=True)
                best = min(best, np.abs(b - m).mean())
        errs[f] = best
    size = max([f for f in errs if errs[f] < 4] or [1])
    print(f'{name:10s} size {size}  ' + ' '.join(f'{f}:{e:.1f}' for f, e in errs.items()))
