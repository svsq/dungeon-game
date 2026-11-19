#!/usr/bin/env python3
"""TASKS 2153: the held weapons in the new look and the arch's orb.

  python3 tools/weapons_2153.py orb                      # art/gen/orb_held_menu.png from the orb of art/char_refs/mage_a_v4.png
  python3 tools/weapons_2153.py fit <kind> <generated>   # art/gen/<held>.png laid over the old picture's axis, on a 2 px arch cell
  python3 tools/weapons_2153.py sheet <out.png>          # old and new held pictures side by side
  python3 tools/weapons_2153.py hull <kind…>             # the held art's hull for HELD_HULL in live/scene_hero.js

A held picture keeps the old one's canvas and axis (grip, foot and head, nocks), so the code's anchors stay true; only its
art cell changes: CELLS art pixels across the canvas width, which in the arch (x3.2) is about 2 screen px, the body's cell.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN, OLD = ROOT / 'art/gen', ROOT / 'art/old'
STAMP = '20261117-2153'
ARCH_K, ARCH_CELL = 3.2, 2.0
OUTLINE = (26, 17, 15, 255)
# kind: (old picture, held picture, world width in px from WEAPON, axis mode)
KINDS = {
    'sword': ('it_sword', 'it_sword_held', 42, 'diag'),
    'longsword': ('it_longsword', 'it_longsword_held', 46, 'diag'),
    'axe': ('it_axe', 'it_axe_held', 44, 'diag'),
    'hammer': ('it_hammer', 'it_hammer_held', 44, 'diag'),
    'wand': ('it_wand', 'it_wand_held', 40, 'diag'),
    'staff': ('it_staff', 'it_staff_held', 42, 'pole'),
    'bow_s': ('it_bow_s_h', 'it_bow_s_h', 32, 'bow'),
    'bow_l': ('it_bow_l_h', 'it_bow_l_h', 28, 'bow'),
    'crossbow': ('it_crossbow_h', 'it_crossbow_h', 46, 'flat'),
}
# the generator draws the long ones thin (and the wand stubby, stretched to the old wand's length it read as a club): a shaft or blade two cells wide is lost in the world's vote, so they are widened across their axis
THICK = {'longsword': 1.5, 'staff': 1.7, 'wand': 0.75, 'bow_l': 1.4}
# the staff's painted shaft ends, as POLE.it_staff in live/scene_hero.js
POLE = {'foot': (0.074, 0.973), 'head': (0.96, 0.054)}


def rgba(p):
    return np.array(Image.open(p).convert('RGBA')).astype(np.float64)


def ends(a, d):
    """the two extreme ends of the opaque shape along the unit direction d: mean of the pixels in the outer 1.5 % of its span"""
    ys, xs = np.nonzero(a[..., 3] > 128)
    pr = xs * d[0] + ys * d[1]
    lo, hi = pr.min(), pr.max(),
    span = hi - lo
    m0, m1 = pr <= lo + 0.015 * span, pr >= hi - 0.015 * span
    return np.array([xs[m0].mean(), ys[m0].mean()]), np.array([xs[m1].mean(), ys[m1].mean()])


def similarity(p0, p1, q0, q1):
    """the rotation, scale and shift taking p0, p1 onto q0, q1, as a 2x3 matrix (complex arithmetic)"""
    a, b = complex(*p0), complex(*p1)
    c, d = complex(*q0), complex(*q1)
    k = (d - c) / (b - a)
    t = c - k * a
    return np.array([[k.real, -k.imag, t.real], [k.imag, k.real, t.imag]])


def warp(src, M, size):
    """src (RGBA float) mapped by M onto a canvas of size (w, h), sampled by area so the art keeps its colours"""
    w, h = size
    inv = np.linalg.inv(np.vstack([M, [0, 0, 1]]))[:2]
    out = np.zeros((h, w, 4))
    S = 4
    acc = np.zeros((h, w, 4))
    for sy in range(S):
        for sx in range(S):
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
            xx += (sx + 0.5) / S
            yy += (sy + 0.5) / S
            u = inv[0, 0] * xx + inv[0, 1] * yy + inv[0, 2]
            v = inv[1, 0] * xx + inv[1, 1] * yy + inv[1, 2]
            ui, vi = np.floor(u).astype(int), np.floor(v).astype(int)
            ok = (ui >= 0) & (vi >= 0) & (ui < src.shape[1]) & (vi < src.shape[0])
            px = np.zeros((h, w, 4))
            px[ok] = src[vi[ok], ui[ok]]
            px[..., :3] *= px[..., 3:4] / 255
            acc += px
    acc /= S * S
    a = acc[..., 3:4]
    out[..., :3] = np.where(a > 0, acc[..., :3] / np.maximum(a, 1e-6) * 255, 0)
    out[..., 3] = a[..., 0]
    return out


def cells(img, n_w):
    """down to n_w art pixels across by the most common colour of each block, alpha hard, then back up to the canvas by nearest"""
    h, w = img.shape[:2]
    n_h = max(1, round(n_w * h / w))
    small = np.zeros((n_h, n_w, 4))
    for j in range(n_h):
        for i in range(n_w):
            blk = img[j * h // n_h:(j + 1) * h // n_h, i * w // n_w:(i + 1) * w // n_w].reshape(-1, 4)
            op = blk[blk[:, 3] > 110]
            op = op[~((op[:, 0] > op[:, 1] + 35) & (op[:, 2] > op[:, 1] + 35))]
            if len(op) < len(blk) * 0.42:
                continue
            q = (op[:, :3] // 12).astype(int)
            key = q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2]
            vals, cnt = np.unique(key, return_counts=True)
            win = op[key == vals[cnt.argmax()]]
            small[j, i, :3] = win[:, :3].mean(0)
            small[j, i, 3] = 255
    # the painted outline is thinner than a cell and is lost in the vote: one outline cell round the shape, as the body has
    op = small[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]
    nb[:-1] |= op[1:]
    nb[:, 1:] |= op[:, :-1]
    nb[:, :-1] |= op[:, 1:]
    ring = nb & ~op
    small[ring] = OUTLINE
    return small


def keep_old(name):
    p = GEN / f'{name}.png'
    o = OLD / f'{name}-{STAMP}.png'
    if p.exists() and not o.exists():
        OLD.mkdir(exist_ok=True)
        Image.open(p).save(o)


def fit(kind, gen_path):
    old_name, held, world_w, mode = KINDS[kind]
    old_src = OLD / f'{old_name}-{STAMP}.png'
    old = rgba(old_src if old_src.exists() else GEN / f'{old_name}.png')
    g = rgba(gen_path)
    H, W = old.shape[:2]
    if mode == 'pole':
        q0 = np.array([POLE['foot'][0] * W, POLE['foot'][1] * H])
        q1 = np.array([POLE['head'][0] * W, POLE['head'][1] * H])
        d = (q1 - q0) / np.linalg.norm(q1 - q0)
    elif mode == 'flat':
        d = np.array([1.0, 0.0])
        q0, q1 = ends(old, d)
    else:
        d = np.array([1.0, -1.0]) / np.sqrt(2) if mode == 'diag' else None
        if mode == 'bow':
            ys, xs = np.nonzero(old[..., 3] > 128)
            cov = np.cov(np.vstack([xs, ys]))
            ev, evec = np.linalg.eigh(cov)
            d = evec[:, ev.argmax()]
            if d[0] < 0:
                d = -d
        q0, q1 = ends(old, d)
    gd = d
    p0, p1 = ends(g, gd)
    if mode == 'bow':
        ys, xs = np.nonzero(g[..., 3] > 128)
        ev, evec = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
        gd = evec[:, ev.argmax()]
        if gd[1] * d[1] < 0 or (abs(gd[1]) < 1e-6 and gd[0] * d[0] < 0):
            gd = -gd
        p0, p1 = ends(g, gd)
    M = similarity(p0, p1, q0, q1)
    k = THICK.get(kind, 1.0)
    if k != 1.0:
        u = (q1 - q0) / np.linalg.norm(q1 - q0)
        A = np.outer(u, u) + k * np.outer([-u[1], u[0]], [-u[1], u[0]])
        T = np.hstack([A, (q0 - A @ q0)[:, None]])
        M = np.hstack([A @ M[:, :2], (A @ M[:, 2] + T[:, 2])[:, None]])
    big = warp(g, M, (W, H))
    n_w = max(8, round(world_w * ARCH_K / ARCH_CELL))
    small = cells(big, n_w)
    keep_old(held)
    out = Image.fromarray(small.astype(np.uint8), 'RGBA').resize((W, H), Image.NEAREST)
    out.save(GEN / f'{held}.png')
    print(f'{kind}: {held}.png {W}x{H}, {n_w} cells across, axis old {q0.round(1)}->{q1.round(1)}, generated {p0.round(1)}->{p1.round(1)}')


def orb():
    """the orb of the mage's standard reference, cut out of his palm: the fingers over its lower edge give way to the orb's own
    upper edge mirrored, the night background to transparency, its blue halo kept as a soft rim"""
    r = rgba(ROOT / 'art/char_refs/mage_a_v4.png')
    cx, cy, R, half = 601, 334, 50, 62
    c = r[cy - half:cy + half, cx - half:cx + half].copy()
    n = 2 * half
    yy, xx = np.mgrid[0:n, 0:n]
    dx, dy = xx - half + 0.5, yy - half + 0.5
    skin = (c[..., 0] > c[..., 2] + 25)
    low = dy > 0.62 * R
    fix = low & ((dx ** 2 + dy ** 2) < (R + 9) ** 2)
    mir = c[np.clip(n - 1 - yy, 0, n - 1), xx]
    c[fix] = mir[fix]
    c[low & ~fix & skin] = 0
    bg = np.array([25, 24, 38.0])
    dist = np.linalg.norm(c[..., :3] - bg, axis=2)
    rr = np.hypot(dx, dy)
    a = np.clip((dist - 6) / 50, 0, 1) * np.clip((R + 12 - rr) / 4, 0, 1)
    a[rr <= R + 3.5] = 1
    c[..., 3] = a * 255
    keep_old('orb_held_menu')
    Image.fromarray(c.astype(np.uint8), 'RGBA').save(GEN / 'orb_held_menu.png')
    print('orb_held_menu.png', n, 'px, orb', 2 * R, 'px across')


def hull(name, n=8):
    """the opaque art's convex hull cut to n corners, in canvas fractions (HELD_HULL in live/scene_hero.js)"""
    a = rgba(GEN / f'{name}.png')
    H, W = a.shape[:2]
    ys, xs = np.nonzero(a[..., 3] > 128)
    pts = sorted(set(zip(xs.tolist(), ys.tolist())) | set(zip((xs + 1).tolist(), (ys + 1).tolist())))
    cross = lambda o, p, q: (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    h = lo[:-1] + hi[:-1]
    while len(h) > n:
        areas = [abs(cross(h[i - 1], h[i], h[(i + 1) % len(h)])) for i in range(len(h))]
        h.pop(int(np.argmin(areas)))
    return [[round(x / W, 3), round(y / H, 3)] for x, y in h]


def sheet(out):
    tiles = []
    for kind, (old_name, held, _, _) in KINDS.items():
        o = OLD / f'{old_name}-{STAMP}.png'
        o = o if o.exists() else GEN / f'{old_name}.png'
        for p in (o, GEN / f'{held}.png'):
            im = Image.open(p).convert('RGBA')
            k = 220 / im.height
            tiles.append(im.resize((max(1, int(im.width * k)), 220), Image.NEAREST))
    W = sum(t.width + 8 for t in tiles)
    s = Image.new('RGBA', (W, 220), (92, 70, 54, 255))
    x = 0
    for t in tiles:
        s.alpha_composite(t, (x, 0))
        x += t.width + 8
    s.save(out)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'orb':
        orb()
    elif cmd == 'fit':
        fit(sys.argv[2], sys.argv[3])
    elif cmd == 'sheet':
        sheet(sys.argv[2])
    elif cmd == 'hull':
        print('{ ' + ', '.join(f"{KINDS[k][1]}: {hull(KINDS[k][1])}" for k in sys.argv[2:]) + ' }')
