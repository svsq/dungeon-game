"""Art-pixel size of regions of a frame: the mode and the low quartile of horizontal and vertical runs of one colour (neighbours closer than TOL in summed RGB, default 24: the lit frame adds per-pixel light noise).
python3 tools/measure/chars_style/cellsize.py FRAME.png name:x0,y0,x1,y1 [name:x0,y0,x1,y1 ...]
A region scaled k times by nearest neighbour has runs that are multiples of k, so the mode (ignoring runs of 1, which come from
filtering and lit edges) reads the screen size of one art pixel."""
import os
import sys
from collections import Counter
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TOL = int(os.environ.get('TOL', 24))
im = np.asarray(Image.open(os.path.join(ROOT, sys.argv[1])).convert('RGB')).astype(int)


def runs(a):
    out = []
    for row in a:
        d = np.abs(row[1:] - row[:-1]).sum(-1) > TOL
        cut = np.concatenate([[0], np.where(d)[0] + 1, [len(row)]])
        out += list(np.diff(cut)[1:-1])
    return out


for spec in sys.argv[2:]:
    name, box = spec.split(':')
    x0, y0, x1, y1 = map(int, box.split(','))
    reg = im[y0:y1, x0:x1]
    r = runs(reg) + runs(reg.transpose(1, 0, 2))
    c = Counter(v for v in r if v > 1)
    mode = c.most_common(3)
    print(f'{name:14s} runs={len(r):5d} mode(>1)={mode} q25={np.percentile(r, 25):.0f} median={np.median(r):.0f} share1={sum(1 for v in r if v == 1) / max(1, len(r)):.2f}')
