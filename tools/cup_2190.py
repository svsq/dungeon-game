#!/usr/bin/env python3
"""TASKS 2190: the mage's orb hand redrawn after the orb hand of art/char_refs/mage_a_v4.png, and his staff fist after his staff hand.

The cup (mage__cupL) is the hand under the orb with the end of its sleeve: the sleeve's blue bell with the under-sleeve's two cream
bands coming out of it, a short wrist, the palm a crescent under the orb, four fingers rising along the orb's lower outer edge with
light nails on its face, the thumb's lit heel in front. It is pixelled on cells laid over the reference: mage_a_v4.png mirrored (the
orb is on the screen's left of the body here) and scaled so that its orb's rim matches the arch orb's, cut into the same cells
(refgrid shows both side by side). In the arch (_menu) a cell is the body's own (PIX_M rig px, 2.1 screen px of the arch); in the
world it is a cell of the world grid (h / 42 rig px) and the hand is the small sheet's (mage_a_small_orb_r4.png): a row of light
fingertips on the orb's lower edge, a palm row under it, the wrist down to a pale cuff cell at the body's side. The skin is the
face's own tones (its orange px on mage__body_menu in five bands of lightness; the face cells of mage__body in the world), lit from
the orb: its glow on the cells facing it and the cuff's top, nails between the light skin and the orb's pale blue, a shade of the
skin in the gaps between the fingers, the dark outline only round the outer edge where the canvas is empty off the orb.
The cuff (mage__cuffL) is the forearm (farmL) cut where its sleeve's orange rim starts: the rim, the under-sleeve and the hand were
its end seen end-on (the forearm turned toward the camera), an upright grey block beside the orb; the cup carries them now.
The staff fist (mage__fistR) is pixelled the same way on the body's cell in the face's tones: four finger rolls across the shaft,
each lit on top and shaded under, the thumb across the top, the heel of the palm down the far side; the shaft shows above and below.
  python3 tools/cup_2190.py run            art/gen/mage__{cupL,cuffL,fistR}{,_menu}.png, old ones in art/old/<name>-20261118-2190.png;
                                           prints ORB_CUP for scene_hero.js
  python3 tools/cup_2190.py pair out.png   the arch cup on the arch orb beside mage_a_v4's orb hand at the same orb, at the arch's scale
  python3 tools/cup_2190.py refgrid out.png the arch cup's cells beside the reference cut into the same cells"""
import json, os, shutil, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import fist_2177 as F

RIG, TAG, CELLS = 'mage', '20261118-2190', 42
OUT = os.environ.get('OUT', 'art/gen')
REF, REF_O, REF_R = 'art/char_refs/mage_a_v4.png', (598.0, 335.0), 52.0
# the held orb (scene_hero.js SHIELD.orb, ORB_CUP.menuK): its height in the hero's 84 units, the arch's share of it, and its rim's radius
# in its texture's half width (orb_held_menu: the dark rim 9 of 62 texels in; orb_held: the glow's half-opaque edge 8 of 44)
ORB_H, ORB_MENU, RIM_MENU, RIM_WORLD = 14, 0.84, 53 / 62, 36 / 44
PIX_M = 2.75

# the maps: rows of cells round the orb's centre, the first column at x = X0 (outward, toward the screen's left as the cup is drawn
# facing right) and the first row at y = Y0 (down), a cell (x, y) spanning x .. x + 1 outward and y .. y + 1 down; 1..5 skin darkest to
# lightest, n a nail lit by the orb, c C the under-sleeve's cream light and mid, k its fold, b B d the sleeve's blue light, mid and
# dark, ',' left empty without an outline (between the fingers), '.' empty; ARM: where the forearm meets the cup (cells)
MENU_X0, MENU_Y0, MENU_ARM = 10, 5, (-10.0, 9.0)
MENU = [".........................",
        ".....n...................",
        "..n,,4...n...............",
        ".35,,5,,,5n........bBd...",
        "..34,54,,54.......bbBBd..",
        "...3145415425...bbBBBBd..",
        "....3443444255cbbBBBBd...",
        ".....233444434ccbkBBBd...",
        ".......1233333ccckBBBd...",
        "..........11222kcckBBd...",
        "................kccBBd...",
        ".................kCBd....",
        "..................d.d...."]
