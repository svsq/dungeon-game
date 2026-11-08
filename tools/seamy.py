#!/usr/bin/env python3
"""Vertical wrap seam of a tiling texture healed by the half-tile shift: roll by half the height so the seam is a band in the
middle, refill that band from a cross-fade of the rows mirrored from above and from below (both continue the rows next to the
band), roll back. Rebuilt from art/old/ each run.
  python3 tools/seamy.py [name ...]
"""
import os, shutil, sys
import numpy as np
from PIL import Image

B = 6


def heal(a, b=B):
    h = a.shape[0]; c = h // 2
    r = np.roll(a.astype(float), h // 2, axis=0)
    t = np.arange(2 * b)
    top = r[c - b - 1 - t]
    bot = r[c + b + (2 * b - 1 - t)]
    u = ((t + 0.5) / (2 * b))[:, None, None]; u = u * u * (3 - 2 * u)
    r[c - b:c + b] = top * (1 - u) + bot * u
    return np.roll(np.clip(r, 0, 255).astype(np.uint8), -(h // 2), axis=0)


if __name__ == '__main__':
    for n in sys.argv[1:] or ['floor_mg_tex', 'walltop_mg_tex']:
        old = f'art/old/{n}.png'
        if not os.path.exists(old): shutil.copy(f'art/gen/{n}.png', old)
        Image.fromarray(heal(np.array(Image.open(old).convert('RGB')))).save(f'art/gen/{n}.png'); print(n)
