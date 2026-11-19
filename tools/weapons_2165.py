#!/usr/bin/env python3
"""TASKS 2165: the held weapons' arch pictures on the arch's own cell, a new short bow, a short wand and a taller staff.

  python3 tools/weapons_2165.py fit <kind> <generated> [--out DIR] [--menu-only]   # <held>.png (world, 2 px arch cell) and <held>_menu.png (1 px)
  python3 tools/weapons_2165.py hull <kind…>                                       # HELD_HULL rows, as weapons_2153.py hull

The arch draws a weapon WEAPON[kind][1] px wide at x3.2: its _menu picture has that many x3.2 cells across, each 2x2 texels, so the
arch's 2:1 minification lands on the mip level where one texel is one cell. Canvas fractions (grip, pole ends, nocks, hull) are the
world picture's: both pictures cover the same canvas.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import weapons_2153 as W  # noqa: E402

GEN, OLD = W.GEN, W.OLD
STAMP = '20261117-2165'
# world width in px (WEAPON in live/scene_hero.js): the wand a short rod about half the height, the staff above the head
WORLD_W = dict({k: v[2] for k, v in W.KINDS.items()}, wand=26, staff=56)
# across the axis: the new staff is drawn slender and a longer canvas widens it with the length; the new wand and bow are drawn at their own width
THICK = dict(W.THICK, staff=1.6, wand=1.0, bow_s=1.0, sword=1.0)
MENU_CELLS_PER_PX, MENU_TEXELS = 1.0, 2
SUPER = 3


def keep_old(name):
    p, o = GEN / f'{name}.png', OLD / f'{name}-{STAMP}.png'
    if p.exists() and not o.exists():
        OLD.mkdir(exist_ok=True)
        Image.open(p).save(o)


def placed(kind, gen_path):
    """the generated picture laid over the old picture's axis, sampled SUPER times finer than its canvas"""
    old_name, held, _, mode = W.KINDS[kind]
    old_src = W.OLD / f'{old_name}-{W.STAMP}.png'
    old = W.rgba(old_src if old_src.exists() else GEN / f'{old_name}.png')
    g = W.rgba(gen_path)
    H, Wd = old.shape[:2]
    if mode == 'pole':
        q0 = np.array([W.POLE['foot'][0] * Wd, W.POLE['foot'][1] * H])
        q1 = np.array([W.POLE['head'][0] * Wd, W.POLE['head'][1] * H])
        d = (q1 - q0) / np.linalg.norm(q1 - q0)
    elif mode == 'flat':
        d = np.array([1.0, 0.0])
        q0, q1 = W.ends(old, d)
    elif mode == 'bow':
        ys, xs = np.nonzero(old[..., 3] > 128)
        ev, evec = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
        d = evec[:, ev.argmax()]
        d = -d if d[0] < 0 else d
        q0, q1 = W.ends(old, d)
    else:
        d = np.array([1.0, -1.0]) / np.sqrt(2)
        q0, q1 = W.ends(old, d)
    gd = d
    if mode == 'bow':
        ys, xs = np.nonzero(g[..., 3] > 128)
        ev, evec = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
        gd = evec[:, ev.argmax()]
        if gd[1] * d[1] < 0 or (abs(gd[1]) < 1e-6 and gd[0] * d[0] < 0):
            gd = -gd
    p0, p1 = W.ends(g, gd)
    M = W.similarity(p0, p1, q0, q1)
    k = THICK.get(kind, 1.0)
    if k != 1.0:
        u = (q1 - q0) / np.linalg.norm(q1 - q0)
        A = np.outer(u, u) + k * np.outer([-u[1], u[0]], [-u[1], u[0]])
        M = np.hstack([A @ M[:, :2], (A @ M[:, 2] + (q0 - A @ q0))[:, None]])
    return W.warp(g, SUPER * M, (SUPER * Wd, SUPER * H)), (Wd, H), held


def fit(kind, gen_path, out=GEN, menu_only=False):
    big, (Wd, H), held = placed(kind, gen_path)
    n_w = max(8, round(WORLD_W[kind] * W.ARCH_K * MENU_CELLS_PER_PX))
    m = W.cells(big, n_w)
    out.mkdir(parents=True, exist_ok=True)
    if out == GEN:
        keep_old(held + '_menu')
    Image.fromarray(m.astype(np.uint8), 'RGBA').resize((m.shape[1] * MENU_TEXELS, m.shape[0] * MENU_TEXELS), Image.NEAREST).save(out / f'{held}_menu.png')
    msg = f'{kind}: {held}_menu.png {n_w} cells across'
    if not menu_only:
        n_ww = max(8, round(WORLD_W[kind] * W.ARCH_K / W.ARCH_CELL))
        wv = W.cells(big, n_ww)
        if out == GEN:
            keep_old(held)
        Image.fromarray(wv.astype(np.uint8), 'RGBA').resize((Wd, H), Image.NEAREST).save(out / f'{held}.png')
        msg += f', {held}.png {Wd}x{H} {n_ww} cells across'
    print(msg)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'fit':
        out = Path(a[a.index('--out') + 1]) if '--out' in a else GEN
        fit(a[1], a[2], out, '--menu-only' in a)
    elif a[0] == 'hull':
        print('{ ' + ', '.join(f"{W.KINDS[k][1]}: {W.hull(W.KINDS[k][1])}" for k in a[1:]) + ' }')