WORLD_X0, WORLD_Y0, WORLD_ARM = 3, 2, (-3.5, 3.5)
WORLD = [".n,nn.....",
         ".344453Bd.",
         "..2333cBd.",
         "......Cd.."]
# the staff fist on the body's cell, its middle on the shaft: the thumb across the top (toward the staff's head), four finger rolls,
# the heel of the palm down the right
FIST = ["..34552..",
        ".3444421.",
        ".2222211.",
        "454432211",
        "333222111",
        "454432211",
        "333222111",
        "454432211",
        "333222111",
        ".4433211."]


def oklab(c):
    c = np.asarray(c, float) / 255; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    l, m, s = [np.cbrt(c @ v) for v in ([0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005])]
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def mix(a, b, k): return np.asarray(a, float) * (1 - k) + np.asarray(b, float) * k


def skin_of(px):
    X = oklab(px); C, h = np.hypot(X[:, 1], X[:, 2]), np.degrees(np.arctan2(X[:, 2], X[:, 1]))
    keep = (C > 0.09) & (h > 35) & (h < 75) & (X[:, 0] > 0.45); return px[keep], X[keep]


def face_tones():
    """the skin of the face on the arch's body texture (its orange px; the grey beard and the outline left out): the means of its px in
    five bands of lightness, darkest first"""
    a = F.load(f'art/gen/{RIG}__body_menu.png')[:75]; px, X = skin_of(a[a[..., 3] > 200][:, :3].astype(float))
    q = np.percentile(X[:, 0], [0, 15, 35, 55, 75, 100])
    return np.array([px[(X[:, 0] >= a) & (X[:, 0] <= b)].mean(0) for a, b in zip(q, q[1:])])


def world_tones():
    """the face's own cells on the world body (mage__body), five of them darkest to lightest"""
    a = F.load(f'art/gen/{RIG}__body.png')[:75]; px, X = skin_of(a[a[..., 3] > 200][:, :3].astype(float))
    cols, n = np.unique(px, axis=0, return_counts=True); cols = cols[n >= 20]; cols = cols[np.argsort(oklab(cols)[:, 0])]
    return cols[np.round(np.linspace(0, len(cols) - 1, 5)).astype(int)]


def sleeve_tones(name):
    """the sleeve's blue on the forearm as drawn: dark, mid, light"""
    a = F.load(f'art/gen/{RIG}__{name}.png'); px = a[a[..., 3] > 200][:, :3].astype(float); blue = px[px[:, 2] > px[:, 0] + 30]
    return [blue[np.argsort(blue @ [0.3, 0.59, 0.11])[int(f * (len(blue) - 1))]] for f in (0.15, 0.55, 0.9)]


# the under-sleeve as on mage_a_v4: neutral cream L 67 and its fold L 45 (OKLab 0.76 / 0.51)
CREAM, CREAM_MID, FOLD = [176, 175, 177.], [150, 150, 153.], [103, 102, 106.]
OUTLINE, GLOW, GLOW_K, NAIL = np.array([40, 10, 8.]), np.array([110, 190, 235.]), 0.22, [205, 232, 245]


def tones(world=False):
    sk = world_tones() if world else face_tones(); blue = sleeve_tones('farmL' if world else 'farmL_menu')
    t = {str(i + 1): sk[i] for i in range(5)}
    t.update(n=mix(sk[4], NAIL, 0.7), c=np.array(CREAM), C=np.array(CREAM_MID), k=np.array(FOLD), b=blue[2], B=blue[1], d=blue[0])
    return t


