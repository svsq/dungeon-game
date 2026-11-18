#!/usr/bin/env python3
"""TASKS 2204: the mage's weapon arm (the far arm R, screen-right facing right) read as a prosthesis (author, frame 36; critics r5 item 11).

Causes, as the critics measured them: the upper arm (<rig>__uarmR<sfx>) lies under the torso and shows only as a strip along its edge,
and that strip was its outer shading and outline (90-100 % px under L* 22), so the joint read as a 3 px dark seam between two parts;
its blue sat L* 6-7 under the torso's (ΔE 7.6-10 in the arch); the forearm (<rig>__cuffR, 2177/2200) was 10 px of sleeve at the elbow,
its rim, then a pale grey funnel as big as the fist (130 px with the staff), and only the funnel showed between the torso and the fist.

  uarm  the upper arms (robe, leather, cloak; arch and world): the sleeve's blue px in CIELab moved onto the robe's blue beside the
        far shoulder (BODY_WIN of the plain robe's body), their shading kept at SHADE of its spread: only the sleeve's shaded outer side
        shows beside the torso, and at its full spread that strip stayed L* 4 and ΔE 6 under the robe. The outline stays only where the
        sleeve meets the empty canvas on its outer (screen) side, one px (in the world one cell, and the world's sleeve a cell wider:
        widen()); the sleeve's other dark px and its outline toward the torso take the cloth beside them. A pad or hood over the sleeve
        (leather, cloak) keeps its colours and its own lines (dark px touching its cloth), only its outline toward the torso goes.
  cuff  the forearm (one for all outfits) repainted along its own axis, in the arch's cells (cup_2190.PIX_M) and the world's (h / 42):
        the robe's blue from above the elbow to the rim, a bell flaring from SLEEVE[0] to SLEEVE[1] px on its outer side; the orange rim
        one cell; under it two narrow bands of the under-sleeve (cream and its mid, cup_2190), BAND px either side of the axis, to BANDS_END
        px along it, where the fist covers it in the staff's rest. In the world one band (cells are 2 world px). The outline only on the
        outer side: the upper side runs into the upper arm under the torso, and the hand's end into the fist. In the world none: a cell
        of outline is 2 px, as wide as the sleeve that shows, and turned with the raised wand it lay under the fist as a dark wedge.
  body  the world torsos' outline cell beside the upper arm (body() below).
  every mode takes --rig R (a mage look) and --fresh, as tools/rigarg.py says
  python3 tools/fix_2204.py run              all three; old textures in art/old/<name>-20261119-2204.png; prints the prep line
  python3 tools/fix_2204.py uarm|cuff|body   one part
  python3 tools/fix_2204.py sheet out.png    the new textures ×6 beside the old
After gridify_2155.py or fix_2194.py run over the mage's bodies or arms, run this again with --fresh (its sources are frozen here)."""
import os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import cup_2190 as C
import fist_2177 as F
import rigarg

TAG, CELLS = '20261119-2204', 42
FRESH = False
OUT = os.environ.get('OUT', 'art/gen')
OUTFITS = ['', '_le', '_hd']
# the robe's blue round the far shoulder: body px within these rig px of shR (x toward the body's centre, y down), its blue only
BODY_WIN, DARK_L = ((-25, 0), (-25, 25)), 22.0
SHADE = 0.35
# the forearm along its axis from the elbow (rig px): the sleeve from SLEEVE_TOP, its half width on the outer side SLEEVE[0] at the
# elbow to SLEEVE[1] at the rim (the bell), INNER on the upper side; the bands end BANDS_END px along: in the arch the fist's edge in
# the staff's rest; in the world (a cell is 2 world px) under the fist, the rim at its edge, as mage_a_small_orb_r4 draws the staff hand
SLEEVE_TOP, SLEEVE, INNER, BAND, BANDS_END = -6.0, (17.0, 20.0), 14.0, (10.0, 8.0), {'_menu': 27.0, '': 35.0}
RIM = (255, 137, 18)
WORLD_DIM = 0.8


