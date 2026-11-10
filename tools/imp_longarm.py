#!/usr/bin/env python3
"""Longer imp forearms (TASKS 1638): the throw's hand could not clear the head. Run once before tools/imp_ink.py.
  python3 tools/imp_longarm.py
"""
import glob
import json
import os
import re

import numpy as np
from PIL import Image
from scipy import ndimage as nd

PAD = 20
SPLIT = 0.55
GROW = {'L': (-15, 20), 'R': (10, 25)}
RIGS = 'live/rigs.js'


def pad(a):
    return np.pad(a, ((0, 0), (PAD, PAD), (0, 0)))


def extend(a, elbow, hand, delta):
    dv = np.subtract(hand, elbow, dtype=float)
    length = np.hypot(*dv)
    d = dv / length
    sx, sy = np.array(elbow) + d * length * SPLIT
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    past = (xs - sx) * d[0] + (ys - sy) * d[1] >= 0
    out = a.copy()
    out[past] = 0
    fx, fy = xs - delta[0], ys - delta[1]
    ok = past & (fx >= 0) & (fy >= 0) & (fx < w) & (fy < h)
    out[ok] = a[fy[ok], fx[ok]]
    lab, _ = nd.label(out[..., 3] > 0, np.ones((3, 3)))
    out[lab != 1 + int(np.bincount(lab.ravel())[1:].argmax())] = 0
    return out


def main():
    text = open(RIGS, encoding='utf-8').read()
    rigs = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', text.strip()))
    rig = rigs['imp']
    if rig['w'] != 307:
        raise SystemExit('already extended')
    for key, value in rig.items():
        if isinstance(value, list) and len(value) == 2 and all(isinstance(v, (int, float)) for v in value):
            rig[key] = [value[0] + PAD, value[1]]
    rig['w'] += 2 * PAD
    for side, delta in GROW.items():
        elbow, hand = rig['elbow' + side], rig['hand' + side]
        rig['hand' + side] = [hand[0] + delta[0], hand[1] + delta[1]]
        GROW[side] = (delta, elbow, hand)
    for path in glob.glob('art/old/imp__*.png') + glob.glob('art/gen/impE__*.png'):
        a = pad(np.array(Image.open(path).convert('RGBA')))
        name = os.path.basename(path)
        for side, (delta, elbow, hand) in GROW.items():
            if name.endswith(f'__farm{side}.png') and a[..., 3].any():
                a = extend(a, elbow, hand, delta)
        Image.fromarray(a).save(path)
    open(RIGS, 'w', encoding='utf-8').write('window.RIGS = ' + json.dumps(rigs) + ';\n')


main()
