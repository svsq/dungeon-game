"""CIELab (D65) round trip for part post-fixes, the same space as the critics' measures (tools/measure/fidelity/labc.py), and the
source/install bookkeeping the *_2152.py / *_2154.py fixes share: every fix reads the frozen copy art/old/<name>-<STAMP>.png when it
exists, so running it again starts from the same pixels instead of fixing a fix (FRESH: art/gen is the source and is frozen again)."""
import os, shutil
import numpy as np
from PIL import Image

M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
WP = np.array([0.95047, 1.0, 1.08883])
FRESH = False


def lab(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = c @ M.T / WP; f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return 116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])


def rgb(L, A, B):
    fy = (L + 16) / 116; fx, fz = fy + A / 500, fy - B / 200
    f = np.stack([fx, fy, fz], -1); xyz = np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27)) * WP
    c = np.clip(xyz @ np.linalg.inv(M).T, 0, 1); c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255)


def lch(L, A, B):
    return np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360


def source(name, stamp):
    old = f'art/old/{name}-{stamp}.png'
    return np.array(Image.open(old if os.path.exists(old) and not FRESH else f'art/gen/{name}.png').convert('RGBA'))


def write(name, arr, stamp, out):
    """out is a scratch folder, or 'install': art/gen, the untouched original frozen in art/old first"""
    if out != 'install':
        os.makedirs(out, exist_ok=True); Image.fromarray(arr.astype(np.uint8)).save(os.path.join(out, name + '.png')); return
    old = f'art/old/{name}-{stamp}.png'
    if FRESH or not os.path.exists(old): shutil.copy(f'art/gen/{name}.png', old)
    Image.fromarray(arr.astype(np.uint8)).save(f'art/gen/{name}.png')