def paint(rows, x0, y0, rc, t):
    """the map in colours, padded by a cell: the outline round it where the canvas is empty off the orb's disc (rc cells), the orb's glow
    on the skin facing it and on the cuff's top; returns the colours and the orb's centre in cells from the padded map's top left"""
    ny, nx = len(rows), len(rows[0]); assert all(len(r) == nx for r in rows), [len(r) for r in rows]
    col = np.zeros((ny + 2, nx + 2, 4)); kind = np.full((ny + 2, nx + 2), '.')
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '.,': col[j + 1, i + 1] = [*t[ch], 255]
            kind[j + 1, i + 1] = ch
    yy, xx = np.mgrid[0:ny + 2, 0:nx + 2]; d = np.hypot(x0 + 1 - xx + 0.5, yy - 1 + y0 + 0.5)
    has = ~np.isin(kind, ['.', ',']); pad = np.pad(has, 1); near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    col[near & (kind == '.') & (d > rc + 0.5)] = [*OUTLINE, 255]
    above = np.vstack([np.ones((1, nx + 2), bool), ~has[:-1]])
    lit = (np.isin(kind, list('12345')) & above & (d < rc * 1.25)) | (np.isin(kind, list('cC')) & above)
    col[lit, :3] = mix(col[lit, :3], GLOW, GLOW_K)
    return col, (x0 + 2, 1 - y0)


