#!/usr/bin/env python3
"""TASKS 2199 (chars_style_r4.md 1, 2, 5; chars_assets_r4.md 3, 4): the accepted looks «a» polished.
  face    the mage's world head in the hood (mage__body_hd): the grey hair right under the hood's rim goes into the hood's shadow, and the
          near eye gets a dark grey brow, so the face reads at 36 px (facefeat.py: dark features 27 in the cloak against 69 bare-headed)
  olive   the archer's world mantle (body, body_nh) takes the cells the arch's drawing has olive and the world's grid lost (the collar
          and the near shoulder), in the world's own olive of the cells beside them; the cloak outfit keeps none (decision 2166)
  string  the string painted on the bow icons (it_bow_s, it_bow_l) to the grey of the string the code draws in the hand (2184), shading kept
  hair    the mage's hair under the circlet from behind (mage__head_back_ci): the hair px warmer than the bare head's back moved to its
          a, b (lightness kept); runs after fix_2193.py hair
  edge    the arch torsos of the mage's leather and hood (mage__body_le_menu, mage__body_hd_menu): the near-black outline of the pauldron
          and the mantle beside the near sleeve (the texels exposed_r4.cjs counts) lifted to a dark shade of the cloth; alpha untouched
Every source is kept once as art/old/<name>-20261118-2199.png and each run starts from it.
  python3 tools/fix_2199.py face|olive|string|hair|edge   (then the printed prep line)
  --rig R: a new look (its numbers from art/look_params.json, else its class's); --fresh: the frozen 2199 copies made again"""
import os, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G
import rigarg

TAG = '20261118-2199'
RIG, FRESH = None, False
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)
keep = lambda n: load(rigarg.frozen(n, TAG, FRESH))
to8 = lambda lab: np.clip(np.round(G.srgb(lab)), 0, 255).astype(np.uint8)


def cells(a):
    h, w = a.shape[:2]; _, W, cy, cx = G.grid(h, w)
    return np.broadcast_to(cy[:, None], (h, w)), np.broadcast_to(cx[None, :], (h, w))


def cielab_L(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    Y = c @ np.array([0.2126, 0.7152, 0.0722]); return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)


# (row, columns) of the grid 42 cells: RIM the hair row under the hood's rim (fix_2184.py FACE's top row, the side lock kept), BROW the
# cells over the near eye (row 6, column 12) and its outer end. SHADE is fix_2184.py's hood shadow, BROW_L about CIELab 26 (dark
# enough to read as a brow under a lit hood, grey as his hair and beard, not the near-black of an outline)
RIM = (2, 9, 13)
BROW = (5, 12, 13)
SHADE, BROW_L, HOOD_ROWS = 0.27, 0.36, 12
def face():
    n = f'{RIG}__body_hd'; a = keep(n); cy, cx = cells(a); lab = G.oklab(a[..., :3].astype(float)); op = a[..., 3] >= 128
    C = np.hypot(lab[..., 1], lab[..., 2])
    hood = op & (cy < HOOD_ROWS) & (cy < RIM[0]) & (lab[..., 0] > 0.3) & (C > 0.03)
    tone = np.median(lab[hood], 0); tone[0] = SHADE
    grey = op & (cy < HOOD_ROWS) & (C < 0.03) & (lab[..., 0] > 0.4)
    hair = np.median(lab[grey], 0); hair[0] = BROW_L
    out = a.copy()
    rim = op & (cy == RIM[0]) & (cx >= RIM[1]) & (cx <= RIM[2]); out[..., :3][rim] = to8(tone)
    brow = op & (cy == BROW[0]) & (cx >= BROW[1]) & (cx <= BROW[2]); out[..., :3][brow] = to8(hair)
    save(out, f'art/gen/{n}.png'); print(n, 'rim px', int(rim.sum()), 'brow px', int(brow.sum()))
    print('python3 tools/prep.py --only ' + n)


OLIVE = ['body', 'body_nh']
# a cell counts as olive when half its opaque px are (fix_2184.py olive's rule); the world's olive tone is the median of the olive
# cells within NEAR cells of it, else of the whole part
NEAR = 2
def green(a):
    lab = G.oklab(a[..., :3].astype(float)); C = np.hypot(lab[..., 1], lab[..., 2]); hue = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
    return (a[..., 3] >= 128) & (C > 0.04) & (hue > 100) & (hue < 140) & (lab[..., 0] < 0.6)
