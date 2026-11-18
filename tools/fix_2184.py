#!/usr/bin/env python3
"""TASKS 2184 (study/critique/chars_style_r3.md 1, 3, 4; the bowstring (2) is drawn in code, see TASKS).
  hood   the world heads of the hooded outfits (<rig>__body_hd): the face as in the plain outfit's head (the small ref's cells: eye,
         brow, nose, the mage's grey beard) laid into the hood's opening, the cells round it (above and before the face) one dark tone
         so the face sits in the hood's shadow. The hood's own drawn face (a few skin cells with no eye) goes. The arch keeps the drawn head
  mage   the world robe darker and a little less saturated (blue L -0.05 OKLab, chroma x0.88), the bronze trim a notch duller (chroma x0.85,
         L -0.03), the plank down the chest (one cell wide already, so not narrower) a further notch duller: no bright orange cross of plank and belt under the brazier. The _menu copies stay
  olive  the archer's world mantle one cell row longer (body, body_nh, uarmL, uarmR), the olive the hood outfit does not wear
Every source is kept once as art/old/<name>-20261118-2184.png and each run starts from it.
  python3 tools/fix_2184.py hood|mage|olive   (then the printed prep line)"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G

TAG = '20261118-2184'
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

def cellmap(a):
    h, w = a.shape[:2]; C, W, cy, cx = G.grid(h, w); return cy[:, None] * W + cx[None, :], W

FACE = {'mage': [(2, 7, 9, 14), (8, 10, 10, 14)], 'archer': [(3, 8, 11, 15)], 'hero': [(3, 8, 10, 14)]}
HOOD_ROWS = 12
SHADE = 0.27
def hood():
    names = []
    for rig, rects in FACE.items():
        body, hd = load(f'art/gen/{rig}__body.png'), keep(f'{rig}__body_hd'); cid, W = cellmap(hd); out = hd.copy()
        cy, cx = cid // W, cid % W
        box = lambda r0, r1, c0, c1: (cy >= r0) & (cy <= r1) & (cx >= c0) & (cx <= c1)
        inb = np.zeros(cid.shape, bool)
        for r in rects: inb |= box(*r)
        lab = G.oklab(hd[..., :3].astype(float)); op = hd[..., 3] >= 128
        sk = op & (lab[..., 0] > G.SKIN[0]) & (lab[..., 0] < G.SKIN[1]) & (lab[..., 1] > G.SKIN[2]) & (lab[..., 1] < G.SKIN[3]) & (lab[..., 2] > G.SKIN[4]) & (lab[..., 2] < G.SKIN[5])
        head = op & (cy < HOOD_ROWS) & (lab[..., 0] > 0.3)
        hood_lab = np.median(lab[head & ~sk & ~inb], 0)
        old = sk & (cy < HOOD_ROWS) & ~inb
        out[..., :3] = np.where(old[..., None], np.round(G.srgb(hood_lab)).astype(np.uint8), out[..., :3])
        out[inb] = body[inb]
        r0, _, c0, c1 = rects[0]
        near = box(r0 - 1, r0 - 1, c0 - 1, c1) | box(r0, rects[0][1], c0 - 1, c0 - 1) | box(r0, rects[0][1] - 1, c0 - 2, c0 - 2)
        dark = hood_lab.copy(); dark[0] = SHADE
        shade = near & ~inb & (out[..., 3] >= 128) & ~(lab[..., 0] < 0.25)
        out[..., :3] = np.where(shade[..., None], np.round(G.srgb(dark)).astype(np.uint8), out[..., :3])
        save(out, f'art/gen/{rig}__body_hd.png'); names.append(f'{rig}__body_hd')
    print('python3 tools/prep.py --only ' + ','.join(names))

MAGE = ['body', 'body_nh', 'thighL', 'thighR', 'cape', 'uarmL', 'uarmR', 'body_back', 'body_back_nh']
BLUE_L, BLUE_C = -0.05, 0.88
TRIM_L, TRIM_C = -0.04, 0.8
PLANK = (14, 17, 13)
PLANK_L, PLANK_C = -0.04, 0.75
CHEST = 13
def mage():
    names = []
    for part in MAGE:
        n = f'mage__{part}'; a = keep(n); cid, W = cellmap(a); cy, cx = cid // W, cid % W
        lab = G.oklab(a[..., :3].astype(float)); op = a[..., 3] >= 128
        C = np.hypot(lab[..., 1], lab[..., 2]); hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
        blue = op & (C > 0.04) & (hue > 250) & (hue < 310)
        trim = op & (C > 0.09) & (hue > 30) & (hue < 90) & (lab[..., 0] > 0.5) & ((cy >= CHEST) | (part not in ('body', 'body_nh')))
        new = lab.copy()
        new[blue, 0] += BLUE_L; new[blue, 1:] *= BLUE_C
        new[trim, 0] += TRIM_L; new[trim, 1:] *= TRIM_C
        out = a.copy(); ch = blue | trim; out[..., :3][ch] = np.round(G.srgb(new[ch])).astype(np.uint8)
        if part in ('body', 'body_nh'):
            pl = op & (cy >= PLANK[0]) & (cy <= PLANK[1]) & (cx == PLANK[2]) & trim; lab2 = G.oklab(out[..., :3].astype(float)); lab2[pl, 0] += PLANK_L; lab2[pl, 1:] *= PLANK_C
            out[..., :3][pl] = np.round(G.srgb(lab2[pl])).astype(np.uint8)
        save(out, f'art/gen/{n}.png'); names.append(n)
    print('python3 tools/prep.py --only ' + ','.join(names))

ARCHER = ['body', 'body_nh', 'uarmL', 'uarmR']
def olive():
    names = []
    for part in ARCHER:
        n = f'archer__{part}'; a = keep(n); cid, W = cellmap(a); cy, cx = cid // W, cid % W
        lab = G.oklab(a[..., :3].astype(float)); op = a[..., 3] >= 128
        C = np.hypot(lab[..., 1], lab[..., 2]); hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
        grn = op & (C > 0.04) & (hue > 100) & (hue < 140) & (lab[..., 0] < 0.6)
        cell = lambda m, r, c: m & (cy == r) & (cx == c)
        out = a.copy(); done = 0
        for r in range(42):
            for c in range(W):
                if not cell(grn, r, c).sum() >= 0.5 * max(1, cell(op, r, c).sum()) or cell(op, r, c).sum() == 0: continue
                if r + 1 >= 42 or cell(grn, r + 1, c).any(): continue
                under = cell(op, r + 1, c) & (lab[..., 0] > 0.4) & (C < 0.12) & (hue > 60) & (hue < 100)
                if under.sum() < 0.5 * max(1, cell(op, r + 1, c).sum()): continue
                tone = a[..., :3][cell(grn, r, c)].astype(float).mean(0) * 0.95
                out[..., :3][cell(op, r + 1, c)] = np.round(tone).astype(np.uint8); done += 1
        save(out, f'art/gen/{n}.png'); names.append(n); print(n, 'cells', done)
    print('python3 tools/prep.py --only ' + ','.join(names))

if __name__ == '__main__':
    {'hood': hood, 'mage': mage, 'olive': olive}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
