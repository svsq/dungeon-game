#!/usr/bin/env python3
"""TASKS 2183 (study/critique/chars_assets_r3.md 1-3, chars_menu_r3.md 5, chars_style_r3.md 5).
  backs  the warrior's back views under a helm (hero__body_back_{cl,pw,hd}_nh): the pair without a helm with its head rows (above
         HEAD) taken out; the _nh copies were left out of the 2154 recolour of the cape and differed from their pairs by dE 7.2-8.2.
         The same rows go into the drawn source (art/old/<name>-20261117-2155.png) so a later gridify run keeps them
  hair   the mage's grey hair cool and a little lighter: pixels of low chroma (hair) of the back heads (mage__head_back_ci,
         mage__body_back{,_le}) and of the arch's drawn heads (the _menu copies of mage__head_ci, body, body_le) move to a cool grey
         (a toward 0, b toward blue by lightness); under the torches' warm light the mauve read as lilac, and the back's tone one
         step darker than the front's (2163, DARKER) left no grey above L 45
  fist   mage__farmR and mage__cuffR: the world cells that stand out from 3-4 neighbours (speckle.py) repainted in a neighbour's
         tone, one at a time while the part's stray count drops
Every source is kept once as art/old/<name>-20261118-2183.png and each run starts from it.
  python3 tools/fix_2183.py backs|hair|fist   (then the printed gridify / prep lines)
  --rig R: a new look of the step's class (backs: a warrior's, hair and fist: a mage's), its HEAD from tools/rigarg.head; --fresh"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G
import rigarg

TAG = '20261118-2183'
HEAD = 60
RIG, FRESH = None, False
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

def backs():
    names = []
    for s in ('cl', 'pw', 'hd'):
        pair, nh = f'{RIG}__body_back_{s}', f'{RIG}__body_back_{s}_nh'
        keep(nh)
        for src, dst in ((f'art/gen/{pair}.png', f'art/gen/{nh}.png'), (f'art/old/{pair}-{G.TAG}.png', f'art/old/{nh}-{G.TAG}.png')):
            a = load(src); a[:HEAD] = 0; save(a, dst)
        names.append(nh)
    print('python3 tools/prep.py --only ' + ','.join(names))

HAIR_C, HAIR_L = 0.045, 0.38
BACK_LIFT = 0.035
COOL_A, COOL_B = 0.2, 0.02
def cool(a, lift=0.0, rows=None, lo=HAIR_L, cmax=HAIR_C):
    out = a.copy(); op = a[..., 3] >= 128; lab = G.oklab(a[..., :3].astype(float)); C = np.hypot(lab[..., 1], lab[..., 2])
    hair = op & (C < cmax) & (lab[..., 0] > lo)
    if rows is not None: hair[rows:] = False
    k = np.clip((lab[..., 0] - 0.2) / 0.4, 0, 1)
    new = lab.copy(); new[..., 0] = lab[..., 0] + lift * k; new[..., 1] = COOL_A * lab[..., 1] - 0.003; new[..., 2] = -COOL_B * k * k
    out[..., :3] = np.where(hair[..., None], np.round(G.srgb(new)), a[..., :3]).astype(np.uint8)
    return out, int(hair.sum())

BACK_LO, BACK_C = 0.26, 0.075
HAIR = {'mage__head_back_ci': (BACK_LIFT, None, BACK_LO, BACK_C), 'mage__body_back': (BACK_LIFT, 48, BACK_LO, BACK_C), 'mage__body_back_le': (BACK_LIFT, 48, BACK_LO, BACK_C),
        'mage__head_ci_menu': (0.0, None, HAIR_L, HAIR_C), 'mage__body_menu': (0.0, 48, HAIR_L, HAIR_C), 'mage__body_le_menu': (0.0, 48, HAIR_L, HAIR_C)}
def hair():
    for n, (lift, rows, lo, cmax) in HAIR.items():
        n = n.replace('mage__', f'{RIG}__', 1)
        a, k = cool(keep(n), lift, rows, lo, cmax); save(a, f'art/gen/{n}.png'); print(f'{n}: {k} hair px')
    print('python3 tools/prep.py --only ' + ','.join(n.replace('mage__', f'{RIG}__', 1) for n in HAIR))

def fist():
    C = 360 / G.ROWS
    for n in (f'{RIG}__farmR', f'{RIG}__cuffR'):
        a = keep(n); h, w = a.shape[:2]; cur = G.strays(G.snapvote(a)).sum()
        for _ in range(6):
            v = G.snapvote(a); s = G.strays(v); cur = s.sum()
            if not cur: break
            best = None
            for y, x in zip(*np.where(s)):
                for dy, dx in G.N4:
                    q = (y + dy, x + dx)
                    if not (0 <= q[0] < v.shape[0] and 0 <= q[1] < v.shape[1] and v[q][3] > 0): continue
                    b = a.copy(); y0, y1, x0, x1 = int(y * C), int((y + 1) * C), int(x * C), min(w, int((x + 1) * C))
                    blk = b[y0:y1, x0:x1]; cell = v[y, x, :3] * 255; near = np.abs(blk[..., :3].astype(float) - cell).sum(-1) < 100
                    blk[..., :3][(blk[..., 3] >= 128) & near] = np.round(v[q][:3] * 255).astype(np.uint8)
                    new = G.strays(G.snapvote(b)).sum()
                    if best is None or new < best[0]: best = (new, b)
            if best is None or best[0] >= cur: break
            a = best[1]
        print(f'{n}: strays {G.strays(G.snapvote(keep(n))).sum()} → {G.strays(G.snapvote(a)).sum()}'); save(a, f'art/gen/{n}.png')
    print(f'python3 tools/prep.py --only {RIG}__farmR,{RIG}__cuffR')

if __name__ == '__main__':
    cls = {'backs': 'hero', 'hair': 'mage', 'fist': 'mage'}.get(sys.argv[1] if len(sys.argv) > 1 else '', 'hero')
    (RIG, *more), FRESH = rigarg.take([cls])
    if more or rigarg.base(RIG) != cls: sys.exit(f'one {cls} rig, not {[RIG, *more]}')
    if not rigarg.accepted(RIG):
        HEAD = rigarg.head(RIG)['body_back']; rows = rigarg.param(RIG, 'fix_2183', 'HAIR_ROWS', 48)
        HAIR = {k: (lift, None if r is None else rows, lo, c) for k, (lift, r, lo, c) in HAIR.items()}
    {'backs': backs, 'hair': hair, 'fist': fist}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