def cells_to_tex(col, pix):
    ny, nx = col.shape[:2]; W, H = int(round(nx * pix)), int(round(ny * pix))
    xs = np.minimum((np.arange(W) + 0.5) // pix, nx - 1).astype(int); ys = np.minimum((np.arange(H) + 0.5) // pix, ny - 1).astype(int)
    return col[ys][:, xs].astype(np.uint8)


def cup(R, world):
    """the cup texture and its anchors (fractions of the texture): the orb's centre and where the forearm meets it"""
    u = R['h'] / 84; pix = R['h'] / CELLS if world else PIX_M
    rc = (RIM_WORLD * ORB_H if world else RIM_MENU * ORB_H * ORB_MENU) / 2 * u / pix
    rows, x0, y0, arm = (WORLD, WORLD_X0, WORLD_Y0, WORLD_ARM) if world else (MENU, MENU_X0, MENU_Y0, MENU_ARM)
    col, (ox, oy) = paint(rows, x0, y0, rc, tones(world)); tex = cells_to_tex(col, pix); H, W = tex.shape[:2]
    f = lambda x, y: [round((ox - x) * pix / W, 4), round((oy + y) * pix / H, 4)]
    return tex, {'orb': f(0, 0), 'arm': f(*arm)}


def trim_cut(R):
    """how far along the forearm, elbow to hand, its sleeve's orange rim starts (farmL_menu): the cuff keeps the blue above it"""
    a = F.load(f'art/gen/{RIG}__farmL_menu.png').astype(int); E, Hd = np.array(R['elbowL']), np.array(R['handL']); L = np.linalg.norm(Hd - E); u = (Hd - E) / L
    X = oklab(a[..., :3].reshape(-1, 3)).reshape(a.shape[:2] + (3,)); org = (a[..., 3] > 200) & (np.hypot(X[..., 1], X[..., 2]) > 0.14) & (X[..., 1] > 0.06) & (X[..., 2] > 0.1)
    yy, xx = np.nonzero(org); al = (xx + 0.5 - E[0]) * u[0] + (yy + 0.5 - E[1]) * u[1]
    return float(np.percentile(al, 2)), L


def fist(world_C):
    t = tones(); col, _ = paint(FIST, 0, 0, -9, t); menu = cells_to_tex(col, PIX_M)
    world = F.cells(menu, world_C); wt = tones(True); sk = np.array([t[str(i)] for i in range(1, 6)]); wk = np.array([wt[str(i)] for i in range(1, 6)])
    op = world[..., 3] > 0; px = world[op][:, :3].astype(float); i = np.argmin(((px[:, None] - sk[None]) ** 2).sum(-1), 1)
    near = ((px - sk[i]) ** 2).sum(-1) < 30; px[near] = wk[i[near]]; world[op] = np.concatenate([px, world[op][:, 3:]], 1).astype(np.uint8)
    return menu, world


def backup(names):
    for n in names:
        src, dst = f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png'
        if OUT == 'art/gen' and os.path.exists(src) and not os.path.exists(dst): shutil.copyfile(src, dst)


def build():
    R = F.rigs()[RIG]; names = [f'{RIG}__{p}{m}' for p in ('cupL', 'cuffL', 'fistR') for m in ('', '_menu')]; backup(names)
    out = {}
    for world, m in ((True, ''), (False, '_menu')):
        tex, a = cup(R, world); Image.fromarray(tex).save(f'{OUT}/{RIG}__cupL{m}.png'); out['world' if world else 'menu'] = a
    d, L = trim_cut(R)
    for m in ('', '_menu'):
        src = f'art/old/{RIG}__farmL{m}-{TAG}.png' if os.path.exists(f'art/old/{RIG}__farmL{m}-{TAG}.png') else f'art/gen/{RIG}__farmL{m}.png'
        Image.fromarray(cut_at(F.load(src), R, d)).save(f'{OUT}/{RIG}__cuffL{m}.png')
    menu, world = fist(R['h'] / CELLS)
    Image.fromarray(menu).save(f'{OUT}/{RIG}__fistR_menu.png'); Image.fromarray(world).save(f'{OUT}/{RIG}__fistR.png')
    out['cut'] = round(d / L, 3)
    print('ORB_CUP', json.dumps(out))
    print('python3 tools/prep.py --only ' + ','.join(names))


def cut_at(farm, R, d):
    E, Hd = np.array(R['elbowL']), np.array(R['handL']); u = (Hd - E) / np.linalg.norm(Hd - E)
    yy, xx = np.mgrid[0:farm.shape[0], 0:farm.shape[1]] + 0.5
    out = farm.copy(); out[(xx - E[0]) * u[0] + (yy - E[1]) * u[1] > d] = 0; return out


def pair(out):
    """the arch cup on the arch orb and mage_a_v4's orb hand mirrored and scaled to the same orb, side by side at the arch's screen
    scale (ARCH screen px per rig px) blown up Z times; under them the world cup on the world orb beside the small sheet's, ×Z too"""
    R = F.rigs()[RIG]; u = R['h'] / 84; ARCH, Z = 0.764, 8
    tiles = []
    for world in (False, True):
        tex, a = cup(R, world); c = Image.fromarray(tex); cw, ch = c.size
        od = ORB_H * (1 if world else ORB_MENU) * u; orb = Image.open('live/assets/orb_held%s.png' % ('' if world else '_menu')).convert('RGBA').resize((int(round(od)), int(round(od))), Image.LANCZOS)
        m = 30; O = (m + a['orb'][0] * cw, m + 30 + a['orb'][1] * ch); size = (cw + 2 * m, ch + 2 * m + 30)
        bg = Image.new('RGBA', size, (30, 28, 38, 255)); bg.alpha_composite(orb, (int(round(O[0] - od / 2)), int(round(O[1] - od / 2)))); bg.alpha_composite(c, (m, m + 30))
        if world:
            sm = Image.open('art/char_refs/mage_a_small_orb_r4.png').convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT); k = R['h'] / CELLS
            so = (64 - 42, 27); ref = sm.crop((int(so[0] - O[0] / k), int(so[1] - O[1] / k), int(so[0] - O[0] / k) + int(size[0] / k) + 1, int(so[1] - O[1] / k) + int(size[1] / k) + 1))
            ref = ref.resize((ref.size[0] * round(k), ref.size[1] * round(k)), Image.NEAREST).crop((0, 0) + size); s = 84 / 360 * 2
        else:
            k = RIM_MENU * od / 2 / REF_R; ref = Image.open(REF).convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT); ox = ref.size[0] - REF_O[0]
            box = (ox - O[0] / k, REF_O[1] - O[1] / k); ref = ref.crop((int(round(box[0])), int(round(box[1])), int(round(box[0] + size[0] / k)), int(round(box[1] + size[1] / k)))).resize(size, Image.LANCZOS); s = ARCH
        sz = (round(size[0] * s), round(size[1] * s)); f = Image.NEAREST if world else Image.LANCZOS
        tiles.append([t.resize(sz, f).resize((sz[0] * Z, sz[1] * Z), Image.NEAREST) for t in (bg, ref)])
    W = max(sum(t.size[0] + 10 for t in row) for row in tiles); H = sum(row[0].size[1] + 10 for row in tiles)
    o = Image.new('RGBA', (W, H), (0, 0, 0, 255)); y = 0
    for row in tiles:
        x = 0
        for t in row: o.paste(t, (x, y)); x += t.size[0] + 10
        y += row[0].size[1] + 10
    o.save(out)