def lab(c):
    c = np.asarray(c, float) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    X = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.95047, 1, 1.08883]
    f = np.where(X > 0.008856, np.cbrt(X), 7.787 * X + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_inv(L):
    L = np.asarray(L, float); fy = (L[..., 0] + 16) / 116; fx = fy + L[..., 1] / 500; fz = fy - L[..., 2] / 200
    g = lambda t: np.where(t ** 3 > 0.008856, t ** 3, (t - 16 / 116) / 7.787)
    X = np.stack([g(fx) * 0.95047, g(fy), g(fz) * 1.08883], -1)
    c = X @ np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])).T
    c = np.clip(c, 0, 1); return np.clip(np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c) * 255, 0, 255)


def backup(n):
    src, dst = f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png'
    if OUT == 'art/gen' and os.path.exists(src) and (FRESH or not os.path.exists(dst)): shutil.copyfile(src, dst)


def source(n):
    old = f'art/old/{n}-{TAG}.png'
    return old if os.path.exists(old) and not FRESH else f'art/gen/{n}.png'


def save(a, n):
    backup(n); Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'{OUT}/{n}.png'); return n


def is_blue(px): return (px[..., 3] > 127) & (px[..., 2].astype(int) > px[..., 0].astype(int) + 30)


def robe_blue(rig, m):
    """CIELab mean of the plain robe's blue round the far shoulder (BODY_WIN)"""
    R = F.rigs()[rig]; S = np.array(R['shR']); b = F.load(source(f'{rig}__body{m}')); H, W = b.shape[:2]; yy, xx = np.mgrid[0:H, 0:W] + 0.5
    win = (xx - S[0] >= BODY_WIN[0][0]) & (xx - S[0] <= BODY_WIN[0][1]) & (yy - S[1] >= BODY_WIN[1][0]) & (yy - S[1] <= BODY_WIN[1][1])
    sel = win & is_blue(b); X = lab(b[..., :3][sel]); X = X[X[:, 0] >= 20]
    return X.mean(0)


def cells(a, pix):
    """the world texture as its grid of cells (colour at each cell's middle) and back"""
    ny, nx = int(np.ceil(a.shape[0] / pix)), int(np.ceil(a.shape[1] / pix))
    ys = np.minimum(((np.arange(ny) + 0.5) * pix).astype(int), a.shape[0] - 1); xs = np.minimum(((np.arange(nx) + 0.5) * pix).astype(int), a.shape[1] - 1)
    return a[ys][:, xs].astype(float)


