#!/usr/bin/env python3
"""Magma crossing sprites (slabs, arch) re-laid onto the world art grid: cropped, box-downsampled to a few art rows, hard alpha,
at most 12 colours, a 1-art-pixel near-black contour outside the silhouette, then x4 nearest-neighbour. Rebuilt from art/old/
each run. Display height in live/sizes.js = 2 * (saved rows / 4).
  python3 tools/basalt_grid.py
"""
import os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd

INK = (8, 6, 8)
HEIGHTS = {'slab_mg_a': 12, 'slab_mg_b': 12, 'slab_mg_c': 10, 'arch_mg': 66}
COLORS = 12


def src(name):
    old = f'art/old/{name}.png'
    if not os.path.exists(old):
        shutil.copy(f'art/gen/{name}.png', old)
    return np.array(Image.open(old).convert('RGBA')).astype(np.float64)


def quantise(rgb, mask):
    px = rgb[mask]
    boxes = [px]
    while len(boxes) < COLORS:
        i = max(range(len(boxes)), key=lambda k: np.ptp(boxes[k], axis=0).max() * len(boxes[k]))
        b = boxes[i]
        if len(b) < 2 or np.ptp(b, axis=0).max() == 0:
            break
        ch = int(np.ptp(b, axis=0).argmax())
        b = b[b[:, ch].argsort()]
        h = len(b) // 2
        boxes[i:i + 1] = [b[:h], b[h:]]
    pal = np.array([b.mean(axis=0) for b in boxes])
    dark = px[px.sum(1).argmin()]
    pal[np.abs(pal - dark).sum(1).argmin()] = dark
    d = ((rgb[:, :, None, :] - pal[None, None]) ** 2).sum(-1)
    return pal[d.argmin(-1)]


def build(name, ha):
    a = src(name)
    ys, xs = np.where(a[..., 3] >= 128)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape[:2]
    wa = max(1, round(w * ha / h))
    pm = a[..., :3] * (a[..., 3:] / 255)
    pm = np.concatenate([pm, a[..., 3:] / 255], -1)
    ys = np.linspace(0, h, ha + 1).round().astype(int)
    xs = np.linspace(0, w, wa + 1).round().astype(int)
    out = np.zeros((ha, wa, 4))
    for j in range(ha):
        for i in range(wa):
            out[j, i] = pm[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].reshape(-1, 4).mean(0)
    cov = out[..., 3]
    m = cov >= 0.5
    lab, n = nd.label(m, np.ones((3, 3)))
    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    m &= sizes[lab] > 1
    rgb = out[..., :3] / np.maximum(cov, 1e-6)[..., None]
    rgb = quantise(np.clip(rgb, 0, 255), m)
    res = np.zeros((ha + 4, wa + 4, 4), np.uint8)
    mm = np.pad(m, 2)
    ring = nd.binary_dilation(mm, np.ones((3, 3))) & ~mm
    res[2:-2, 2:-2, :3] = np.round(rgb)
    res[mm] = np.concatenate([np.pad(np.round(rgb), ((2, 2), (2, 2), (0, 0)))[mm], np.full((mm.sum(), 1), 255)], 1)
    res[ring] = (*INK, 255)
    res = np.pad(res, ((1, 1), (1, 1), (0, 0)))
    res = res.repeat(4, 0).repeat(4, 1)
    Image.fromarray(res, 'RGBA').save(f'art/gen/{name}.png')
    return res.shape[0] // 4, res.shape[1] // 4


if __name__ == '__main__':
    for k, v in HEIGHTS.items():
        r, c = build(k, v)
        print(k, f'{c}x{r} art px, display height {2 * r}')
