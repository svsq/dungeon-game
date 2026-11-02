#!/usr/bin/env python3
"""Magma caves' props and decals (TASKS 405), made from the project's own art and drawn in code on the art grid.

Codex image generation was out of quota on 02-03.11.2026, so these come from sources already approved:
  boulder_mg_a/b  boulder_a/b re-shaded by luminance into the bible's basalt ramp, the moss and fern taken to dark stone
  skel_mg         skel_cv charred: bone to ash grey, cloth and rock to near-black, a few dull embers in the dark
  obsidian_mg     crystal_cv re-shaded into black volcanic glass with violet-grey glints
  banner_mg       the cult banner hung from a crossbar between two iron posts (it stands on the plateau, no wall to hang on)
drawn here, 8 src px to an art px:
  basalt_a/b      low clusters of hexagonal basalt columns (lit left facet, dark right, pale top bevel, ink outline)
  vent_mg         a hot fissure in the ground: a crust patch split by a crack (its glow is the scene's)
  dc_ash_mg       a drift of grey ash; dc_splash_mg  a cooled splash of lava, black glass with a dull rust rim and drops
  python3 tools/magmaprops.py
"""
import numpy as np
from PIL import Image, ImageDraw

K = 8
INK = (6, 5, 6)
BAS = [(14, 13, 14), (28, 26, 27), (46, 43, 43), (74, 69, 68), (104, 98, 96)]
OBS = [(9, 7, 11), (24, 18, 30), (44, 33, 54), (82, 66, 96), (150, 132, 160)]
ASH = [(40, 37, 36), (62, 58, 56), (92, 86, 82), (128, 120, 114)]


def lum(a):
    return (0.3 * a[..., 0] + 0.55 * a[..., 1] + 0.15 * a[..., 2]) / 255.0


def reshade(src, ramp, cuts, green_to=None):
    im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(float)
    L = lum(a); lv = np.digitize(L, cuts)
    out = np.zeros_like(a)
    for i, c in enumerate(ramp):
        out[lv == i, :3] = c
    if green_to is not None:
        g = (a[..., 1] > a[..., 0] * 1.12) & (a[..., 1] > a[..., 2] * 1.05)
        out[g, :3] = ramp[green_to]
    ink = L < 0.07
    out[ink, :3] = INK
    out[..., 3] = a[..., 3]
    return Image.fromarray(out.astype(np.uint8))


