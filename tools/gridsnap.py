#!/usr/bin/env python3
"""Small generated sprites snapped to the world's art grid at their display size (TASKS 421): a 1024 px Codex sprite shown
19-40 view px tall has art pixels of 0.3-0.5 view px, and its cracks and grains average away. Each cell is one 2 px world
pixel; the source stays in art/gen/<name>_raw.png, the result is art/gen/<name>.png, 8 src px to a cell.
  vent_mg       24x10  the ember wins its cell when a few of its pixels glow, basalt tones quantised, a one-cell ink outline
  dc_ash_mg     20x20  a grain anywhere in a cell fills it, thinned to ~30 grains
  python3 tools/gridsnap.py [--only vent_mg,...]
"""
import sys

import numpy as np
from PIL import Image

K = 8
INK = (6, 5, 6)
BAS = [(14, 13, 14), (28, 26, 27), (46, 43, 43), (74, 69, 68)]
ASH = [(62, 58, 56), (82, 76, 73), (100, 94, 90)]
EMBER = [(138, 42, 16), (200, 80, 26)]
CELLS = {'vent_mg': (24, 10), 'dc_ash_mg': (20, 20)}


def cells(a, cw, ch):
    """the sprite's bbox split into cw x ch blocks: (blocks [ch, cw, bh, bw, 4])"""
    ys, xs = np.nonzero(a[..., 3] > 128)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape[:2]; yi = np.linspace(0, h, ch + 1).astype(int); xi = np.linspace(0, w, cw + 1).astype(int)
    return [[a[yi[j]:yi[j + 1], xi[i]:xi[i + 1]] for i in range(cw)] for j in range(ch)]


def mean_rgb(b):
    m = b[..., 3] > 128
    return b[m][:, :3].mean(0) if m.any() else np.zeros(3)


def nearest(c, pal):
    return pal[int(np.argmin([np.sum((np.array(p) - c) ** 2) for p in pal]))]


def vent(a):
    cw, ch = CELLS['vent_mg']; B = cells(a, cw, ch); out = np.zeros((ch, cw, 4), np.uint8)
    for j in range(ch):
        for i in range(cw):
            b = B[j][i]; m = b[..., 3] > 128
            if m.mean() < 0.5: continue
            px = b[m][:, :3].astype(int); hot = px[:, 0] - px[:, 2]
            if (hot > 80).sum() >= max(3, 0.08 * len(hot)): out[j, i, :3] = EMBER[1] if (hot > 130).sum() >= 0.15 * len(hot) else EMBER[0]
            else: out[j, i, :3] = nearest(mean_rgb(b), BAS)
            out[j, i, 3] = 255
    solid = out[..., 3] > 0; p = np.pad(solid, 1)
    edge = solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    out[edge & (out[..., 0] < 100), :3] = INK
    return out


def ash(a, keep=30):
    cw, ch = CELLS['dc_ash_mg']; B = cells(a, cw, ch); out = np.zeros((ch, cw, 4), np.uint8); grains = []
    for j in range(ch):
        for i in range(cw):
            b = B[j][i]; m = b[..., 3] > 128
            if m.any(): grains.append((j, i, mean_rgb(b)))
    rng = np.random.default_rng(421)
    pick = rng.choice(len(grains), min(keep, len(grains)), replace=False) if grains else []
    for k in pick:
        j, i, c = grains[k]; out[j, i, :3] = nearest(c, ASH); out[j, i, 3] = 255
    return out


if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else list(CELLS)
    for n in only:
        a = np.asarray(Image.open(f'art/gen/{n}_raw.png').convert('RGBA'))
        g = {'vent_mg': vent, 'dc_ash_mg': ash}[n](a)
        g = np.pad(g, ((1, 1), (1, 1), (0, 0)))
        Image.fromarray(g).resize((g.shape[1] * K, g.shape[0] * K), Image.NEAREST).save(f'art/gen/{n}.png')
        print('art/gen/%s.png  %dx%d cells' % ((n,) + CELLS[n]))
