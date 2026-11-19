"""ref critic r2: where the warrior's red cape shows beside the legs, per band of height, game arch/world against the refs.
   python3 tools/measure/chars_ref/cape.py [frames/critic_chars_r2_ref]"""
import os, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from measure import lab

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r2_ref')


def red(rgb):
    L = lab(rgb.astype(int)); C = np.hypot(L[..., 1], L[..., 2]); h = np.degrees(np.arctan2(L[..., 2], L[..., 1])) % 360
    return (C > 20) & ((h > 345) | (h < 40)) & (L[..., 0] > 8) & (L[..., 0] < 45) & (L[..., 1] > 1.2 * L[..., 2])


for n in ['ref_warrior_big', 'ref_warrior_small', 'hero_arch_warrior', 'hero_rest_warrior_right', 'hero_rest_warrior_nos_right']:
    im = np.asarray(Image.open(OUT / f'{n}.png').convert('RGB'))
    body = np.abs(im.astype(int) - np.array([28, 28, 36])).sum(2) > 6
    H = im.shape[0]; r = red(im) & body
    ys = np.nonzero(r.any(1))[0]
    low = (H - ys.max()) / H if len(ys) else float('nan')
    rows = []
    for f0, f1 in [(0.55, 0.65), (0.65, 0.75), (0.75, 0.85)]:
        b = r[int(f0 * H):int(f1 * H)]; cols = np.nonzero(b.any(0))[0]
        bb = body[int(f0 * H):int(f1 * H)]; bc = np.nonzero(bb.any(0))[0]
        rows.append(f'{f0:.2f}-{f1:.2f}: red {b.mean() / max(bb.mean(), 1e-9) * 100:4.1f}% of body, red x {cols.min() / H if len(cols) else -1:.2f}..{cols.max() / H if len(cols) else -1:.2f} body x {bc.min() / H:.2f}..{bc.max() / H:.2f}')
    print(n, f'H={H} red hem above soles {low:.3f} H'); print('   ' + '\n   '.join(rows))
