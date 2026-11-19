"""TASKS 2193: the mage's grey hair under the circlet. python3 tools/measure/fix2193/hair.py
back: the light px (CIELab L > 45) of the top 40 rows of mage__head_back_ci against mage__body_back (the back of the bare head): mean
Lab and ΔE (chars_assets_r4.md finding 4, target under 8), and the same over the hair alone, without the circlet's gold band. arch: the grey hair px (OKLab chroma under 0.075, L over 0.38) of the head
rows of mage__head_ci_menu and of mage__body_menu: mean RGB and green minus the mean of red and blue (chars_menu_r4.md 5: lilac under
the circlet −22.4, the bare head −12.9; target no lower than −13)."""
import os, sys
import numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import gridify_2155 as G
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.9505, 1, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
load = lambda n: np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float)
def light(n, rows=40, hair=False):
    a = load(n)[:rows]; o = G.oklab(a[..., :3]); m = (a[..., 3] > 128) & (lab(a[..., :3])[..., 0] > 45)
    if hair: m &= np.hypot(o[..., 1], o[..., 2]) < 0.075
    return lab(a[..., :3])[m].mean(0)
def grey(n, rows=60):
    a = load(n)[:rows]; op = a[..., 3] >= 128; o = G.oklab(a[..., :3]); C = np.hypot(o[..., 1], o[..., 2]); m = op & (C < 0.075) & (o[..., 0] > 0.38)
    px = a[..., :3][m]; mu = px.mean(0); return mu, mu[1] - (mu[0] + mu[2]) / 2, int(m.sum())
if __name__ == '__main__':
    b, f = light('mage__head_back_ci'), light('mage__body_back')
    print(f'back: head_back_ci Lab {b.round(1)}  body_back Lab {f.round(1)}  dE {np.linalg.norm(b - f):.1f} (the circlet\'s gold band counted)')
    b, f = light('mage__head_back_ci', hair=True), light('mage__body_back', hair=True)
    print(f'back, hair only (OKLab chroma under 0.075): head_back_ci Lab {b.round(1)}  body_back Lab {f.round(1)}  dE {np.linalg.norm(b - f):.1f}')
    for n in ('mage__head_ci_menu', 'mage__body_menu'):
        mu, g, k = grey(n); print(f'arch: {n:20s} grey px {k:4d}  mean RGB {mu.round(0)}  G - (R+B)/2 {g:+.1f}')
