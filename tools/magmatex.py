#!/usr/bin/env python3
"""Magma caves' ground textures (TASKS 402), drawn in code on the art grid: 128x128 art px of 8x8 src px each, seamless.

Codex image generation was out of quota on 02.11.2026; the prompts for a generated version stay in art/prompts/*_mg_tex.txt.
The bake (scene.js MAGMA) reads these by luminance only and grades them itself, so what they carry is the pattern:
  floor_mg_tex    ash grit, basalt crumbs, a few flat stone patches, thin cracks
  wall_mg_tex     the front faces of basalt columns: lit left facet, dark right facet, broken joints
  walltop_mg_tex  the flat polygonal tops of packed columns with a pale top-left bevel
  shore_mg_tex    cooled lava crust: glassy plates, ropy wrinkles, dark seams
  python3 tools/magmatex.py [--only floor,wall,walltop,shore] [--seed N]
"""
import argparse
import numpy as np
from PIL import Image

N, K = 128, 8
BLACK, D1, D2, D3, D4, HI = (11, 10, 11), (20, 19, 20), (32, 30, 31), (48, 45, 45), (70, 66, 65), (98, 92, 90)


def pnoise(rng, cells):
    g = rng.random((cells, cells))
    y, x = np.mgrid[0:N, 0:N] * cells / N
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = g[y0 % cells, x0 % cells], g[y0 % cells, (x0 + 1) % cells]
    c, d = g[(y0 + 1) % cells, x0 % cells], g[(y0 + 1) % cells, (x0 + 1) % cells]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def voronoi(rng, n, sy=1.0):
    pts = rng.random((n, 2)) * N
    y, x = np.mgrid[0:N, 0:N].astype(float)
    best, second, idx = np.full((N, N), 1e9), np.full((N, N), 1e9), np.zeros((N, N), int)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(x - px); dx = np.minimum(dx, N - dx)
        dy = np.abs(y - py); dy = np.minimum(dy, N - dy)
        d = np.hypot(dx, dy * sy)
        closer = d < best
        second = np.where(closer, best, np.minimum(second, d))
        idx = np.where(closer, i, idx)
        best = np.where(closer, d, best)
    return idx, second - best


def edges(idx):
    up, left = np.roll(idx, 1, 0), np.roll(idx, 1, 1)
    down, right = np.roll(idx, -1, 0), np.roll(idx, -1, 1)
    return (idx != up) | (idx != left), (idx != down) | (idx != right)


def paint(levels, pal):
    out = np.zeros((N, N, 3), np.uint8)
    for i, c in enumerate(pal):
        out[levels == i] = c
    return out


def floor(rng):
    grit = pnoise(rng, 16) * 0.5 + pnoise(rng, 32) * 0.3 + rng.random((N, N)) * 0.45
    lv = np.digitize(grit, [0.42, 0.62, 0.8])
    idx, gap = voronoi(rng, 34)
    patch = rng.random(34) < 0.35
    inside = patch[idx] & (gap > 1.5)
    lv = np.where(inside, 2, lv)
    tl, br = edges(idx)
    lv = np.where(patch[idx] & tl & ~br, 3, lv)
    lv = np.where(patch[idx] & br, 0, lv)
    crack = (gap < 1.0) & (pnoise(rng, 8) > 0.55)
    lv = np.where(crack, 0, lv)
    for _ in range(90):
        x, y, w, h = rng.integers(N), rng.integers(N), rng.integers(2, 5), rng.integers(1, 3)
        for j in range(h):
            for i in range(w - (j > 0)):
                lv[(y + j) % N, (x + i + j) % N] = 3 if j == 0 else 2
        lv[(y + h) % N, (x + h) % N:(x + h) % N + w - 1] = 0
    return paint(lv, [D1, D2, D3, D4])


def wall(rng):
    out = np.zeros((N, N, 3), np.uint8)
    xs, x = [], 0
    while x < N:
        w = int(rng.integers(6, 15))
        if N - x - w < 6:
            w = N - x
        xs.append((x, w)); x += w
    for x0, w in xs:
        tone = rng.integers(-1, 2)
        lit = max(2, int(w * 0.35))
        joints = sorted(rng.choice(N, size=int(rng.integers(3, 7)), replace=False))
        for xx in range(x0, x0 + w):
            col = (D4 if xx - x0 < lit else D3 if xx - x0 < w - 2 else D2)
            if xx == x0:
                col = HI
            if xx == x0 + w - 1:
                col = BLACK
            out[:, xx] = col
        if tone > 0:
            out[:, x0 + 1:x0 + w - 1] = np.minimum(255, out[:, x0 + 1:x0 + w - 1].astype(int) + 8)
        if tone < 0:
            out[:, x0 + 1:x0 + w - 1] = np.maximum(0, out[:, x0 + 1:x0 + w - 1].astype(int) - 8)
        for jy in joints:
            out[jy, x0:x0 + w - 1] = BLACK
            out[(jy + 1) % N, x0 + 1:x0 + w - 2] = HI
        for _ in range(int(w * 1.5)):
            yy, xx = rng.integers(N), x0 + 1 + rng.integers(max(1, w - 2))
            out[yy, xx] = D2 if rng.random() < 0.6 else D4
    return out


def walltop(rng):
    idx, gap = voronoi(rng, 70, 1.0)
    tone = rng.integers(0, 2, 70)
    lv = np.where(tone[idx] == 1, 2, 1)
    tl, br = edges(idx)
    lv = np.where(gap < 1.0, 0, lv)
    up, left = np.roll(gap, 1, 0) < 1.0, np.roll(gap, 1, 1) < 1.0
    lv = np.where((gap >= 1.0) & (up | left) & ~(np.roll(gap, -1, 0) < 1.0), 3, lv)
    speck = rng.random((N, N)) < 0.04
    lv = np.where(speck & (lv > 0), lv - 1, lv)
    return paint(lv, [BLACK, D1, D2, D3])


def shore(rng):
    idx, gap = voronoi(rng, 110, 1.0)
    ang = rng.random(110) * np.pi
    y, x = np.mgrid[0:N, 0:N].astype(float)
    rope = np.sin((x * np.cos(ang[idx]) + y * np.sin(ang[idx])) * 0.7 + idx) > 0.75
    lv = np.where(rope, 2, 1)
    lv = np.where(gap < 1.0, 0, lv)
    up, left = np.roll(gap, 1, 0) < 1.0, np.roll(gap, 1, 1) < 1.0
    lv = np.where((gap >= 1.0) & up & left, 3, lv)
    ash = (gap < 1.0) & (pnoise(rng, 16) > 0.7)
    lv = np.where(ash, 2, lv)
    return paint(lv, [BLACK, D1, D2, D4])


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='floor,wall,walltop,shore')
    ap.add_argument('--seed', type=int, default=402)
    a = ap.parse_args()
    for i, name in enumerate(a.only.split(',')):
        img = {'floor': floor, 'wall': wall, 'walltop': walltop, 'shore': shore}[name](np.random.default_rng(a.seed + i))
        Image.fromarray(img).resize((N * K, N * K), Image.NEAREST).save(f'art/gen/{name}_mg_tex.png')
        print('art/gen/%s_mg_tex.png' % name)
