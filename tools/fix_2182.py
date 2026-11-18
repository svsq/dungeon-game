#!/usr/bin/env python3
"""TASKS 2182 (study/critique/chars_ref_r3.md 2): the warrior's cape on both sides of the legs, as on the sheet.
  cape   from the 2170 drawn cape (kept in art/old/hero__cape_menu-20261118-2182.png) every row below LEFT_FROM is narrowed on the
         cape side to start no further out than LEFT, and widened on the far side by RIGHT_MID at the middle of the skirt and by
         RIGHT_HEM more near the hem; each row is resampled between its old and new ends (the folds stretch, none is dropped).
         The cape side had 0.20 H out past the leg against the sheet's 0.13, the far side 0.056 against 0.12.
         Writes art/gen/hero__cape.png and _menu.png, then: python3 tools/gridify_2155.py run hero__cape
  python3 tools/fix_2182.py cape"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
TAG, GRID = '20261118-2182', '20261117-2155'
COLLAR, SKIRT, HEM, SRC_HEM = 90, 278, 310, 298
LEFT, LEFT_FROM = 28, 150
RIGHT_MID, RIGHT_HEM = 22, 8
FILL_FROM, FILL_HEM = 118, 304
load = lambda p: np.array(Image.open(p).convert('RGBA'))
smooth = lambda t: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, t)))

def keep(n):
    for src, dst in ((f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png'), (f'art/gen/{n}_menu.png', f'art/old/{n}_menu-{TAG}.png')):
        if not os.path.exists(dst): shutil.copyfile(src, dst)
    return load(f'art/old/{n}_menu-{TAG}.png')

def cape():
    n = 'hero__cape'; a = keep(n); w = a.shape[1]; op = a[..., 3] > 0
    out = np.zeros_like(a); out[:COLLAR] = a[:COLLAR]
    src = lambda y: min(SRC_HEM, int(round(COLLAR + (y - COLLAR) * (SRC_HEM - COLLAR) / (HEM - COLLAR))))
    def ends(y):
        xs = np.nonzero(op[src(y)])[0]; t = (y - COLLAR) / (SKIRT - COLLAR); xl, xr = xs.min(), xs.max()
        xl2 = max(xl, LEFT) if y > LEFT_FROM else xl
        return xl, xr, xl2, min(w - 2, int(round(xr + RIGHT_MID * smooth((t - 0.25) / 0.45) + RIGHT_HEM * smooth((t - 0.6) / 0.4))))
    for y in range(COLLAR, SKIRT + 1):
        xl, xr, xl2, xr2 = ends(y)
        for x in range(xl2, xr2 + 1): out[y, x] = a[src(y), int(round(xl + (x - xl2) * (xr - xl) / max(1, xr2 - xl2)))]
    xl, xr, xl2, xr2 = ends(SKIRT)
    for y in range(SKIRT + 1, HEM + 1):
        for x in range(xl2, xr2 + 1):
            sx = int(round(xl + (x - xl2) * (xr - xl) / max(1, xr2 - xl2)))
            if op[src(y), sx]: out[y, x] = a[src(y), sx]
    rim = a[op][np.argmin(a[op][:, :3].sum(1))]
    for x in range(FILL_FROM, xr2 + 1):
        hem = FILL_HEM - 4 * ((x // 6) % 2)
        for y in range(SKIRT + 6, hem + 1):
            if out[y, x, 3]: continue
            up = [yy for yy in range(y - 1, y - 14, -1) if out[yy, x, 3]]
            if not up or y - up[0] > 12 or out[up[0], x, :3].sum() < 150: continue
            out[y, x] = out[up[0], x]; out[y, x, :3] = (out[y, x, :3] * 0.94).astype(np.uint8)
        col = np.nonzero(out[SKIRT:hem + 1, x, 3])[0]
        if len(col): out[SKIRT + col.max(), x] = rim
    Image.fromarray(out).save(f'art/gen/{n}.png'); Image.fromarray(out).save(f'art/gen/{n}_menu.png')
    if os.path.exists(f'art/old/{n}-{GRID}.png'): os.remove(f'art/old/{n}-{GRID}.png')
    print('python3 tools/gridify_2155.py run hero__cape')

if __name__ == '__main__':
    {'cape': cape}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
