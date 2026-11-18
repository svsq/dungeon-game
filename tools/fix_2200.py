#!/usr/bin/env python3
"""TASKS 2200: the hands of the accepted looks at the world's size, the mage's staff cuff and his orb hand's wrist in the arch.

World fists (<rig>__fistR<sfx>.png, the 84 px hero, 3 × 4 cells of the world grid h / 42): fist_2177 painted them as its arch fist voted
into cells, a 2 × 3 block of one glove tone with no fingers. Now each is pixelled on the grid itself (FIST_W): the thumb over the shaft
lit at the top with the notch of the empty cell on the knuckles' side beside it, two finger rows with their knuckles lit, parted by a
row of the glove's (or skin's) shadow one step darker, the heel of the palm shaded down the far side; 4 cells tall, so the weapon shows
above and below it. Glove tones are the arch fist's own (fist_2177.palette); the thumb's light is its lightest lifted to HI_L, as the
sheets light a knuckle (warrior_a_small_r4: glove L 40, its light 68). The mage's are the face's world cells (cup_2190.world_tones).
The orb cup (mage__cupL): in the world the fingertips are the light nails a step over the palm, the palm row one step darker than it
was (under the brazier's warm light both read as one orange row); in the arch the under-sleeve starts a row lower and the wrist's skin
is shorter, so the wrist goes down into the cuff at 20–25° (the menu critic's recipe) instead of 18°.
The staff cuff (mage__cuffR, _menu): farmR's sleeve end came down to a grey-pink under-sleeve cut straight (OKLab ≈ 54 / +13 / +9) where
the sheet's is pale and neutral with folds (≈ 67 / 0 / −1). It is repainted from the sleeve's orange rim down, on the body's cell in the
arch (cup_2190.PIX_M) and the world grid in the world: the sleeve's bell cut on a slant (lower on the outer side), its rim, the bell's
dark inside, and the under-sleeve narrower out of it in two cream bands with a fold between them, slanted with the cut, as far as the
fist (fist_2177.CUT short of the hand). One forearm serves every outfit.
  every mode takes --rig R (a mage look for cup/cuff, any look for fists) and --fresh, as tools/rigarg.py says
  python3 tools/fix_2200.py run              all of it; old textures in art/old/<name>-20261118-2200.png; prints the prep line
  python3 tools/fix_2200.py fists|cup|cuff   one part
  python3 tools/fix_2200.py sheet out.png    the new textures ×8, world fists on a shaft"""
import os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import cup_2190 as C
import fist_2177 as F
import rigarg

TAG, CELLS = '20261118-2200', 42
FRESH = False
OUT = os.environ.get('OUT', 'art/gen')

# the world fist, 3 × 4 cells with the shaft under the middle column: 0..4 the hand's tones darkest to lightest, h the thumb's light,
# '.' empty (the notch; the weapon or what is behind shows there). A glove's tone 1 is its outline again (fist_2177.palette), so its
# fingers part on tone 2; the skin's five are close (L 66–79 but the first, 50), so the mage's part on tone 0, as the sheet's bd622a.
# The mage's thumb is a knob with a notch either side: his fist sits on the crooked shaft 2 px off the staff's straight axis
# (POLE.across), and one notch moved its middle past heroFistCheck's 2 px
FIST_W = {'glove': [".h3",
                    "432",
                    "222",
                    "432"],
          'skin': [".h.",
                   "431",
                   "001",
                   "431"]}
HI_L = 0.62
# the world cup (cup_2190.WORLD): n the light nails (L 87), the palm row a step under them (66 against 74 before), its shade row a step
# under the palm (50)
CUP_WORLD = [".n,nn.....",
             ".222222Bd.",
             "..1112cBd.",
             "......Cd.."]
CUP_MENU_ROWS = {6: "....3443444255bbbBBBBd...", 7: ".....233444434bbbkBBBd...", 9: "..........1122kcckBBd...."}
# the cuff under the staff fist: the sleeve and its orange rim stay as drawn (a bell, its rim lower on the outer side); under it the
# under-sleeve is a funnel from FUNNEL[0] px either side of the forearm's line at the rim to FUNNEL[1] at the fist, its folds arcs bowed
# toward the elbow, as on mage_a_v4 (BOW px per px² across) and slanted (SLANT along per px across): FOLDS bands of PERIOD cells, cream and its mid in
# turn, each opened by a fold one cell deep in every column it crosses (cut by rows of cells the arcs broke into dashes)
# WORLD_DIM: the world's cream darker, or under the brazier's warm light its one or two cells beside the fist burnt to white
WORLD_DIM = 0.8
FUNNEL, BOW, SLANT, PERIOD, FOLDS = (13.0, 9.0), 0.015, 0.1, 3, 4


