#!/usr/bin/env python3
"""Author remark 11 (r5, task 2204): the mage's far (weapon, screen-right) arm. Reads layers_r4.cjs DUMP output for a window round shR:
python3 tools/measure/chars_assets/farsleeve_r5.py <window.png> (its .json beside it)
Blue (robe) pixels by owner: the torso's far shoulder (body pixels right of the window's centre line), the torso's front (left of it),
the upper arm uarmR; mean Lab of each and ΔE to the front; the dark (L* < 22) px share of each owner; and the dark px in the 2-texel
band where uarmR/cuffR/fistR meet the body (the seam the author sees)."""
import sys, json, numpy as np
from PIL import Image
p = sys.argv[1]; d = json.load(open(p[:-4] + '.json')); W, H = d['W'], d['H']; own = np.array(d['own']).reshape(H, W); names = d['names']
a = np.asarray(Image.open(p).convert('RGB')).astype(float) / 255
l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
X = l @ [0.4124, 0.3576, 0.1805] / 0.95047; Y = l @ [0.2126, 0.7152, 0.0722]; Z = l @ [0.0193, 0.1192, 0.9505] / 1.08883
f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
Lab = np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
idx = lambda rx: np.isin(own, [i for i, n in enumerate(names) if __import__('re').search(rx, n)])
body, arm, rparts = idx(r'__body'), idx(r'uarmR'), idx(r'uarmR|cuffR|fistR')
blue = (Lab[..., 2] < -12) & (Lab[..., 0] >= 22)
xs = np.arange(W)[None, :].repeat(H, 0); mid = W * 0.5
groups = {'torso front (blue)': body & blue & (xs < mid), 'torso far shoulder (blue)': body & blue & (xs >= mid), 'uarmR (blue)': arm & blue}
ref = Lab[groups['torso front (blue)']].mean(0)
for k, m in groups.items():
    if m.sum(): v = Lab[m].mean(0); print(f'{k:28s} px {m.sum():5d}  Lab {v.round(1)}  dE vs front {np.linalg.norm(v - ref):.1f}')
    else: print(f'{k:28s} px 0')
for k, rx in [('uarmR', 'uarmR'), ('cuffR', 'cuffR'), ('fistR', 'fistR')]:
    m = idx(rx); print(f'{k:6s} px {m.sum():5d} dark share {((Lab[..., 0] < 22) & m).sum() / max(1, m.sum()):.2f}')
from scipy.ndimage import binary_dilation
band = binary_dilation(rparts, iterations=2) & body
print('seam band (body px within 2 texels of the arm parts):', band.sum(), 'dark', ((Lab[..., 0] < 22) & band).sum(), f'= {((Lab[..., 0] < 22) & band).sum() / 4.2857 ** 2:.1f} world px²')
