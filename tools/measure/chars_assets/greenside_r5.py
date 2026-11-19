#!/usr/bin/env python3
"""Author remark 10 (r5, task 2203): the archer arch's near torso side under the arm, olive like the mantle behind it.
python3 tools/measure/chars_assets/greenside_r5.py <arch frame.png> [x0 y0 x1 y1]: olive px (G >= R, G > B + 15) in the window per row,
their Lab, against the sheet (art/char_refs/archer_a.png): the dark olive between the near sleeve and the jerkin, and the jerkin."""
import sys, numpy as np
from PIL import Image
def lab(a):
    a = a / 255.; l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = l @ [0.4124, 0.3576, 0.1805] / 0.95047; Y = l @ [0.2126, 0.7152, 0.0722]; Z = l @ [0.0193, 0.1192, 0.9505] / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
olive = lambda a: (a[..., 1] >= a[..., 0]) & (a[..., 1] > a[..., 2] + 15)
im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
x0, y0, x1, y1 = map(int, sys.argv[2:6]) if len(sys.argv) > 5 else (862, 545, 880, 590)
w = im[y0:y1, x0:x1]; m = olive(w); g = lab(w)[m].mean(0)
print('game window olive px', m.sum(), 'of', m.size, ' per row', [int(r.sum()) for r in m[::4]], ' Lab', g.round(1), 'L* std', lab(w)[m][:, 0].std().round(1))
ref = np.asarray(Image.open('art/char_refs/archer_a.png').convert('RGB')).astype(float)
s = ref[300:400, 343:355]; ms = olive(s) | (s.sum(-1) < 150); rs = lab(s)[ms].mean(0); print('sheet gap under arm Lab', rs.round(1))
j = ref[290:380, 370:420]; rj = lab(j).reshape(-1, 3).mean(0); print('sheet jerkin Lab', rj.round(1))
print('dE game vs sheet gap', np.linalg.norm(g - rs).round(1), ' vs jerkin', np.linalg.norm(g - rj).round(1))