def olive():
    names = []
    for part in OLIVE:
        n = f'{RIG}__{part}'; a = keep(n); ref = load(f'art/gen/{n}_menu.png')
        ref = np.array(Image.fromarray(ref).resize(a.shape[1::-1], Image.BOX))
        cy, cx = cells(a); op = a[..., 3] >= 128; gw, gm = green(a), green(ref); W = int(cx.max()) + 1
        share = lambda m, r, c: (m & (cy == r) & (cx == c)).sum() / max(1, (op & (cy == r) & (cx == c)).sum())
        olv = {(r, c) for r in range(42) for c in range(W) if share(gw, r, c) >= 0.5}
        add = [(r, c) for r in range(42) for c in range(W) if (op & (cy == r) & (cx == c)).any() and (r, c) not in olv and share(gm, r, c) >= 0.5]
        out = a.copy(); every = a[..., :3][gw].astype(float)
        for r, c in add:
            near = np.zeros(op.shape, bool)
            for rr, cc in olv:
                if abs(rr - r) <= NEAR and abs(cc - c) <= NEAR: near |= (cy == rr) & (cx == cc)
            px = a[..., :3][near & gw].astype(float)
            out[..., :3][op & (cy == r) & (cx == c)] = np.round(np.median(px if len(px) else every, 0)).astype(np.uint8)
        save(out, f'art/gen/{n}.png'); names.append(n); print(n, 'cells', add)
    print('python3 tools/prep.py --only ' + ','.join(names))


# the painted string: the long thin limb left when an opening of radius THIN takes the stave away (the string with its outline is
# about 6–10 px across, the staves 18–35); its light px (OKLab L over LIGHT) go to the code's string grey, their spread halved
BOWS = {'it_bow_s': 9.5, 'it_bow_l': 7.5}
STRING = (0.5, 0.48, 0.45)
LIGHT = 0.45
def string():
    from scipy import ndimage as nd
    for n, r in BOWS.items():
        a = keep(n); op = a[..., 3] >= 128; R = int(r); disk = np.hypot(*np.mgrid[-R:R + 1, -R:R + 1]) <= r
        thin = op & ~nd.binary_dilation(nd.binary_erosion(op, disk), disk)
        lab_, k = nd.label(thin, np.ones((3, 3))); big = 1 + int(np.argmax(nd.sum(thin, lab_, range(1, k + 1))))
        lab = G.oklab(a[..., :3].astype(float)); m = (lab_ == big) & (lab[..., 0] > LIGHT)
        goal = G.oklab(np.array(STRING) * 255.0); mid = np.median(lab[m][:, 0])
        new = lab[m].copy(); new[:, 0] = goal[0] + (new[:, 0] - mid) * 0.5; new[:, 1:] = goal[1:]
        out = a.copy(); out[..., :3][m] = to8(new); save(out, f'art/gen/{n}.png')
        print(f'{n}: {int(m.sum())} string px, OKLab L {mid:.2f} -> {goal[0]:.2f}')
    print('python3 tools/prep.py --only ' + ','.join(BOWS))


# the hair as tools/measure/chars_assets/backhead.py takes it: light (CIELab L over 45) low-chroma px of the head rows, the circlet's
# band (chroma over CIRCLET) and a px round it left out; a hair px further than OFF (ΔE in a, b) from the bare head's mean goes to it
HAIR_ROWS, CIRCLET, OFF = 40, 0.075, 1.5
def hair_mask(a):
    from scipy import ndimage as nd
    lab = G.oklab(a[..., :3].astype(float)); op = a[..., 3] >= 128; band = op & (np.hypot(lab[..., 1], lab[..., 2]) >= CIRCLET)
    m = op & ~nd.binary_dilation(band) & (cielab_L(a[..., :3].astype(float)) > 45); m[HAIR_ROWS:] = False
    return m
