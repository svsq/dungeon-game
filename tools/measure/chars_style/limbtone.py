"""Tone of left against right limb parts per class: python3 tools/measure/chars_style/limbtone.py
For each pair (uarm, farm, thigh, shin, foot) of the world rig textures art/gen/<pre>__<part>{L,R}.png and of their _menu copies:
mean Lab of the opaque pixels (outline, L < 12, left out) and the CIE76 distance between the two sides."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402


def mean_lab(path):
    if not os.path.exists(path):
        return None
    a = np.asarray(Image.open(path).convert('RGBA')).astype(float)
    p = a[..., :3][a[..., 3] > 127]
    L, A, B = lab(p)
    k = L > 12
    return np.array([L[k].mean(), A[k].mean(), B[k].mean()])


for pre in ['hero', 'archer', 'mage']:
    for suf in ['', '_menu']:
        row = []
        for part in ['uarm', 'farm', 'thigh', 'shin', 'foot']:
            l, r = (mean_lab(os.path.join(ROOT, 'art/gen', f'{pre}__{part}{s}{suf}.png')) for s in 'LR')
            row.append(f'{part} --' if l is None or r is None else f'{part} dL {l[0] - r[0]:+5.1f} dE {np.linalg.norm(l - r):4.1f}')
        print(f'{pre + suf:12s} ' + ' | '.join(row))
