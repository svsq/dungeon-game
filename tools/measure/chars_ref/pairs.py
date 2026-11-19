"""ref critic r2: hero mask from the with/without pair, crop to the hero, and side-by-side sheets game <-> reference at one height.
   python3 tools/measure/chars_ref/pairs.py [frames/critic_chars_r2_ref]"""
import json, os, sys
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r2_ref')
GAME = OUT / 'game'
BG = np.array([28, 28, 36])


def hero(name, thr=6):
    a = np.asarray(Image.open(GAME / f'{name}_all.png').convert('RGB')).astype(int)
    b = np.asarray(Image.open(GAME / f'{name}_none.png').convert('RGB')).astype(int)
    d = np.abs(a - b).sum(2)
    lab, n = ndi.label(d > 24)
    if n:
        core = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
        m = (d > thr) & ndi.binary_dilation(core, iterations=3)
        lab, n = ndi.label(m)
        m = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    else:
        m = d > thr
    ys, xs = np.nonzero(m)
    if not len(ys):
        return None, None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = np.where(m[..., None], a, BG).astype(np.uint8)[y0:y1, x0:x1]
    return rgb, m[y0:y1, x0:x1]


def refmask(path, bg=None, thr=30):
    im = Image.open(ROOT / path).convert('RGBA')
    a = np.asarray(im).astype(int)
    rgb = a[..., :3]
    if a[..., 3].min() < 255:
        m = a[..., 3] > 128
    else:
        bgc = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), 0) if bg is None else np.array(bg)
        m = np.abs(rgb - bgc).sum(2) > thr
    return rgb.astype(np.uint8), m


def fit(rgb, h):
    im = Image.fromarray(rgb)
    s = h / im.height
    return im.resize((max(1, round(im.width * s)), h), Image.NEAREST)


def sheet(name, tiles, h=420):
    ims = [fit(t, h) for t in tiles if t is not None]
    W = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    S = Image.new('RGB', (W, h + 40), (20, 20, 26))
    x = 20
    for i in ims:
        S.paste(i, (x, 20)); x += i.width + 20
    S.save(OUT / f'pair_{name}.png')


REF = {'warrior': ('art/char_refs/warrior_a_v2.png', (200, 30, 680, 970), 'art/char_refs/warrior_a_small_r4.png'),
       'archer': ('art/char_refs/archer_a.png', (190, 50, 660, 940), 'art/char_refs/archer_a_small_r4.png'),
       'mage': ('art/char_refs/mage_a_v4.png', (200, 50, 680, 970), 'art/char_refs/mage_a_small_orb_r4.png')}


def crop_mask(rgb, m):
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.where(m[..., None], rgb, BG).astype(np.uint8)[y0:y1, x0:x1], m[y0:y1, x0:x1]


if __name__ == '__main__':
    for cls, (big, box, small) in REF.items():
        rgb, m = refmask(big)
        x0, y0, x1, y1 = box
        br, bm = crop_mask(rgb[y0:y1, x0:x1], m[y0:y1, x0:x1])
        sr, sm = crop_mask(*refmask(small))
        np.save(OUT / f'refmask_{cls}_big.npy', bm); np.save(OUT / f'refmask_{cls}_small.npy', sm)
        Image.fromarray(br).save(OUT / f'ref_{cls}_big.png'); Image.fromarray(sr).save(OUT / f'ref_{cls}_small.png')
        tiles = [br, sr]
        for n in ['arch_' + cls, f'rest_{cls}_right', f'rest_{cls}_down', f'rest_{cls}_up']:
            g, gm = hero(n)
            if g is not None:
                Image.fromarray(g).save(OUT / f'hero_{n}.png'); np.save(OUT / f'mask_{n}.npy', gm)
            tiles.append(g)
        sheet(cls + '_rest', tiles)
        tiles = []
        for n in [f'run_{cls}_{i}' for i in range(4)] + [f'act_{cls}']:
            g, gm = hero(n)
            if g is not None:
                Image.fromarray(g).save(OUT / f'hero_{n}.png'); np.save(OUT / f'mask_{n}.npy', gm)
            tiles.append(g)
        sheet(cls + '_move', tiles, 300)
    for n in ['rest_warrior_nos_right', 'rest_mage_noorb_right']:
        g, gm = hero(n)
        if g is not None:
            Image.fromarray(g).save(OUT / f'hero_{n}.png'); np.save(OUT / f'mask_{n}.npy', gm)
    print('ok')
