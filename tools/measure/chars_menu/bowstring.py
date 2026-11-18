# the bowstring in an arch frame: per row of the bow's span the light, grey pixels in the string's column band; a row without one is
# a break. string.py <frame.png> <x0> <x1> <y0> <y1>   (the band and the span to scan, view px)
import sys
import numpy as np
from PIL import Image
f, x0, x1, y0, y1 = sys.argv[1], *map(int, sys.argv[2:6])
a = np.asarray(Image.open(f).convert('RGB')).astype(int)[y0:y1, x0:x1]
L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
sat = a.max(2) - a.min(2)
hit = (L > 120) & (sat < 60)
rows = hit.any(1)
runs, cur = [], 0
for r in rows:
    if not r: cur += 1
    elif cur: runs.append(cur); cur = 0
first, last = np.argmax(rows), len(rows) - np.argmax(rows[::-1]) - 1
inner = rows[first:last + 1]
print(f'{f}: string rows {inner.sum()}/{len(inner)} from y {y0 + first} to {y0 + last}, gaps {int((~inner).sum())}, longest gap {max([0] + [len(s) for s in "".join("1" if v else "0" for v in inner).split("1")])}')
