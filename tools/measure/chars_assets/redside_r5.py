#!/usr/bin/env python3
"""Author remark 8 (r5): the warrior arch's near torso side under the arm. python3 tools/measure/chars_assets/redside_r5.py <arch frame.png> [x0 y0 x1 y1]
Counts red flat pixels (R > 1.5 G, R > 70) in the window, their Lab mean and spread (std of L*, the quilting's texture), against the
sheet's gambeson (art/char_refs/warrior_a_v2.png quilted skirt) and the sheet's strip under the arm (the dark cape between sleeve and
breastplate)."""
import sys, numpy as np
from PIL import Image
def lab(a):
    a = a / 255.; l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = l @ [0.4124, 0.3576, 0.1805] / 0.95047; Y = l @ [0.2126, 0.7152, 0.0722]; Z = l @ [0.0193, 0.1192, 0.9505] / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
def red(a): return (a[..., 0] > 1.5 * a[..., 1]) & (a[..., 0] > 70)
def stat(name, a, m):
    L = lab(a.astype(float))[m]; print(f'{name:34s} px {m.sum():6d}  Lab mean {L.mean(0).round(1)}  L* std {L[:, 0].std():.1f}'); return L.mean(0)
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
x0, y0, x1, y1 = map(int, sys.argv[2:6]) if len(sys.argv) > 5 else (860, 545, 880, 600)
w = im[y0:y1, x0:x1]; g = stat('game strip window', w, red(w))
ref = np.asarray(Image.open('art/char_refs/warrior_a_v2.png').convert('RGB')).astype(float)
q = ref[480:560, 330:420]; rq = stat('sheet gambeson (quilted skirt)', q, red(q))
s = ref[265:330, 330:350]; rs = stat('sheet strip under arm (cape)', s, red(s) | (s.sum(-1) < 120))
print('dE76 game vs gambeson', np.linalg.norm(g - rq).round(1), ' vs sheet strip', np.linalg.norm(g - rs).round(1))
