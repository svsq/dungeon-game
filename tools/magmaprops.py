#!/usr/bin/env python3
"""Magma caves' props re-shaded from the project's own art (TASKS 405); the basalt columns, the vent and the ash and splash
decals are Codex art since 421.
  boulder_mg_a/b  boulder_a/b re-shaded by luminance into the bible's basalt ramp, the moss and fern taken to dark stone
  skel_mg         skel_cv charred: bone to ash grey, cloth and rock to near-black, a few dull embers in the dark
  obsidian_mg     crystal_cv re-shaded into black volcanic glass with violet-grey glints
  banner_mg       the cult banner hung from a crossbar between two iron posts (it stands on the plateau, no wall to hang on)
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
    out = {
        'boulder_mg_a': reshade('art/gen/boulder_a.png', [INK, BAS[1], BAS[2], BAS[3], BAS[4]], [0.08, 0.18, 0.3, 0.46], green_to=2),
        'boulder_mg_b': reshade('art/gen/boulder_b.png', [INK, BAS[1], BAS[2], BAS[3], BAS[4]], [0.08, 0.18, 0.3, 0.46], green_to=2),
        'obsidian_mg': reshade('art/gen/crystal_cv.png', [INK] + OBS[1:], [0.1, 0.3, 0.5, 0.72]),
        'skel_mg': charred('art/gen/skel_cv.png'),
        'banner_mg': banner(),
    }
    for n, im in out.items():
        a = np.asarray(im.convert('RGBA')).copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)   # hard alpha, as every prop since 327
        Image.fromarray(a).save(f'art/gen/{n}.png'); print('art/gen/%s.png' % n, im.size)