def lab_inv(X):
    X = np.asarray(X, float); l_, m_, s_ = (X @ np.array([[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]]).T).T ** 3
    c = np.stack([4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_], -1)
    c = np.clip(c, 0, 1); return np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c) * 255


def lift(c, L):
    X = C.oklab(np.asarray(c, float)[None])[0]; X[0] = L; X[1:] *= 0.85; return lab_inv(X)


def backup(n):
    src, dst = f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png'
    if OUT == 'art/gen' and os.path.exists(src) and (FRESH or not os.path.exists(dst)): shutil.copyfile(src, dst)


def source(n):
    old = f'art/old/{n}-{TAG}.png'
    return old if os.path.exists(old) and not FRESH else f'art/gen/{n}.png'


def save(a, n):
    backup(n); Image.fromarray(a.astype(np.uint8)).save(f'{OUT}/{n}.png'); return n


def paint_cells(rows, tones, pix):
    ny, nx = len(rows), len(rows[0]); assert all(len(r) == nx for r in rows), rows
    col = np.zeros((ny, nx, 4))
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in tones: col[j, i] = [*tones[ch], 255]
    return C.cells_to_tex(col, pix)


def fist_tones(rig, sfx):
    if rigarg.base(rig) == 'mage':
        C.RIG = rig; sk = C.world_tones(); t = {str(i): sk[i] for i in range(5)}
    else:
        kit = F.KITS[rigarg.base(rig)]; pal = F.palette(*kit['pal'](rig, sfx)); t = {str(i): pal[i] for i in range(5)}
    t['h'] = lift(t['4'], max(HI_L, C.oklab(np.asarray(t['4'], float)[None])[0][0] + 0.08)); return t


def fists(rigs):
    names = []
    for rig in rigs:
        kit = F.KITS[rigarg.base(rig)]; pix = F.rigs()[rig]['h'] / CELLS
        for sfx in kit['sfx']:
            names.append(save(paint_cells(FIST_W['skin' if rigarg.base(rig) == 'mage' else 'glove'], fist_tones(rig, sfx), pix), f'{rig}__fistR{sfx}'))
    return names


def cup(rig):
    C.RIG = rig; R = F.rigs()[rig]; C.WORLD = CUP_WORLD
    for k, s in CUP_MENU_ROWS.items(): C.MENU[k] = s
    names, out = [], {}
    for world, m in ((True, ''), (False, '_menu')):
        tex, a = C.cup(R, world); names.append(save(tex, f'{rig}__cupL{m}')); out['world' if world else 'menu'] = a
    print('ORB_CUP anchors (scene_hero.js must match)', out)
    return names


