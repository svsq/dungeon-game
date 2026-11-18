"""The warrior's red (cloak and tabard) in the 8 ways of the sandbox sheets (tools/measure/views2198/sheet.cjs, ×3, 12 frames × walk/run):
python3 tools/measure/chars_style/cape8.py DIR PREFIX
Per way and gait, over the 12 frames: red px (a* > 22, hue < 36 or > 340, L* < 50: boots fall out; art px), the lowest red row above the
soles (the cloak's hem, in art px; smaller = longer cloak), red mean Lab and dE76 to the rest-like way 'down' of the same gait."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

d, pre = sys.argv[1], sys.argv[2]
WAYS = ['down', 'down-right', 'right', 'up-right', 'up', 'up-left', 'left', 'down-left']
BG = np.array([52, 44, 40])
res = {}
for way in WAYS:
    im = np.asarray(Image.open(os.path.join(ROOT, d, f'{pre}_warrior_{way}.png')).convert('RGB')).astype(float)
    H, W = im.shape[:2]
    fw, fh = W // 12, H // 2
    for g, gait in enumerate(['walk', 'run']):
        n, hem, labs = [], [], []
        for i in range(12):
            f = im[g * fh:(g + 1) * fh - 6, i * fw:(i + 1) * fw - 6][::3, ::3]
            fig = np.abs(f - BG).sum(-1) > 6
            L, A, B = lab(f)
            h = np.degrees(np.arctan2(B, A)) % 360
            red = fig & (A > 22) & ((h < 36) | (h > 340)) & (L < 50)
            ys = np.where(fig.any(1))[0]
            ry = np.where(red.any(1))[0]
            n.append(red.sum()); hem.append(ys.max() - ry.max())
            labs.append([L[red].mean(), A[red].mean(), B[red].mean()])
        res[(way, gait)] = (np.mean(n), np.mean(hem), np.mean(labs, 0))
for gait in ['walk', 'run']:
    ref = res[('down', gait)][2]
    for way in WAYS:
        n, hem, c = res[(way, gait)]
        print(f"{gait:4} {way:10} red {n:6.1f} art px  hem {hem:4.1f} px above soles  Lab {c[0]:.1f} {c[1]:.1f} {c[2]:.1f}  dE to down {np.linalg.norm(c - ref):.1f}")
