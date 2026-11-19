#!/usr/bin/env python3
"""TASKS 2195: the mage seen from behind read as two robes, a short hooded cloak ending at the belt with its own trim and, below it, the
front skirt (the thighs, a brighter blue with the front slit and a second trim). The back painting (art/gen/hero_body_back_mage_new.png)
is a robe to the ankles, but its cut ended at canvas y 259 while the legs reach 360.
  hem  every mage__body_back{,_nh,_le,_le_nh,_hd,_hd_nh}: from START (world row) down the cells are rebuilt to the skirt's hem: the
       cloth's own world cells of the FOLD rows above START, stretched down (rows) and flared to the skirt's width (columns), so the
       folds run on from the shoulders; then TRIM_ROWS rows of trim at the hem (the old trim's tones) and the ink outline round it. The
       leather outfit keeps its jerkin and takes the plain robe's cloth under it. The scene hides the skirt from behind (scene_hero.js).
Every source is kept once as art/old/<name>-20261118-2195.png and each run starts from it.
  python3 tools/fix_2195.py preview OUT.png   the six backs ×4, nothing written
  python3 tools/fix_2195.py hem   (then softbones.py for mage__body_back and the printed prep line)
  --rig R: a new mage look, its rows (START, HEM_ROW, HEM_W, MID, …) from art/look_params.json, else the mage's; --fresh"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G
import rigarg

TAG = '20261118-2195'
RIG, FRESH = 'mage', False
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

START = {'': 25, '_nh': 25, '_hd': 25, '_hd_nh': 25, '_le': 27, '_le_nh': 27}
CLOTH = {'_le': '', '_le_nh': '_nh'}
FOLD = 6
TRIM_ROWS = 2
HEM_ROW = 37            # the skirt's last world row (mage__thighL ends at canvas y 324)
HEM_W = 128             # the skirt's width at its hem (118) and its ragged flare, canvas px
RAGGED = 3              # every other cell of the hem ends this much higher, as the skirt's ragged hem
INK, EDGE = (49, 18, 12), 3
TRIM_LO, TRIM_HI = (128, 79, 53), (161, 106, 72)
MID = 95

def cells(a):
    v = G.snapvote(a); return (np.round(v[..., :3] * 255).astype(np.uint8), v[..., 3] > 0)

def span(a, y):
    op = a[y, :, 3] >= 128; x0 = x1 = MID
    while x0 > 0 and op[x0 - 1]: x0 -= 1
    while x1 < a.shape[1] - 1 and op[x1 + 1]: x1 += 1
    return x0, x1

def hem(a, cloth, start, cstart):
    H, W = a.shape[:2]; C = H / G.ROWS; nc = int(np.ceil(W / C))
    rgb, on = cells(cloth); y0 = int(np.ceil(start * C)); yb = int(np.floor((HEM_ROW + 1) * C)) - 1; yt = int(np.ceil((HEM_ROW + 1 - TRIM_ROWS) * C)) - EDGE
    xs0, xs1 = span(cloth, int(cstart * C) - 1); cx = (xs0 + xs1) / 2
    xl1, xr1 = int(round(cx - HEM_W / 2)), min(W - 1, int(round(cx + HEM_W / 2)))
    xa0, xa1 = span(a, int((start - 1.5) * C))
    out = a.copy(); out[y0:] = 0
    for y in range(int((start - 1) * C), y0):
        out[y, :xa0] = 0; out[y, xa1 + 1:] = 0; out[y, xa0:xa0 + EDGE] = out[y, xa1 - EDGE + 1:xa1 + 1] = (*INK, 255)
    lo, hi = cstart - FOLD, cstart - 1
    tone = rgb[lo:hi + 1]; seen = on[lo:hi + 1]
    blue = (tone[..., 2].astype(int) > tone[..., 0].astype(int) + 20) & seen
    light = np.array([tone[:, c][blue[:, c]].astype(int).sum(-1).mean() if blue[:, c].any() else 0 for c in range(nc)])
    cols = [c for c in range(nc) if blue[:, c].any()]
    rows_n = HEM_ROW + 1 - TRIM_ROWS - start
    cmid = cx / C; w0 = (xs1 - xs0) / C; w1 = (xr1 - xl1) / C
    for y in range(y0, yb + 1):
        t = (y - y0) / max(1, yb - y0); xl = int(round(xa0 + (xl1 - xa0) * t)); xr = int(round(xa1 + (xr1 - xa1) * t))
        r = min(G.ROWS - 1, int((y + 0.5) / C)); scale = w0 / (w0 + (w1 - w0) * t)
        for x in range(xl, xr + 1):
            c = int((x + 0.5) / C); src = int(round(cmid + (c + 0.5 - cmid) * scale - 0.5)); src = min(cols, key=lambda k: abs(k - src))
            if r < HEM_ROW + 1 - TRIM_ROWS:
                sr = min(FOLD - 1, int((r - start) * FOLD / rows_n)); k = sr
                while not blue[k, src] and k > 0: k -= 1
                if not blue[k, src]: k = int(np.argmax(blue[:, src]))
                col = tone[k, src]
            else:
                col = TRIM_HI if (r == HEM_ROW + 1 - TRIM_ROWS and light[src] >= np.median(light[cols])) else TRIM_LO
            out[y, x] = (*col, 255)
        for x in list(range(xl, xl + EDGE)) + list(range(xr - EDGE + 1, xr + 1)): out[y, x] = (*INK, 255)
        if y > yb - EDGE: out[y, xl:xr + 1] = (*INK, 255)
    for c in range(1, nc, 2):
        x0, x1 = int(round(c * C)), min(W, int(round((c + 1) * C)))
        col = out[:, x0:x1]; op = col[yb - EDGE - RAGGED + 1:yb + 1, :, 3] > 0
        col[yb - RAGGED + 1:yb + 1] = 0; seg = col[yb - EDGE - RAGGED + 1:yb - RAGGED + 1]; seg[op[:EDGE]] = (*INK, 255)
    return out

def run(prev=None):
    names = []; shots = []
    for s, start in START.items():
        n = f'{RIG}__body_back{s}'; a = keep(n); cloth = keep(f'{RIG}__body_back{CLOTH[s]}') if s in CLOTH else a
        b = hem(a, cloth, start, START[CLOTH.get(s, s)]); names.append(n)
        if prev: shots.append(b); continue
        save(b, f'art/gen/{n}.png')
        print(n, 'rebuilt from world row', start, 'to', HEM_ROW)
    if prev:
        Z = 4; h, w = shots[0].shape[:2]; S = Image.new('RGBA', (w * Z * len(shots), h * Z), (90, 90, 90, 255))
        for i, b in enumerate(shots): S.alpha_composite(Image.fromarray(b).resize((w * Z, h * Z), Image.NEAREST), (i * w * Z, 0))
        S.save(prev); return
    print('python3 tools/prep.py --only ' + ','.join(names))

if __name__ == '__main__':
    (RIG, *more), FRESH = rigarg.take([RIG])
    if more or rigarg.base(RIG) != 'mage': sys.exit(f'one mage rig, not {[RIG, *more]}')
    for k in ('START', 'CLOTH', 'FOLD', 'TRIM_ROWS', 'HEM_ROW', 'HEM_W', 'RAGGED', 'INK', 'EDGE', 'TRIM_LO', 'TRIM_HI', 'MID'): globals()[k] = rigarg.param(RIG, 'fix_2195', k, globals()[k])
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'preview': run(sys.argv[2])
    elif cmd == 'hem': run()
    else: print(__doc__)
