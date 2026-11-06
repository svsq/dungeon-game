#!/usr/bin/env python3
"""Salamander light from the top left (as tools/tone_colossus.py does for the colossus) and two pale eyes on the head. The glowing
orange seams are left alone; the left edges of every part go lighter, the right edges darker, a faint slope across the whole.
Rebuilt from art/old/ each run. The eyes go on salamanderE__body too, so they brighten with the breath.
  python3 tools/salamander_tone.py
"""
import os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd

PARTS = ['salamander__body', 'salamander__legA', 'salamander__legB']
EYE = (255, 226, 140)
CELL = 6
EYES = [(30, 36), (30, 62)]
LIFT, BAND = 0.3, 14


def src(name):
    old = f'art/old/{name}.png'
    if not os.path.exists(old):
        shutil.copy(f'art/gen/{name}.png', old)
    return np.array(Image.open(old).convert('RGBA'))


def tone(a):
    rgb = a[..., :3].astype(float); m = a[..., 3] > 128
    hot = (rgb[..., 0] > 190) & (rgb[..., 1] > 60) & (rgb[..., 0] - rgb[..., 2] > 100)
    s = nd.gaussian_filter(m.astype(float), 8); dx = nd.sobel(s, 1)
    depth = nd.distance_transform_edt(m)
    near = np.clip(1 - (depth - 1) / BAND, 0, 1)
    wedge = np.clip(dx / 0.05, -1, 1)
    h, w = m.shape
    slope = 0.12 * (1 - (np.arange(w)[None, :] / w + np.arange(h)[:, None] / h))
    f = 1 + LIFT * np.where(wedge > 0, wedge * 1.6, wedge * 1.0) * near + slope
    ink = rgb @ [0.3, 0.59, 0.11] < 45
    f = np.where(ink & (f > 1), 1.0, f)
    out = rgb * f[..., None]
    low = ~hot & m
    a[low, :3] = np.clip(out[low], 0, 255).astype(np.uint8)
    return a


def eyes(a):
    for y, x in EYES:
        a[y:y + CELL, x:x + CELL, :3] = EYE; a[y:y + CELL, x:x + CELL, 3] = 255
    return a


if __name__ == '__main__':
    for n in PARTS:
        a = tone(src(n))
        if n.endswith('body'): a = eyes(a)
        Image.fromarray(a).save(f'art/gen/{n}.png'); print(n)
    Image.fromarray(eyes(src('salamanderE__body'))).save('art/gen/salamanderE__body.png'); print('salamanderE__body')