def cuff(rig):
    """the staff forearm's under-sleeve repainted under its rim, in cells of pix rig px (see FUNNEL)"""
    C.RIG = rig; R = F.rigs()[rig]; E, Hd = np.array(R['elbowR']), np.array(R['handR']); Ln = np.linalg.norm(Hd - E); u = (Hd - E) / Ln
    geo = F.load(source(f'{rig}__farmR_menu')).astype(int); X = C.oklab(geo[..., :3].reshape(-1, 3)).reshape(geo.shape[:2] + (3,))
    org = (np.hypot(X[..., 1], X[..., 2]) > 0.14) & (X[..., 1] > 0.06) & (X[..., 2] > 0.1)
    sleeve = (geo[..., 3] > 200) & ((geo[..., 2] > geo[..., 0] + 30) | org)
    H, W = geo.shape[:2]; yy, xx = np.mgrid[0:H, 0:W] + 0.5
    near_hand = (xx - E[0]) * u[0] + (yy - E[1]) * u[1] < Ln * 0.6
    rim_y = np.array([yy[:, x][sleeve[:, x] & near_hand[:, x]].max() if (sleeve[:, x] & near_hand[:, x]).any() else -1 for x in range(W)])
    end = Ln - F.CUT
    names = []
    for m, pix in (('_menu', C.PIX_M), ('', R['h'] / CELLS)):
        farm = F.load(source(f'{rig}__farmR{m}')).astype(float); out = farm.copy()
        cy, cx = (np.floor(yy / pix) + 0.5) * pix, (np.floor(xx / pix) + 0.5) * pix
        rim_c = rim_y[np.clip(cx.astype(int), 0, W - 1)]
        al = (cx - E[0]) * u[0] + (cy - E[1]) * u[1]; ac = (cx - E[0]) * u[1] - (cy - E[1]) * u[0]
        top = (E + u * ((rim_y[int(round(E[0] + u[0] / u[1] * (rim_y.max() - E[1])))] - E[1]) / u[1]))
        a0 = (top - E) @ u; k = np.clip((al - a0) / max(1.0, end - a0), 0, 1); hw = FUNNEL[0] + (FUNNEL[1] - FUNNEL[0]) * k
        below = (yy > rim_y[xx.astype(int)]) & (cy > rim_c)
        out[below & ((xx - E[0]) * u[0] + (yy - E[1]) * u[1] > a0 - 2)] = 0
        fun = below & (np.abs(ac) <= hw) & (al < end) & (al > a0 - pix)
        sv = lambda a, c: (a - a0 - BOW * c ** 2 - SLANT * c) / pix / PERIOD
        k, k_up = np.floor(sv(al, ac)).astype(int), np.floor(sv(al - pix * u[1], ac + pix * u[0])).astype(int)
        cream = [np.array(C.CREAM) * (WORLD_DIM if m == '' else 1), np.array(C.CREAM_MID) * (WORLD_DIM if m == '' else 1)]
        fun &= k < FOLDS
        for i in range(FOLDS):
            sel = fun & (np.maximum(k, 0) == i)
            if not sel.any(): continue
            c = cream[i % 2]; out[sel] = [*c, 255]; outer = sel & (ac > hw * 0.35); out[outer, :3] = C.mix(c, C.FOLD, 0.3)
            out[sel & (k_up < k) & (k > 0), :3] = C.FOLD
        out[below & ~fun & (out[..., 3] > 0)] = 0
        has = out[..., 3] > 0; pad = np.pad(has, 1); nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
        edge = nb & ~has & below & (al < end + pix)
        if m == '':
            ck = np.floor(yy / pix) * 1000 + np.floor(xx / pix); edge = np.isin(ck, np.unique(ck[edge])) & ~has
        out[edge] = [*C.OUTLINE, 255]
        names.append(save(out, f'{rig}__cuffR{m}'))
    return names


def sheet(out, rigs):
    tiles = []
    for rig in rigs:
        for sfx in F.KITS[rigarg.base(rig)]['sfx']:
            f = Image.open(f'{OUT}/{rig}__fistR{sfx}.png').convert('RGBA'); W, H = f.size
            bg = Image.new('RGBA', (W + 16, H + 40), (40, 34, 30, 255)); bg.alpha_composite(Image.new('RGBA', (8, H + 40), (110, 80, 50, 255)), ((W + 16) // 2 - 4, 0))
            bg.alpha_composite(f, (8, 20)); tiles.append(bg.resize((bg.size[0] * 8, bg.size[1] * 8), Image.NEAREST))
    for n in ('mage__cuffR_menu', 'mage__cuffR'):
        a = np.array(Image.open(f'{OUT}/{n}.png').convert('RGBA')); ys, xs = np.nonzero(a[..., 3])
        im = Image.fromarray(a).crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)); bg = Image.new('RGBA', im.size, (40, 34, 30, 255)); bg.alpha_composite(im)
        tiles.append(bg.resize((im.size[0] * 8, im.size[1] * 8), Image.NEAREST))
    o = Image.new('RGBA', (sum(t.size[0] + 10 for t in tiles), max(t.size[1] for t in tiles)), (0, 0, 0, 255)); x = 0
    for t in tiles: o.paste(t, (x, 0)); x += t.size[0] + 10
    o.save(out)


if __name__ == '__main__':
    rigs, FRESH = rigarg.take(['hero', 'archer', 'mage'])
    mages = [r for r in rigs if rigarg.base(r) == 'mage']
    mode = sys.argv[1:2]
    names = []
    if mode in (['run'], ['fists']): names += fists(rigs)
    if mode in (['run'], ['cup']): names += [n for r in mages for n in cup(r)]
    if mode in (['run'], ['cuff']): names += [n for r in mages for n in cuff(r)]
    if mode == ['sheet']: sheet(sys.argv[2], rigs)
    elif names: print('python3 tools/prep.py --only ' + ','.join(names))
    else: print(__doc__)