def uncells(col, pix, shape):
    ys = np.minimum((np.arange(shape[0]) // pix).astype(int), col.shape[0] - 1); xs = np.minimum((np.arange(shape[1]) // pix).astype(int), col.shape[1] - 1)
    return col[ys][:, xs]


def sleeve_fix(a, T, axis_x):
    """a (rows × cols × RGBA, a px or a cell each): blue moved onto T, dark px kept only on the outer silhouette, one deep"""
    a = a.astype(float); op = a[..., 3] > 127; X = lab(a[..., :3]); blue = is_blue(a)
    if blue.any():
        M = X[blue].mean(0); Y = X.copy(); Y[..., 0] = T[0] + (X[..., 0] - M[0]) * SHADE; Y[..., 1:] = T[1:] + (X[..., 1:] - M[1:]) * SHADE
        a[blue, :3] = lab_inv(Y[blue])
    dark = op & ~blue & (X[..., 0] < DARK_L)
    pad = np.pad(op, 1); empty_nb = ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    xx = np.arange(a.shape[1])[None, :].repeat(a.shape[0], 0)
    keep = dark & empty_nb & (xx >= axis_x)
    near = lambda m, r: np.pad(m, r)[2 * r:, r:-r] | np.pad(m, r)[:-2 * r, r:-r] | np.pad(m, r)[r:-r, 2 * r:] | np.pad(m, r)[r:-r, :-2 * r] | m
    cloth = op & ~dark
    lost = dark & ~keep & (~near(cloth & ~blue, 1) | (empty_nb & (xx < axis_x)))
    for y, x in zip(*np.nonzero(lost)):
        row = np.nonzero(cloth[y])[0]
        if len(row): a[y, x, :3] = a[y, row[np.argmin(np.abs(row - x))], :3]
        else:
            ys, xs = np.nonzero(cloth)
            if len(ys): k = np.argmin((ys - y) ** 2 + (xs - x) ** 2); a[y, x, :3] = a[ys[k], xs[k], :3]
    return a


def widen(col, axis_x, blue_to=None):
    """the world sleeve one cell wider on its outer side: its outline cell takes the cloth beside it and the outline moves out a cell.
    gridify_2155 voted the arch's sleeve (to x 160) into cells ending a cell short (x 154), so beside the torso only the outline cell
    showed: 0.6-0.7 of the upper arm shown was dark. The new cell is the robe's blue (blue_to): it is most of what shows"""
    col = col.copy(); op = col[..., 3] > 127; dark = op & (lab(col[..., :3])[..., 0] < DARK_L)
    for j in range(col.shape[0]):
        xs = np.nonzero(op[j])[0]
        if not len(xs): continue
        r = xs.max()
        if r < axis_x or r + 1 >= col.shape[1] or not dark[j, r] or not op[j, r - 1] or dark[j, r - 1]: continue
        col[j, r + 1] = col[j, r]; col[j, r] = col[j, r - 1] if blue_to is None else [*blue_to, 255]
    return col


def uarm(rig):
    R = F.rigs()[rig]; S = np.array(R['shR']); pix_w = R['h'] / CELLS; names = []
    for sfx in OUTFITS:
        for m in ('_menu', ''):
            n = f'{rig}__uarmR{sfx}{m}'
            if not os.path.exists(source(n)): continue
            a = F.load(source(n)).astype(float); T = robe_blue(rig, m)
            if m: out = sleeve_fix(a, T, S[0])
            else:
                col = widen(sleeve_fix(cells(a, pix_w), T, S[0] / pix_w - 0.5), S[0] / pix_w - 0.5, lab_inv(T)); out = uncells(col, pix_w, a.shape[:2])
                out[..., 3] = np.maximum(a[..., 3], out[..., 3])
            names.append(save(out, n))
    return names


def body(rig):
    """the world torsos' own outline cell on their far edge, from the shoulder to the elbow, where the upper arm (at rest, as cut) lies
    in the next cell out: it takes the cloth beside it in its row, so the torso runs into the sleeve. In the world a cell is 2 px, and
    that cell with the sleeve's was the 1.6-2 px seam left after the sleeve's own went; the arch's torso outline is under a px"""
    R = F.rigs()[rig]; pix = R['h'] / CELLS; S, E = np.array(R['shR']), np.array(R['elbowR']); names = []
    for sfx in OUTFITS:
        u = cells(F.load(f'art/gen/{rig}__uarmR{sfx}.png'), pix)[..., 3] > 127
        for nh in ('', '_nh'):
            n = f'{rig}__body{sfx}{nh}'
            if not os.path.exists(source(n)): continue
            a = F.load(source(n)).astype(float); col = cells(a, pix); op = col[..., 3] > 127; L = lab(col[..., :3])[..., 0]
            for j in range(int(S[1] // pix), int(E[1] // pix) + 1):
                xs = np.nonzero(op[j])[0]
                if not len(xs): continue
                r = xs.max()
                if r + 1 >= col.shape[1] or not u[j, r + 1] or L[j, r] >= DARK_L: continue
                cl = [i for i in xs[::-1] if L[j, i] >= DARK_L and i < r]
                if cl: col[j, r, :3] = col[j, cl[0], :3]
            out = uncells(col, pix, a.shape[:2]); out[..., 3] = a[..., 3]
            names.append(save(out, n))
    return names


def cuff(rig):
    """the forearm along its axis, in cells of pix rig px (see the module's doc)"""
    R = F.rigs()[rig]; E, Hd = np.array(R['elbowR']), np.array(R['handR']); Ln = np.linalg.norm(Hd - E); u = (Hd - E) / Ln
    names = []
    for m, pix in (('_menu', C.PIX_M), ('', R['h'] / CELLS)):
        old = F.load(source(f'{rig}__cuffR{m}')); H, W = old.shape[:2]; T = robe_blue(rig, m)
        tone = lambda dL: lab_inv(np.array([T[0] + dL, T[1], T[2]]))
        yy, xx = np.mgrid[0:H, 0:W] + 0.5; cy, cx = (np.floor(yy / pix) + 0.5) * pix, (np.floor(xx / pix) + 0.5) * pix
        al = (cx - E[0]) * u[0] + (cy - E[1]) * u[1]; ac = (cx - E[0]) * u[1] - (cy - E[1]) * u[0]
        world = m == ''
        nb = 1 if world else 2
        end = BANDS_END[m]; b0 = end - nb * pix; rim0 = b0 - pix
        k = np.clip((al - SLEEVE_TOP) / max(1.0, rim0 - SLEEVE_TOP), 0, 1); hw_out = SLEEVE[0] + (SLEEVE[1] - SLEEVE[0]) * k
        sleeve = (al >= SLEEVE_TOP) & (al < rim0) & (ac >= -hw_out) & (ac <= INNER)
        rim = (al >= rim0) & (al < b0) & (ac >= -SLEEVE[1]) & (ac <= INNER)
        band = (al >= b0) & (al < end) & (ac >= -BAND[0]) & (ac <= BAND[1])
        out = np.zeros((H, W, 4))
        out[sleeve] = [*tone(0), 255]
        out[sleeve & (ac < -hw_out * 0.55)] = [*tone(-4), 255]
        out[sleeve & (ac > INNER * 0.4)] = [*tone(3), 255]
        out[rim] = [*(np.array(RIM) * (WORLD_DIM if world else 1)), 255]
        dim = WORLD_DIM if world else 1
        bi = np.floor((al - b0) / pix).astype(int)
        out[band & (bi == 0)] = [*(np.array(C.CREAM_MID if world else C.CREAM) * dim), 255]
        out[band & (bi >= 1)] = [*(np.array(C.CREAM_MID) * dim), 255]
        has = out[..., 3] > 0; pad = np.pad(has, 1); nbr = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        ring = nbr & ~has & (ac < 0) & (al > SLEEVE_TOP) & (al < end)
        ck = np.floor(yy / pix) * 1000 + np.floor(xx / pix); ring = np.isin(ck, np.unique(ck[ring])) & ~has
        if not world: out[ring] = [*C.OUTLINE, 255]
        names.append(save(out, f'{rig}__cuffR{m}'))
    return names


def sheet(out, rigs):
    tiles = []
    for rig in rigs:
        for n in [f'{rig}__uarmR{s}{m}' for s in OUTFITS for m in ('_menu', '')] + [f'{rig}__cuffR_menu', f'{rig}__cuffR']:
            for p in (f'art/old/{n}-{TAG}.png', f'{OUT}/{n}.png'):
                if not os.path.exists(p): continue
                im = Image.open(p).convert('RGBA').crop((100, 70, 165, 200)); bg = Image.new('RGBA', im.size, (30, 60, 30, 255)); bg.alpha_composite(im)
                tiles.append(bg.resize((im.size[0] * 6, im.size[1] * 6), Image.NEAREST))
    o = Image.new('RGBA', (sum(t.size[0] + 8 for t in tiles), max(t.size[1] for t in tiles)), (0, 0, 0, 255)); x = 0
    for t in tiles: o.paste(t, (x, 0)); x += t.size[0] + 8
    o.save(out)


if __name__ == '__main__':
    rigs, FRESH = rigarg.take(['mage'])
    for r in rigs:
        if rigarg.base(r) != 'mage': sys.exit(f'{r}: fix_2204 is for the mage')
    mode = sys.argv[1:2]
    names = []
    if mode in (['run'], ['uarm']): names += [n for r in rigs for n in uarm(r)]
    if mode in (['run'], ['cuff']): names += [n for r in rigs for n in cuff(r)]
    if mode in (['run'], ['body']): names += [n for r in rigs for n in body(r)]
    if mode == ['sheet']: sheet(sys.argv[2], rigs)
    elif names: print('python3 tools/prep.py --only ' + ','.join(names))
    else: print(__doc__)
