#!/usr/bin/env python3
"""The fire priest's rig parts (TASKS 410), recoloured from the cultist's, as the reference's priest at the altar is the cultist
in a dark crimson hood. Codex generation was out of quota (TASKS 421), and the cultist's cut and pivots are approved already.
  the olive robe → the reference's maroon, value kept (its folds and rim stay); the staff's wood → charred black with a dull red
  grain (its fire is the scene's); bone, skin, leather and the trims stay as painted
  python3 tools/priest.py && python3 tools/prep.py --only priest__body,priest__farmL,priest__uarmR,priest__farmR
"""
import numpy as np
from PIL import Image

MAROON = np.array([1.0, 0.22, 0.38])
CHAR = [(10, 8, 9), (26, 20, 20), (44, 32, 30), (70, 44, 36)]


def recolour(src, staff):
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    L = (0.3 * r + 0.55 * g + 0.15 * b) / 255.0
    out = a.copy()
    robe = (g >= r - 6) & (g > b + 4) & (g > 10) & (a[..., 3] > 0)
    v = np.maximum(np.maximum(r, g), b)[robe]
    out[robe, :3] = np.clip((v * 0.95)[:, None] * MAROON, 0, 255)
    if staff:
        wood = (r > g + 12) & (g >= b) & (L < 0.42) & (a[..., 3] > 0) & ~robe
        lv = np.digitize(L, [0.1, 0.2, 0.3])
        for i, c in enumerate(CHAR):
            out[wood & (lv == i), :3] = c
    return Image.fromarray(out.astype(np.uint8))


if __name__ == '__main__':
    for n in ['body', 'farmL', 'uarmR', 'farmR']:
        recolour(f'art/gen/cultist__{n}.png', n == 'farmL').save(f'art/gen/priest__{n}.png')
    print('priest parts → art/gen/priest__*.png')
