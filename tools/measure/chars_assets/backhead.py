"""TASKS 2199: the mage's hair under the circlet from behind against the back of the bare head, by the hair alone.
python3 tools/measure/chars_assets/backhead.py [rig]
The light px (CIELab L over 45) of the top 40 rows of <rig>__head_back_ci and <rig>__body_back, the circlet's band (OKLab chroma 0.075 and
over: its gold and the brown ends) and one px round it left out. fix2193/hair.py counted the band's gold in (chars_assets_r4.md 4, ΔE 8.9
with the target under 8) and its own «hair only» kept the band's warm fringe px; here: mean Lab and ΔE, ΔE in a, b alone, and the share
of hair px further than 3 in a, b from the bare head's mean (the warm patches)."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import gridify_2155 as G

ROWS, BAND, LIGHT, WARM = 40, 0.075, 45, 3


def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.9505, 1, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def hair(n):
    a = np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float)[:ROWS]; op = a[..., 3] >= 128
    o = G.oklab(a[..., :3]); band = op & (np.hypot(o[..., 1], o[..., 2]) >= BAND); L = lab(a[..., :3])
    return L[op & ~nd.binary_dilation(band) & (L[..., 0] > LIGHT)]


rig = sys.argv[1] if len(sys.argv) > 1 else 'mage'
b, f = hair(f'{rig}__head_back_ci'), hair(f'{rig}__body_back'); mb, mf = b.mean(0), f.mean(0)
warm = (np.hypot(b[:, 1] - mf[1], b[:, 2] - mf[2]) > WARM).mean()
print(f'{rig}: under the circlet {len(b)} px Lab {mb.round(1)}   bare head {len(f)} px Lab {mf.round(1)}   dE {np.linalg.norm(mb - mf):.1f}   '
      f'dE a,b {np.linalg.norm(mb[1:] - mf[1:]):.1f}   off by over {WARM} in a,b {warm:.0%}')
