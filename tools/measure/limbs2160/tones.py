# python3 tools/measure/limbs2160/tones.py [--menu]: mean CIELab of each L limb part against its R twin, every rig and outfit (TASKS 2160)
import glob, os, re, sys
import numpy as np
from PIL import Image

def lab(px):
    c = px[:, :3] / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / np.array([0.9505, 1, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)

def mean(path):
    a = np.asarray(Image.open(path).convert('RGBA'), dtype=float).reshape(-1, 4)
    a = a[a[:, 3] > 200]
    return lab(a).mean(0) if len(a) else None

menu = '--menu' in sys.argv
worst = 0
for p in sorted(glob.glob('live/assets/*__*L*.png')):
    n = os.path.basename(p)[:-4]
    if not re.match(r'^(hero|mage|archer)__(uarm|farm|thigh|shin|foot)L', n) or n.endswith('_w') or n.endswith('_menu') != menu: continue
    q = p.replace('L', 'R', 1) if False else os.path.join('live/assets', re.sub(r'__(uarm|farm|thigh|shin|foot)L', r'__\1R', n) + '.png')
    if not os.path.exists(q): continue
    a, b = mean(p), mean(q)
    d = float(np.linalg.norm(a - b)); worst = max(worst, d)
    print(f'{n:28s} L {a[0]:5.1f} {a[1]:5.1f} {a[2]:5.1f}  R {b[0]:5.1f} {b[1]:5.1f} {b[2]:5.1f}  dE {d:4.1f}  dL {b[0]-a[0]:+5.1f}')
print('worst dE', round(worst, 2))