def hair():
    sys.path.insert(0, 'tools/measure/fix2193'); from hair import lab as cie
    n = f'{RIG}__head_back_ci'; a = keep(n); ref = load(f'art/gen/{RIG}__body_back.png')
    goal = cie(ref[..., :3].astype(float))[hair_mask(ref)].mean(0)
    L = cie(a[..., :3].astype(float)); m = hair_mask(a); off = m & (np.hypot(L[..., 1] - goal[1], L[..., 2] - goal[2]) > OFF)
    lab = G.oklab(a[..., :3].astype(float)); g = G.oklab(cie_to_rgb(*goal))
    new = lab[off].copy(); new[:, 1:] = g[1:]
    out = a.copy(); out[..., :3][off] = to8(new); save(out, f'art/gen/{n}.png')
    print(f'{n}: {int(m.sum())} hair px, {int(off.sum())} moved to the bare head a, b {goal[1:].round(1)}')
    print('python3 tools/prep.py --only ' + n)
def cie_to_rgb(L, A, B):
    fy = (L + 16) / 116; fx, fz = fy + A / 500, fy - B / 200
    f = lambda t: t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787
    xyz = np.array([f(fx) * 0.9505, f(fy), f(fz) * 1.089])
    lin = np.linalg.solve(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]), xyz)
    return np.clip(np.where(lin > 0.0031308, 1.055 * np.clip(lin, 0, None) ** (1 / 2.4) - 0.055, 12.92 * lin), 0, 1) * 255


# the torso texels exposed_r4.cjs counts as dark beside the near sleeve over the arch's rest poses (staff, wand, orb) before this step,
# as tools/measure/chars_assets/exposed_uv.cjs --uv wrote them (exposed_uv_2199.json), a px round them taken too: their dark px (CIELab L
# under 22, the measure's) go to EDGE_L (about CIELab 26) in the hue of the cloth round them at EDGE_C of its chroma, a shade still darker
# than the cloth. The silhouette's own outline (dark px within EDGE_OUT of the transparent) and the alpha stay
EDGE = ['mage__body_le_menu', 'mage__body_hd_menu']
EDGE_UV = 'tools/measure/chars_assets/exposed_uv_2199.json'
EDGE_L, EDGE_C, EDGE_NEAR, EDGE_OUT = 0.36, 0.7, 3, 2
def edge():
    import json
    from scipy import ndimage as nd
    hits = json.load(open(EDGE_UV)); names = []
    for n0 in EDGE:
        n = n0.replace('mage__', f'{RIG}__', 1); a = keep(n); op = a[..., 3] >= 128
        hit = np.zeros(op.shape, bool)
        for k in hits:
            t, uv = k.split(' ')
            if t == n0: u, v = map(int, uv.split(',')); hit[v, u] = True
        lab = G.oklab(a[..., :3].astype(float)); dark = op & (cielab_L(a[..., :3].astype(float)) < 22)
        m = dark & nd.binary_dilation(hit) & ~nd.binary_dilation(~op, iterations=EDGE_OUT)
        cloth = op & ~dark; k = np.ones((2 * EDGE_NEAR + 1,) * 2)
        cnt = nd.convolve(cloth.astype(float), k, mode='constant')
        mean = np.stack([nd.convolve(lab[..., i] * cloth, k, mode='constant') for i in (1, 2)], -1) / np.maximum(cnt, 1)[..., None]
        m &= cnt > 0
        new = lab[m].copy(); new[:, 0] = np.maximum(new[:, 0], EDGE_L); new[:, 1:] = mean[m] * EDGE_C
        out = a.copy(); out[..., :3][m] = to8(new); save(out, f'art/gen/{n}.png'); names.append(n); print(n, 'px', int(m.sum()))
    print('python3 tools/prep.py --only ' + ','.join(names))


STEPS = {'face': ('mage', face), 'olive': ('archer', olive), 'string': (None, string), 'hair': ('mage', hair), 'edge': ('mage', edge)}
if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd not in STEPS: sys.exit(__doc__)
    cls, fn = STEPS[cmd]; rigs, FRESH = rigarg.take([cls] if cls else [])
    if cls:
        (RIG, *more) = rigs
        if more or rigarg.base(RIG) != cls: sys.exit(f'one {cls} rig, not {rigs}')
        for k in ('RIM', 'BROW', 'SHADE', 'BROW_L', 'OLIVE', 'NEAR', 'HAIR_ROWS', 'OFF', 'EDGE'): globals()[k] = rigarg.param(RIG, 'fix_2199', k, globals()[k])
    elif rigs: sys.exit('string: the bows belong to no rig')
    fn()
