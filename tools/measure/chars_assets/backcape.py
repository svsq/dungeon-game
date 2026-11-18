# python3 tools/measure/chars_assets/backcape.py: (r3) the warrior's back cape with and without a helm: mean Lab of the opaque pixels
# below the shoulders (rows 120..340) of each hero__body_back* texture and its _nh twin (drawn under any helm), ΔE between the twins
import os, sys; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backhair import lab
def m(n):
    a = np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float)[120:340]; op = a[..., 3] > 128
    return lab(a[..., :3][op]).mean(0), int(op.sum())
for rig in ('hero', 'archer', 'mage'):
    for s in ('', '_cl', '_pw', '_hd', '_le'):
        n = f'{rig}__body_back{s}'
        if os.path.exists(f'live/assets/{n}.png') and os.path.exists(f'live/assets/{n}_nh.png'):
            (a, pa), (b, pb) = m(n), m(n + '_nh')
            print(f'{n:22s} Lab {a.round(1)} px {pa:5d}   _nh Lab {b.round(1)} px {pb:5d}   dE {np.linalg.norm(a - b):4.1f}')
