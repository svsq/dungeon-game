"""Colour of the top 18% of a back-view body texture (the back of the head) at two git revisions:
python3 tools/measure/chars_style/backhead.py REV [part ...]   (default parts: mage, archer, hero __body_back)
Prints mean Lab and the share of grey hair (C < 12, L > 45) and of warm skin-like pixels (C > 25, hue 45..75) before (REV) and now."""
import io
import os
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

rev = sys.argv[1]
parts = sys.argv[2:] or ['mage__body_back', 'archer__body_back', 'hero__body_back']


def band(im):
    a = np.asarray(im.convert('RGBA')).astype(float)
    m = a[..., 3] > 127
    ys = np.where(m.any(1))[0]
    top, h = ys.min(), int((ys.max() - ys.min()) * 0.18)
    p = a[top:top + h][m[top:top + h]][:, :3]
    p = p[p.sum(1) > 90]
    L, A, B = lab(p)
    C, hue = np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360
    return f'L {L.mean():3.0f} a {A.mean():3.0f} b {B.mean():3.0f}  grey {((C < 12) & (L > 45)).mean():4.0%}  warm {((C > 25) & (hue > 45) & (hue < 75)).mean():4.0%}'


for n in parts:
    path = f'art/gen/{n}.png'
    old = Image.open(io.BytesIO(subprocess.run(['git', 'show', f'{rev}:{path}'], cwd=ROOT, capture_output=True, check=True).stdout))
    print(f'{n:20s} {rev}: {band(old)}   now: {band(Image.open(os.path.join(ROOT, path)))}')