def refgrid(out, z=22):
    """the arch cup's cells over the arch orb (cell means of orb_held_menu) beside mage_a_v4 cut into the same cells, labelled"""
    R = F.rigs()[RIG]; u = R['h'] / 84; rc = RIM_MENU * ORB_H * ORB_MENU / 2 * u / PIX_M
    col, (ox, oy) = paint(MENU, MENU_X0, MENU_Y0, rc, tones()); ny, nx = col.shape[:2]
    oa = np.array(Image.open('live/assets/orb_held_menu.png').convert('RGBA')).astype(float); n = 2 * rc / RIM_MENU; N = oa.shape[0]
    a = np.array(Image.open(REF).convert('RGB')).astype(float); cell = REF_R / rc; top = -9
    img = Image.new('RGB', (2 * nx * z + 20, (ny - top - oy) * z), (30, 28, 38)); dr = ImageDraw.Draw(img)
    for j in range(top, ny - oy):
        for i in range(nx):
            x, y = ox - i - 0.5, j + 0.5; c = (30, 28, 38)
            tx, ty, s = (-x / n + 0.5) * N, (y / n + 0.5) * N, N / n
            p = oa[max(0, int(ty - s / 2)):min(N, int(ty + s / 2) + 1), max(0, int(tx - s / 2)):min(N, int(tx + s / 2) + 1)].reshape(-1, 4)
            if len(p) and p[:, 3].mean() > 127: c = tuple(((p[:, :3] * p[:, 3:]).sum(0) / p[:, 3].sum()).astype(int))
            jj = j + oy
            if 0 <= jj < ny and col[jj, i, 3] > 0: c = tuple(col[jj, i, :3].astype(int))
            dr.rectangle([i * z, (j - top) * z, i * z + z - 1, (j - top) * z + z - 1], fill=c)
            rx, ry = REF_O[0] + (x - 0.5) * cell, REF_O[1] + (y - 0.5) * cell
            p = a[int(round(ry)):int(round(ry + cell)), int(round(rx)):int(round(rx + cell))].reshape(-1, 3); X2 = i * z + nx * z + 20
            dr.rectangle([X2, (j - top) * z, X2 + z - 1, (j - top) * z + z - 1], fill=tuple(np.median(p, 0).astype(int)))
    for i in range(nx):
        for X in (i * z + 2, i * z + nx * z + 22): dr.text((X, 2), str(ox - i - 1), fill=(255, 255, 0))
    for j in range(top, ny - oy): dr.text((2, (j - top) * z + z // 3), str(j), fill=(255, 255, 0))
    img.save(out)


if __name__ == '__main__':
    if sys.argv[1:2] == ['run']: build()
    elif sys.argv[1:2] == ['pair']: pair(sys.argv[2])
    elif sys.argv[1:2] == ['refgrid']: refgrid(sys.argv[2])
    else: print(__doc__)
