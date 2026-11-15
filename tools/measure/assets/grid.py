# grid.py names...: art-pixel grid of live/assets sources and what it becomes at play size. blk: the source's art-pixel size (median run of
# near-equal colour (each channel within 10) along rows, opaque px); src art px: source height / blk; play art px: view height (live/sizes.js) / PIX 2; ratio: source art px per
# play art px (1.0 = one painted pixel per game pixel; > 1.6 = painted detail is averaged away, < 0.8 = painted pixels are blown up into blocks)
import os, re, sys, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
src = open(os.path.join(ROOT, 'live', 'sizes.js')).read()
H = {m.group(1): float(m.group(2)) for m in re.finditer(r'\b([a-z_0-9]+):\s*([0-9.]+)', src)}
print(f"{'name':18s} {'size':>10s}  blk  srcArt  play  ratio")
for n in sys.argv[1:]:
    im = np.asarray(Image.open(os.path.join(ROOT, 'live', 'assets', n + '.png')).convert('RGBA')).astype(int)
    runs = []
    for row in im[::3]:
        op = row[:, 3] > 200; r = 1
        for i in range(1, len(row)):
            if op[i] and op[i - 1] and np.abs(row[i, :3] - row[i - 1, :3]).max() <= 10: r += 1
            else:
                if r > 1 or op[i - 1]: runs.append(r)
                r = 1
    blk = float(np.median(runs)) if runs else 1
    sa = im.shape[0] / blk; pa = H.get(n, 0) / 2
    print(f"{n:18s} {im.shape[1]:4d}x{im.shape[0]:<5d} {blk:4.1f} {sa:7.0f} {pa:5.0f}  {sa / pa if pa else 0:5.2f}")
