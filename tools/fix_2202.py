#!/usr/bin/env python3
"""TASKS 2202: the warrior seen from behind (walking up, mid-turn, mid-whirl) wore a stump of a cape: the cape painted into
hero__body_back* ended at the knee, 0.33 H above the soles against the front cape's 0.13-0.15 H, and browner (ΔE 6-8 in the game,
with the back view's bodySat dulling, which the warrior's look now leaves out: live/data_hero.js look.backSat).
  hem   every hero__body_back{,_nh,_cl,_cl_nh,_pw,_pw_nh,_hd,_hd_nh}: from world row START down the cape is the plain back's (the
        outfits' plates and hood end above it), DROP world rows longer: the cloth cells of FOLD rows over START stretched down per
        column (the folds run on), the edges flared FLARE px to the hem; the torn hem is the front cape's own (TASKS 2205): per grid
        column of the front cape (its px drawn by hand) the depth of its hem under the hem's envelope over ENV columns either side,
        laid across the back's width, EDGE px of INK at each tooth's foot
  (TASKS 2205) --rig archer: the archer's archer__body_back{,_nh,_hd,_hd_nh} the same way (RIGCFG): its back cape ended 0.05 H over the
        front's, rounded off without teeth
  tone  the cape's texels (rows from CAPE_TOP, CIELab a* over RED_A and L* under RED_L) moved in Lab so their mean is TARGET: the
        front cape's as seen at rest (tools/measure/chars_motion/cape2202.cjs, rest front: 16.4 28.9 19.7) set off by what the game's
        grade made of it (tools/measure/fix2202/live.mjs: at that mean the back came out L* −1.6, a* +2.9 against the front)
Every source is kept once as art/old/<name>-20261119-2202.png (the archer's -20261119-2205) and each run starts from it.
  python3 tools/fix_2202.py preview OUT.png   the eight backs ×3, nothing written
  python3 tools/fix_2202.py hem   (then softbones.py for hero__body_back and the printed prep line)
  --rig R: the archer or a new warrior or archer look, its numbers from art/look_params.json, else its class's; --fresh"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import rigarg
import gridify_2155 as G

TAG = '20261119-2202'
RIG, FRESH = 'hero', False
ROWS = 42
SUFFIXES = ['', '_nh', '_cl', '_cl_nh', '_pw', '_pw_nh', '_hd', '_hd_nh']
START = 24
DROP = 9
FOLD = (18, 25)
HEM0 = 27
CLOTH_A, CLOTH_L = 15, 9
EDGE, SIDE, FLARE = 3, 1, 7
ENV, SPAN = 2, 6
UP = 0
OWN = ()
FRONT = {'': '__cape'}
INK = (41, 16, 11)
CAPE_TOP = {'': 10, '_cl': 10, '_pw': 10, '_hd': 14}
RED_A, RED_L = 12, 34
TARGET = (17.6, 26.8, 19.2)
CAPE_HUE = 'red'
# the archer: its back's cape from row 24 (the quiver ends at 20), the hem to row 30 less UP px (the front's 0.29 H over the soles); any lit cloth
# is the cape there (olive, or the cloak's brown: OWN, the outfits whose back cape is their own cloth, not the plain back's); its tone
# under the quiver (CAPE_TOP) the front cape's own (TARGET 'front', texels of L* under RED_L: the olive's light is over 34). The olive back stretches only its olive cells (CAPE_HUE):
# the jerkin's brown at the side ran down the cape as a stripe. The teeth sit on the grid's cells, as the shader votes them
RIGCFG = {'archer': dict(TAG='20261119-2205', SUFFIXES=['', '_nh', '_hd', '_hd_nh'], START=24, DROP=3, FOLD=(20, 24), HEM0=27, CLOTH_A=-99, CLOTH_L=9, FLARE=6,
                         INK=(34, 17, 10), CAPE_TOP={'': 20, '_hd': 20}, UP=4, RED_L=60, FRONT={'': '__cape', '_hd': '__cape_hd'}, OWN=('_hd',), CAPE_HUE='olive', TARGET='front')}
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)


def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)


M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]), np.array([0.95047, 1.0, 1.08883])


def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92); xyz = c @ M[0].T / M[1]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def rgb(L):
    fy = (L[..., 0] + 16) / 116; f = np.stack([fy + L[..., 1] / 500, fy, fy - L[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * M[1]; c = xyz @ np.linalg.inv(M[0]).T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(np.uint8)


def span(a, y):
    op = np.where(a[y, :, 3] >= 128)[0]; return int(op.min()), int(op.max())


def profile(n):
    """the front cape's hem per its grid column: px under the envelope of the ENV columns either side (its own drawn teeth); a column
    ending SPAN cells over the median is the clasp or the shoulder, not the hem"""
    f = load(f'art/gen/{n}.png'); op = f[..., 3] >= 128; C = f.shape[0] / ROWS; nc = int(np.ceil(f.shape[1] / C)); bot = []
    for c in range(nc):
        col = op[:, int(c * C):int((c + 1) * C)].mean(1) >= 0.5; bot.append(np.nonzero(col)[0].max() if col.any() else -1)
    bot = np.array(bot); lo = np.median(bot[bot >= 0]); ok = bot > lo - SPAN * C; cs = np.nonzero(ok)[0]
    return np.array([bot[max(0, i - ENV):i + ENV + 1][ok[max(0, i - ENV):i + ENV + 1]].max() - bot[i] for i in cs])


def hem(a, cloth, teeth, olive=False):
    H, W = a.shape[:2]; C = H / ROWS; nc = int(np.ceil(W / C)); y0 = int(np.ceil(START * C)); out = a.copy(); out[y0:] = 0
    v = G.snapvote(cloth); col = np.round(v[..., :3] * 255); L = lab(col); red = (v[..., 3] > 0) & (L[..., 1] > CLOTH_A) & (L[..., 0] > CLOTH_L) & (((L[..., 1] < -1) & (L[..., 2] > 6)) if olive else True)
    cols = [c for c in range(nc) if red[START - 1, c]]; hem_row = HEM0 + DROP
    yb = int(np.ceil((hem_row + 1) * C)) - 1 - UP; xl0, xr0 = span(cloth, y0 - 1)
    for y in range(y0, yb + 1):
        t = (y - y0) / max(1, yb - y0); r = int(y / C); xl, xr = int(round(xl0 - FLARE * t)), int(round(xr0 + FLARE * t))
        sr = FOLD[0] + int(round((r - START) / max(1, hem_row - START) * (FOLD[1] - FOLD[0])))
        for x in range(max(0, xl), min(W - 1, xr) + 1):
            for c in sorted(cols, key=lambda k: abs(k - int(x / C))):
                k = sr
                while k > 0 and not red[k, c]: k -= 1
                if red[k, c]: break
            out[y, x] = (*col[k, c].astype(np.uint8), 255)
        out[y, max(0, xl):max(0, xl) + SIDE] = (*INK, 255); out[y, min(W - 1, xr) - SIDE + 1:min(W - 1, xr) + 1] = (*INK, 255)
    xl, xr = int(round(xl0 - FLARE)), int(round(xr0 + FLARE)); cells = list(range(int(xl // C), int(xr // C) + 1))
    for i, c in enumerate(cells):
        d = teeth[min(len(teeth) - 1, int(round(i * (len(teeth) - 1) / max(1, len(cells) - 1))))]
        low = yb - max(EDGE, int(d)); xs = slice(max(0, int(c * C), xl), min(W, int((c + 1) * C), xr + 1))
        out[low + 1:yb + 1, xs] = 0; out[low - EDGE + 1:low + 1, xs] = (*INK, 255)
    op = out[y0:, :, 3] > 0; lone = op & ~np.pad(op, ((0, 0), (1, 0)))[:, :-1] & ~np.pad(op, ((0, 0), (0, 1)))[:, 1:]
    out[y0:][lone] = 0
    return out


def cape_mask(L, own):
    if CAPE_HUE == 'red': return L[..., 1] > RED_A
    return (L[..., 1] > 4) & (L[..., 2] > L[..., 1]) if own else (L[..., 1] < -1) & (L[..., 2] > 6)


def tone(a, top, front, own):
    """the cape's texels from row top moved in Lab so their mean is TARGET, or with TARGET 'front' the front cape's own (its texels of the
    same cloth: the archer's front and back cape are drawn under one grade once look.back.sat is 1)"""
    if TARGET is None: return a, (0, 0, 0)
    C = a.shape[0] / ROWS; y0 = int(top * C); sub = a[y0:]; L = lab(sub[..., :3].astype(float))
    m = (sub[..., 3] >= 128) & cape_mask(L, own) & (L[..., 0] < RED_L)
    if not m.any(): return a, (0, 0, 0)
    if TARGET == 'front': f = load(f'art/gen/{front}.png'); Lf = lab(f[..., :3].astype(float)); tgt = Lf[(f[..., 3] >= 128) & cape_mask(Lf, own) & (Lf[..., 0] < RED_L)].mean(0)
    else: tgt = np.array(TARGET)
    d = tgt - L[m].mean(0); L[m] += d
    out = a.copy(); px = out[y0:]; px[m, :3] = rgb(L[m]); return out, tuple(np.round(d, 1))


def run(prev=None):
    names, shots = [], []
    for s in SUFFIXES:
        n = f'{RIG}__body_back{s}'; a = keep(n); o = s.replace('_nh', ''); plain = a if o in OWN else keep(f'{RIG}__body_back{"_nh" if s.endswith("_nh") else ""}')
        fr = RIG + FRONT.get(o, FRONT['']); b, d = tone(hem(a, plain, profile(fr), CAPE_HUE == 'olive' and o not in OWN), CAPE_TOP[o], fr, o in OWN); names.append(n)
        if prev: shots.append(b); continue
        save(b, f'art/gen/{n}.png'); print(n, f'hem from world row {START} {DROP} rows down, cape tone moved by Lab {d}')
    if prev:
        Z = 3; h, w = shots[0].shape[:2]; S = Image.new('RGBA', (w * Z * len(shots), h * Z), (90, 110, 90, 255))
        for i, b in enumerate(shots): S.alpha_composite(Image.fromarray(b).resize((w * Z, h * Z), Image.NEAREST), (i * w * Z, 0))
        S.save(prev); return
    print('python3 tools/prep.py --only ' + ','.join(names))


if __name__ == '__main__':
    (RIG, *more), FRESH = rigarg.take([RIG])
    if more or rigarg.base(RIG) not in ('hero', 'archer'): sys.exit(f'one warrior or archer rig, not {[RIG, *more]}')
    globals().update(RIGCFG.get(rigarg.base(RIG), {}))
    for k in ('SUFFIXES', 'START', 'DROP', 'FOLD', 'HEM0', 'CLOTH_A', 'CLOTH_L', 'ENV', 'EDGE', 'SIDE', 'FLARE', 'INK', 'CAPE_TOP', 'UP', 'FRONT', 'OWN', 'CAPE_HUE', 'RED_A', 'RED_L', 'TARGET'): globals()[k] = rigarg.param(RIG, 'fix_2202', k, globals()[k])
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'preview': run(sys.argv[2])
    elif cmd == 'hem': run()
    else: print(__doc__)
