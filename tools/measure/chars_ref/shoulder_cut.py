"""ref critic r3: a cut at the shoulder shows as background inside the hero's outline. For every grabbed view: background pixels
   enclosed by the hero (holes of its mask) and notches open to the outside (the mask's closing minus the mask) within 0.07 H
   of each shoulder joint, in pixels and as a share of H^2 (x1000).
   python3 tools/measure/chars_ref/shoulder_cut.py [frames/critic_chars_r3_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r3_ref')
J = json.load(open(OUT / 'game/joints.json'))
worst = []
for v, r in J.items():
    if v == 'classes':
        continue
    j = r['joints']; bx, by = r['box'][:2]; at = r.get('at')
    k = at[2] if at else 1
    P = (lambda p: (at[0] + (p[0] - at[0]) * k - bx, at[1] + (p[1] - at[1]) * k - by)) if at else (lambda p: (p[0] - bx, p[1] - by))
    a = np.asarray(Image.open(OUT / f'game/{v}_all.png').convert('RGB')).astype(int)
    b = np.asarray(Image.open(OUT / f'game/{v}_none.png').convert('RGB')).astype(int)
    m = np.abs(a - b).sum(2) > 24
    m = ndi.binary_opening(m, iterations=1) | m & ndi.binary_dilation(ndi.binary_opening(m, iterations=1), iterations=1)
    H = (j['ground'][1] - j['top'][1]) * k
    holes = ndi.binary_fill_holes(m) & ~m
    rad = max(2, round(0.02 * H))
    notch = ndi.binary_closing(m, structure=np.ones((3, 3)), iterations=rad) & ~m & ~holes
    ys, xs = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    out = []
    for s in 'LR':
        x, y = P(j['sh' + s]); near = np.hypot(xs - x, ys - y) < 0.07 * H
        h, n = int((holes & near).sum()), int((notch & near).sum())
        out.append(f'{s}: holes {h:3d} notch {n:3d} px ({(h + n) / H / H * 1000:4.2f})')
        worst.append(((h + n) / H / H * 1000, v, s))
        if h + n > 0:
            c = np.asarray(Image.open(OUT / f'game/{v}_all.png').convert('RGB')).copy()
            c[(holes | notch) & near] = [0, 255, 0]
            x0, y0 = int(max(0, x - 0.12 * H)), int(max(0, y - 0.12 * H))
            t = Image.fromarray(c[y0:int(y + 0.12 * H), x0:int(x + 0.12 * H)])
            (OUT / 'cut').mkdir(exist_ok=True); t.resize((t.width * 6, t.height * 6), Image.NEAREST).save(OUT / f'cut/{v}_{s}.png')
    print(f'{v:26s} H={H:5.1f}  ' + '   '.join(out))
worst.sort(reverse=True)
print('worst:', ', '.join(f'{v} {s} {w:.2f}' for w, v, s in worst[:6]))