def charred(src):
    im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(float)
    L = lum(a); warm = (a[..., 0] > a[..., 2] + 20) & (L > 0.45)
    out = np.zeros_like(a); rng = np.random.default_rng(405)
    lv = np.digitize(L, [0.12, 0.26, 0.45])
    for i, c in enumerate([INK, BAS[1], BAS[2], BAS[3]]):
        out[lv == i, :3] = c
    out[warm, :3] = np.array(ASH[2]) * (0.75 + 0.35 * (L[warm][:, None]))
    out[warm & (L > 0.7), :3] = ASH[3]
    # a few dull embers, one art pixel each (8x8 src blocks), in the dark parts of the bones and rags
    h, w = L.shape
    for _ in range(26):
        y, x = rng.integers(0, h // K) * K, rng.integers(0, w // K) * K
        blk = (slice(y, y + K), slice(x, x + K))
        if a[blk][..., 3].min() > 200 and 0.12 < L[blk].mean() < 0.35:
            out[blk][..., :3] = (128, 38, 14)
    out[..., 3] = a[..., 3]
    return Image.fromarray(out.astype(np.uint8))


def columns(spec, W, H):
    """spec: [(cx, top, w, h)] back to front, in art px; a hexagonal column: flattened hex top, three facets down to its foot"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for cx, ty, w, h in spec:
        q, dp = w / 4.0, max(2, round(w / 3.2))
        top = [(cx - w / 2, ty), (cx - q, ty - dp / 2), (cx + q, ty - dp / 2), (cx + w / 2, ty), (cx + q, ty + dp / 2), (cx - q, ty + dp / 2)]
        body = [(cx - w / 2, ty), (cx - q, ty + dp / 2), (cx + q, ty + dp / 2), (cx + w / 2, ty), (cx + w / 2, ty + h), (cx + q, ty + h + dp / 2), (cx - q, ty + h + dp / 2), (cx - w / 2, ty + h)]
        d.polygon(body, fill=BAS[2] + (255,), outline=INK + (255,))
        d.polygon([(cx - w / 2 + 1, ty + 1), (cx - q, ty + dp / 2 + 1), (cx - q, ty + h + dp / 2 - 1), (cx - w / 2 + 1, ty + h - 1)], fill=BAS[3] + (255,))
        d.polygon([(cx + q, ty + dp / 2 + 1), (cx + w / 2 - 1, ty + 1), (cx + w / 2 - 1, ty + h - 1), (cx + q, ty + h + dp / 2 - 1)], fill=BAS[1] + (255,))
        d.line([(cx - q, ty + dp / 2 + 1), (cx - q, ty + h + dp / 2 - 1)], fill=BAS[1] + (255,))
        for j in range(1, 3):
            y = ty + h * (0.3 + 0.35 * j) + (j % 2)
            d.line([(cx - w / 2 + 1, y), (cx - q, y + 1)], fill=INK + (255,))
        d.polygon(top, fill=BAS[3] + (255,), outline=INK + (255,))
        d.line([(cx - w / 2 + 1, ty), (cx - q, ty - dp / 2 + 1), (cx + q - 1, ty - dp / 2 + 1)], fill=BAS[4] + (255,))
    return im.resize((W * K, H * K), Image.NEAREST)


def vent():
    W, H = 22, 10; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([0, 1, W - 1, H - 1], fill=BAS[1] + (255,), outline=INK + (255,))
    d.ellipse([3, 3, W - 4, H - 3], fill=BAS[0] + (255,))
    for (x0, y0, x1, y1) in [(4, 5, 9, 4), (9, 4, 13, 6), (13, 6, 18, 5), (9, 4, 10, 2), (13, 6, 14, 8)]:
        d.line([(x0, y0), (x1, y1)], fill=(115, 20, 13, 255))
    for p in [(9, 4), (13, 6), (11, 5)]:
        im.putpixel(p, (194, 93, 26, 255))
    return im.resize((W * K, H * K), Image.NEAREST)


def ash(rng):
    W = H = 36; a = np.zeros((H, W, 4), np.uint8); y, x = np.mgrid[0:H, 0:W]
    r = np.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2.4))
    n = rng.random((H, W))
    m = (n > 0.25 + 0.75 * r) & (r < 1)
    for i, c in enumerate(ASH):
        sel = m & (np.digitize(rng.random((H, W)), [0.35, 0.7, 0.92]) == i)
        a[sel, :3] = c; a[sel, 3] = 210
    return Image.fromarray(a).resize((W * K, H * K), Image.NEAREST)


def splash(rng):
    W, H = 30, 22; im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pts = []
    for i in range(14):
        an = i / 14 * 2 * np.pi; rr = 0.6 + 0.4 * rng.random()
        pts.append((W / 2 + np.cos(an) * rr * 9, H / 2 + np.sin(an) * rr * 6))
    d.polygon(pts, fill=(54, 18, 15, 255))
    d.polygon([((p[0] - W / 2) * 0.78 + W / 2, (p[1] - H / 2) * 0.72 + H / 2) for p in pts], fill=BAS[1] + (255,))
    d.polygon([((p[0] - W / 2) * 0.45 + W / 2 - 1, (p[1] - H / 2) * 0.4 + H / 2 - 1) for p in pts], fill=BAS[0] + (255,))
    im.putpixel((int(W / 2) - 3, int(H / 2) - 2), BAS[3] + (255,))
    for _ in range(7):
        an = rng.random() * 2 * np.pi; rr = 11 + 3 * rng.random(); x, y = int(W / 2 + np.cos(an) * rr), int(H / 2 + np.sin(an) * rr * 0.7)
        if 0 <= x < W - 1 and 0 <= y < H - 1:
            d.rectangle([x, y, x + (rng.random() < 0.4), y], fill=BAS[1] + (255,))
    return im.resize((W * K, H * K), Image.NEAREST)


def banner():
    b = Image.open('art/gen/banner.png').convert('RGBA')
    ap = b.height / 32.0
    post = round(2 * ap); H = round(b.height * 1.5); W = b.width + 2 * post
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    top = round(3 * ap)
    for x0 in (0, W - post):
        d.rectangle([x0, top - round(ap), x0 + post - 1, H - 1], fill=INK + (255,))
        d.rectangle([x0 + round(ap * 0.5), top, x0 + post - 1 - round(ap * 0.5), H - 1 - round(ap * 0.5)], fill=BAS[2] + (255,))
        d.rectangle([x0 + round(ap * 0.5), top, x0 + round(ap), H - 1 - round(ap * 0.5)], fill=BAS[3] + (255,))
    d.rectangle([0, top, W - 1, top + round(1.5 * ap)], fill=INK + (255,))
    d.rectangle([round(ap * 0.5), top + round(ap * 0.4), W - 1 - round(ap * 0.5), top + round(ap)], fill=BAS[3] + (255,))
    im.alpha_composite(b, (post, top + round(ap)))
    return im


if __name__ == '__main__':
    rng = np.random.default_rng(405)
    out = {
        'boulder_mg_a': reshade('art/gen/boulder_a.png', [INK, BAS[1], BAS[2], BAS[3], BAS[4]], [0.08, 0.18, 0.3, 0.46], green_to=2),
        'boulder_mg_b': reshade('art/gen/boulder_b.png', [INK, BAS[1], BAS[2], BAS[3], BAS[4]], [0.08, 0.18, 0.3, 0.46], green_to=2),
        'obsidian_mg': reshade('art/gen/crystal_cv.png', [INK] + OBS[1:], [0.1, 0.3, 0.5, 0.72]),
        'skel_mg': charred('art/gen/skel_cv.png'),
        'banner_mg': banner(),
        'basalt_a': columns([(9, 6, 8, 16), (19, 9, 9, 14), (13, 14, 8, 10), (24, 15, 7, 8)], 30, 30),
        'basalt_b': columns([(8, 7, 8, 11), (15, 11, 8, 8)], 22, 22),
        'vent_mg': vent(),
        'dc_ash_mg': ash(rng),
        'dc_splash_mg': splash(rng),
    }
    for n, im in out.items():
        a = np.asarray(im.convert('RGBA')).copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)   # hard alpha, as every prop since 327
        Image.fromarray(a).save(f'art/gen/{n}.png'); print('art/gen/%s.png' % n, im.size)
