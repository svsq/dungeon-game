#!/usr/bin/env python3
"""The warrior's arch fists round a haft (hero__fistR_menu, hero__fistR_pw_menu) from the generated sheet art/gen/warrior_grip_fist_sheet.png
(prompt art/prompts/warrior_grip_fist.txt: a leather glove on the left, the plate gauntlet on the right, each closed round a flat grey rod).

Each fist is cut from its half of the sheet: the rows above and below it, where only the rod shows, are dropped, the rod's own pixels
inside it go transparent (the real haft shows there), and the canvas is widened on the fingers' side so the rod runs down its middle
column: drawHero centres the fist on the grip and turns it along the weapon. It is sampled down to HEIGHT px on the art's own grid (the
commonest opaque colour of each cell) and recoloured from the glove it belongs to: each pixel takes the colour of the drawn hand
(farmR<sfx>_menu below HAND_TOP) at the same luminance rank within its material (steel or leather, by OKLab chroma), the outline its
darkest. The world fists (3 x 4 cells of the world grid) stay as they are pixelled.
  python3 tools/warrior_grip_fist.py run          art/gen/hero__fistR{,_pw}_menu.png; old ones in art/old/<name>-before-grip.png; prints the prep line
  python3 tools/warrior_grip_fist.py sheet out.png  the new fists x8 on a haft, beside the old ones"""
import os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHEET, TAG, HEIGHT, HAND_TOP = 'art/gen/warrior_grip_fist_sheet.png', 'before-grip', 32, 172
# sheet half (left, right) → the glove suffix it becomes
KITS = (('', (0, 0.5)), ('_pw', (0.5, 1.0)))
ROD_GREY, ROD_SPREAD, STEEL_CHROMA, OUTLINE_L = (100, 170), 12, 0.035, 0.22
# a fist's row is one wider than ROW_K rods (the rod's own outline is not the fist); TONES: flat tones per material, fist and hand alike
ROW_K, TONES = 2, 4
# the rod alone sticks out over the fist's top for at least this many sheet rows: its columns are read there, as steel is grey too
ROD_ROWS = 20

def oklab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    l = np.cbrt(c @ np.array([[0.4122214708, 0.2119034982, 0.0883024619], [0.5363325363, 0.6806995451, 0.2817188376], [0.0514459929, 0.1073969566, 0.6299787005]]))
    return l @ np.array([[0.2104542553, 1.9779984951, 0.0259040371], [0.7936177850, -2.4285922050, 0.7827717662], [-0.0040720468, 0.4505937099, -0.8086757660]])

