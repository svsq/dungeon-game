#!/usr/bin/env python3
"""TASKS 2177: a closed fist round the shaft for the weapon hand of each class, and that forearm without its hand.

The fist is its own small sprite, drawn by drawHero over the weapon and turned with the weapon's axis: the shaft runs up the middle of
the texture (the thumb toward the weapon's head), four finger stacks lie across its front, the thumb wraps over the top one, the shaft
shows above and below. Built from cells in each hand's own palette (the tones of the fist or hand it replaces), so a glove stays its
leather, a gauntlet its steel, a bare hand its skin. _menu is the fist as built; the world texture is the same fist painted in cells
of the world grid (RIGS.<rig>.h / 42 px, as gridify_2155 paints the parts), the shader votes it from there.
The cuff (<rig>__cuffR<sfx>) is the forearm (farmR<sfx>, world and _menu) cut CUT px short of the fist's centre along the forearm, so
its hand does not show round the fist turned to the weapon.
  python3 tools/fist_2177.py run       art/gen/<rig>__fistR<sfx>(_menu).png, <rig>__cuffR<sfx>(_menu).png; old fists in art/old/<name>-20261117-2177.png
  python3 tools/fist_2177.py sheet out.png    the fists ×6 with a shaft under them, menu and world, to judge by eye"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

TAG, CELLS, CUT = '20261117-2177', 42, 4
OUT = os.environ.get('OUT', 'art/gen')
# rig: the outfits' suffixes, the texture the palette comes from (and the box of its hand)
KITS = {'hero': {'sfx': ['', '_pw', '_cl'], 'pal': lambda s: (f'hero__fistR{s}_menu', None)},
        'archer': {'sfx': [''], 'pal': lambda s: ('archer__fistR_menu', None)},
        'mage': {'sfx': [''], 'pal': lambda s: ('mage__farmL_menu', (40, 170, 80, 212))}}
TONES = 5

rigs = lambda: json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
load = lambda p: np.array(Image.open(p).convert('RGBA'))

def palette(name, box):
    """TONES colours of the hand, darkest (its outline) to lightest, by k-means on its opaque pixels"""
    src = f'art/old/{name}-{TAG}.png' if os.path.exists(f'art/old/{name}-{TAG}.png') else f'art/gen/{name}.png'
    a = load(src)
    if box: a = a[box[1]:box[3], box[0]:box[2]]
    px = a[a[..., 3] > 200][:, :3].astype(float); px = px[px[:, 0] >= px[:, 2]]
    lum = px @ [0.3, 0.59, 0.11]; c = np.percentile(lum, np.linspace(3, 97, TONES))[:, None] * np.ones(3)
    c = np.array([px[np.argsort(np.abs(lum - q))[:max(8, len(px) // 20)]].mean(0) for q in c[:, 0]])
    for _ in range(20):
        k = np.argmin(((px[:, None] - c[None]) ** 2).sum(-1), 1)
        c = np.array([px[k == i].mean(0) if (k == i).any() else c[i] for i in range(TONES)])
    return c[np.argsort(c @ [0.3, 0.59, 0.11])]

# the fist in art pixels of PIX rig px, tones 0 outline .. 4 highlight: the thumb across the top from its base on the palm's side to
# its tip at the knuckles, under it four finger stacks with their knuckles lit on the left and the tips curled into the palm on the
# right, the heel of the palm a shadowed band down the right edge; the shaft passes under column MID
FIST = ["....00000....",
        "...0344430...",
        "..034433200..",
        ".034300022110",
        "0443322201210",
        "0332222101110",
        "0000000101110",
        "0443322101110",
        "0332221101110",
        "0000000101110",
        "0443322101110",
        "0332211101110",
        "0000000101100",
        ".04322110110.",
        ".0332110010..",
        "..00000000..."]
PIX, MID = 2, 6

def fist_tones():
    assert all(len(r) == len(FIST[0]) for r in FIST), [len(r) for r in FIST]
    t = np.array([[-1 if c == '.' else int(c) for c in r] for r in FIST])
    return np.kron(t, np.ones((PIX, PIX), int))

def paint(t, pal):
    out = np.zeros(t.shape + (4,), np.uint8)
    for i in range(TONES): out[t == i] = [*np.clip(pal[i], 0, 255).astype(np.uint8), 255]
    return out

def cells(img, C):
    """the fist in cells of the world grid: each cell its most common opaque colour, opaque where over half of it is"""
    H, W = img.shape[:2]; out = np.zeros_like(img); oy, ox = (H - round(H / C) * C) / 2, (W - round(W / C) * C) / 2
    for y0 in np.arange(oy, H, C):
        for x0 in np.arange(ox, W, C):
            ys, xs = slice(max(0, int(round(y0))), int(round(min(H, y0 + C)))), slice(max(0, int(round(x0))), int(round(min(W, x0 + C))))
            blk = img[ys, xs].reshape(-1, 4); op = blk[blk[:, 3] > 0]
            if not len(blk) or len(op) * 2 < len(blk): continue
            cols, n = np.unique(op, axis=0, return_counts=True); dark = cols[:, :3] @ [0.3, 0.59, 0.11] <= (cols[:, :3] @ [0.3, 0.59, 0.11]).min()
            if (~dark).any() and n[dark].sum() < 0.6 * n.sum(): n = np.where(dark, 0, n)
            out[ys, xs] = cols[np.argmax(n)]
    return out

def cuff(farm, g):
    E, Hd = np.array(g['elbowR']), np.array(g['handR']); u = (Hd - E) / np.linalg.norm(Hd - E)
    yy, xx = np.mgrid[0:farm.shape[0], 0:farm.shape[1]] + 0.5
    far = (xx - E[0]) * u[0] + (yy - E[1]) * u[1] > np.linalg.norm(Hd - E) - CUT
    out = farm.copy(); out[far] = 0; return out

def build():
    R = rigs(); names = []
    for rig, kit in KITS.items():
        C = R[rig]['h'] / CELLS
        for sfx in kit['sfx']:
            for n in (f'{rig}__fistR{sfx}', f'{rig}__fistR{sfx}_menu'):
                if OUT == 'art/gen' and os.path.exists(f'art/gen/{n}.png') and not os.path.exists(f'art/old/{n}-{TAG}.png'): shutil.copyfile(f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png')
            menu = paint(fist_tones(), palette(*kit['pal'](sfx)))
            Image.fromarray(menu).save(f'{OUT}/{rig}__fistR{sfx}_menu.png'); Image.fromarray(cells(menu, C)).save(f'{OUT}/{rig}__fistR{sfx}.png')
            for m in ('', '_menu'):
                src = f'art/gen/{rig}__farmR{sfx}{m}.png'
                if os.path.exists(src): Image.fromarray(cuff(load(src), R[rig])).save(f'{OUT}/{rig}__cuffR{sfx}{m}.png'); names.append(f'{rig}__cuffR{sfx}{m}')
            names += [f'{rig}__fistR{sfx}', f'{rig}__fistR{sfx}_menu']
    return names

def sheet(out):
    tiles = []
    for rig, kit in KITS.items():
        for sfx in kit['sfx']:
            for m in ('_menu', ''):
                f = Image.open(f'{OUT}/{rig}__fistR{sfx}{m}.png').convert('RGBA'); W, H = f.size
                bg = Image.new('RGBA', (W + 8, H + 16), (40, 34, 30, 255)); sh = Image.new('RGBA', (4, H + 16), (110, 80, 50, 255))
                bg.alpha_composite(sh, ((W + 8) // 2 - 2, 0)); bg.alpha_composite(f, (4, 8)); tiles.append(bg.resize((bg.size[0] * 6, bg.size[1] * 6), Image.NEAREST))
    o = Image.new('RGBA', (sum(t.size[0] + 6 for t in tiles), max(t.size[1] for t in tiles)), (0, 0, 0, 255)); x = 0
    for t in tiles: o.paste(t, (x, 0)); x += t.size[0] + 6
    o.save(out)

if __name__ == '__main__':
    os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    if sys.argv[1:2] == ['run']: print('python3 tools/prep.py --only ' + ','.join(build()))
    elif sys.argv[1:2] == ['sheet']: sheet(sys.argv[2])
