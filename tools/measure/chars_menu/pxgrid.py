# the pixel grid of a box of a frame: the mean run of equal colours along rows and columns (≈ the art's pixel size in screen px)
#   pxgrid.py <frame.png> <name> <x0> <y0> <x1> <y1> [<name> <x0> <y0> <x1> <y1>]...
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); a = sys.argv[2:]
def run(px, xs, ys, horiz):
    n = b = 0
    for o in (ys if horiz else xs):
        prev = None
        for i in (xs if horiz else ys):
            p = px[i, o] if horiz else px[o, i]
            if prev is not None:
                n += 1; b += max(abs(p[0] - prev[0]), abs(p[1] - prev[1]), abs(p[2] - prev[2])) > 6
            prev = p
    return n / max(1, b)
px = im.load()
for k in range(0, len(a), 5):
    name, x0, y0, x1, y1 = a[k], *map(int, a[k + 1:k + 5])
    print(f'{name:14s} rows {run(px, range(x0, x1), range(y0, y1), True):5.2f}  cols {run(px, range(x0, x1), range(y0, y1), False):5.2f}')