def rod_mask(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (a[..., 3] > 127) & (abs(r - g) < ROD_SPREAD) & (abs(g - b) < ROD_SPREAD) & (r > ROD_GREY[0]) & (r < ROD_GREY[1])

def cut(a):
    """the fist without its rod, its canvas centred on the rod's middle column"""
    op, rod = a[..., 3] > 127, rod_mask(a)
    top = np.nonzero(op.any(1))[0].min(); rc = np.nonzero(rod[top:top + ROD_ROWS].any(0))[0]; mid = (rc.min() + rc.max()) / 2
    rod[:, :rc.min()] = rod[:, rc.max() + 1:] = False
    hand = op & ~rod
    rows = np.nonzero(hand.sum(1) > ROW_K * (rc.max() + 1 - rc.min()))[0]; hand[:rows.min()] = hand[rows.max() + 1:] = False; cols = np.nonzero(hand.any(0))[0]
    half = int(np.ceil(max(mid - cols.min(), cols.max() + 1 - mid)))
    x0 = int(round(mid - half)); out = np.zeros((rows.max() + 1 - rows.min(), 2 * half, 4), np.uint8)
    src = a[rows.min():rows.max() + 1, max(0, x0):x0 + 2 * half].copy(); src[rod[rows.min():rows.max() + 1, max(0, x0):x0 + 2 * half]] = 0
    out[:, max(0, -x0):max(0, -x0) + src.shape[1]] = src
    return out

def sample(a, h):
    """down to h px tall on the art's own grid: each cell its commonest opaque colour, opaque where over half of it is"""
    C = a.shape[0] / h; w = int(round(a.shape[1] / C)); w += w % 2
    out = np.zeros((h, w, 4), np.uint8); ox = (a.shape[1] - w * C) / 2
    for j in range(h):
        for i in range(w):
            blk = a[int(j * C):int((j + 1) * C), max(0, int(ox + i * C)):max(0, int(ox + (i + 1) * C))].reshape(-1, 4)
            op = blk[blk[:, 3] > 127]
            if len(blk) and len(op) * 2 >= len(blk):
                cols, n = np.unique(op[:, :3], axis=0, return_counts=True); out[j, i] = [*cols[np.argmax(n)], 255]
    return out

def tones(px, k):
    """k flat colours of px by k-means seeded at luminance quantiles, darkest first, and each pixel's tone"""
    L = oklab(px)[:, 0]; c = np.array([px[np.argsort(np.abs(L - q))[:max(1, len(px) // 20)]].mean(0) for q in np.quantile(L, np.linspace(0.05, 0.95, k))])
    for _ in range(20):
        lab = np.argmin(((px[:, None] - c[None]) ** 2).sum(-1), 1); c = np.array([px[lab == i].mean(0) if (lab == i).any() else c[i] for i in range(k)])
    order = np.argsort(oklab(c)[:, 0]); rank = np.empty(k, int); rank[order] = np.arange(k)
    return c[order], rank[lab]

def recolour(fist, ref):
    """the fist's tones per material ranked by luminance onto the drawn hand's tones of that material; the darkest pixels its outline"""
    rp = ref[ref[..., 3] > 127][:, :3].astype(float); rl = oklab(rp); out = fist.copy(); m = fist[..., 3] > 127
    fp = fist[m][:, :3].astype(float); fl = oklab(fp); res = np.zeros_like(fp)
    steel = lambda L: np.hypot(L[:, 1], L[:, 2]) < STEEL_CHROMA
    rs, fs, outline = steel(rl), steel(fl), fl[:, 0] < OUTLINE_L
    res[outline] = rp[np.argmin(rl[:, 0])]
    for kind in (True, False):
        sel, pool = (fs == kind) & ~outline, (rs == kind) & (rl[:, 0] >= OUTLINE_L)
        if not sel.any(): continue
        if not pool.any(): pool = rl[:, 0] >= OUTLINE_L
        pal, _ = tones(rp[pool], TONES); _, lab = tones(fp[sel], TONES)
        res[sel] = pal[lab]
    out[m, :3] = res.round().astype(np.uint8)
    return out

def build():
    sheet = np.array(Image.open(SHEET).convert('RGBA')); W = sheet.shape[1]; names = []
    for sfx, (f0, f1) in KITS:
        n = f'hero__fistR{sfx}_menu'
        if os.path.exists(f'art/gen/{n}.png') and not os.path.exists(f'art/old/{n}-{TAG}.png'): shutil.copyfile(f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png')
        ref = np.array(Image.open(f'art/gen/hero__farmR{sfx}_menu.png').convert('RGBA'))[HAND_TOP:]
        fist = recolour(sample(cut(sheet[:, int(W * f0):int(W * f1)]), HEIGHT), ref)
        Image.fromarray(fist).save(f'art/gen/{n}.png'); names.append(n)
    return names

def preview(out):
    tiles = []
    for sfx, _ in KITS:
        for src in (f'art/old/hero__fistR{sfx}_menu-{TAG}.png', f'art/gen/hero__fistR{sfx}_menu.png'):
            f = Image.open(src).convert('RGBA'); W, H = f.size
            bg = Image.new('RGBA', (W + 8, H + 16), (40, 34, 30, 255)); bg.alpha_composite(Image.new('RGBA', (4, H + 16), (110, 80, 50, 255)), ((W + 8) // 2 - 2, 0))
            bg.alpha_composite(f, (4, 8)); tiles.append(bg.resize((bg.size[0] * 8, bg.size[1] * 8), Image.NEAREST))
    o = Image.new('RGBA', (sum(t.size[0] + 8 for t in tiles), max(t.size[1] for t in tiles)), (0, 0, 0, 255)); x = 0
    for t in tiles: o.paste(t, (x, 0)); x += t.size[0] + 8
    o.save(out)

if __name__ == '__main__':
    os.chdir(ROOT)
    if sys.argv[1:2] == ['run']: print('python3 tools/prep.py --only ' + ','.join(build()))
    elif sys.argv[1:2] == ['sheet']: preview(sys.argv[2])
    else: print(__doc__)
