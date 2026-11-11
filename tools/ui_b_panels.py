#!/usr/bin/env python3
"""Kit B panels (TASKS 1734, 1743): the leather and torn parchment nine-slices lose the stains and scratches of their stretched
middle, and get a tiling wear layer drawn over that middle at the kit's own art pixel.
  - art/old/ui_b_leather_panel.png, art/old/ui_b_parchment_torn.png (the generated originals) → art/gen/ same names: marks
    inside the border and outside the four corners are painted over with the smoothed paper or leather tone. The middle of a
    nine-slice is stretched up to ten times, so a 5 px stain there became a 50 px pale rectangle with straight edges.
  - art/gen/ui_b_leather_wear_tex.png, art/gen/ui_b_paper_fibre_tex.png: 128×128 art px tiles, 8 src px to an art px,
    transparent but for a mottle, scratches or fibres and specks a few tones off the base; hud_kit.js tiles them over a panel's middle, so the
    texture keeps one art pixel (KIT.PX) whatever the window's size.
  python3 tools/ui_b_panels.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CELL, ART = 8, 128
PANELS = {
    # border depth in src px from the alpha edge that is never touched (stitches, torn and burnt rim); the corner slice is 24 of 96
    'ui_b_leather_panel': {'border': 58},
    'ui_b_parchment_torn': {'border': 96},
}


def clean(name, border):
    a = np.array(Image.open(f'art/old/{name}.png').convert('RGBA')).astype(np.float32)
    op = a[..., 3] > 128
    ys, xs = np.where(a[..., 3] > 0)
    x0, y0, x1, y1 = max(0, xs.min() - 4), max(0, ys.min() - 4), xs.max() + 5, ys.max() + 5
    cw, ch = (x1 - x0) * 24 / 96, (y1 - y0) * 24 / 96
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    corner = ((xx < x0 + cw) | (xx >= x1 - cw)) & ((yy < y0 + ch) | (yy >= y1 - ch))
    inner = (ndimage.distance_transform_edt(op) > border) & ~corner
    rgb = a[..., :3]
    med = np.median(rgb[inner], axis=0)
    off = np.abs(rgb - med).sum(-1) > 9
    bad = ndimage.binary_dilation(off & inner, iterations=4) & inner
    good = (inner & ~bad).astype(np.float32)
    bg = np.stack([ndimage.gaussian_filter(rgb[..., c] * good, 40) for c in range(3)], -1) / np.maximum(ndimage.gaussian_filter(good, 40), 1e-3)[..., None]
    rgb[bad] = bg[bad]
    a[..., :3] = rgb
    Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)).save(f'art/gen/{name}.png')
    print(name, 'base', med.round(), 'painted over', int(bad.sum()), 'px')
    return med


def torus_noise(rng, n, octaves):
    yy, xx = np.mgrid[0:n, 0:n] / n * 2 * np.pi
    v = np.zeros((n, n))
    for f in octaves:
        for _ in range(3):
            fx, fy = rng.integers(-f, f + 1, 2)
            if fx == 0 and fy == 0: fx = f
            v += np.cos(fx * xx + fy * yy + rng.uniform(0, 2 * np.pi)) / f
    return (v - v.mean()) / v.std()


def line(rng, m, tone, length, ang):
    x, y = rng.uniform(0, ART, 2)
    for i in range(length):
        m[int(y + i * np.sin(ang)) % ART, int(x + i * np.cos(ang)) % ART] = tone


def tile(name, tones, seed, blot, marks):
    rng = np.random.default_rng(seed)
    m = np.zeros((ART, ART), np.int8)
    nz = torus_noise(rng, ART, (5, 8, 13))
    m[nz > blot[0]] = 2
    m[nz < -blot[1]] = 1
    for tone, count, (l0, l1), (a0, a1) in marks:
        for _ in range(count):
            line(rng, m, tone, int(rng.integers(l0, l1 + 1)), rng.uniform(a0, a1) * (1 if rng.random() < 0.5 else -1))
    out = np.zeros((ART, ART, 4), np.uint8)
    for k, c in tones.items():
        out[m == k] = c
    Image.fromarray(out).resize((ART * CELL, ART * CELL), Image.NEAREST).save(f'art/gen/{name}.png')
    print(name, {k: round(float((m == k).mean()), 3) for k in tones})


clean('ui_b_leather_panel', PANELS['ui_b_leather_panel']['border'])
clean('ui_b_parchment_torn', PANELS['ui_b_parchment_torn']['border'])
# opaque marks in fixed tones a few steps off the panel's base, as the near-flat leather and paper of ref_ui_inv_b: a soft
# mottle a step darker and lighter, then sparse scratches or fibres and specks; marks at partial alpha drew a pale ring in the
# sprite shader where two of them met
tile('ui_b_leather_wear_tex', {1: (73, 32, 26, 255), 2: (87, 41, 33, 255), 3: (99, 50, 39, 255), 4: (62, 27, 22, 255)}, 1743,
     (1.15, 1.15), [(4, 60, (1, 1), (0, 0)), (3, 22, (2, 4), (0.4, 1.1)), (4, 14, (2, 3), (0.4, 1.1))])
tile('ui_b_paper_fibre_tex', {1: (190, 168, 134, 255), 2: (205, 186, 153, 255), 3: (176, 152, 116, 255), 4: (160, 136, 101, 255)}, 1734,
     (1.15, 1.1), [(4, 40, (1, 1), (0, 0)), (3, 45, (3, 6), (0, 0.3)), (2, 30, (3, 5), (0, 0.3))])
