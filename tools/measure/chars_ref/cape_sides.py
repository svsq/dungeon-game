"""ref critic r3: the warrior's red cape on each side of the legs, per band of height: the red area left and right of the hips'
   middle in shares of H^2 (x1000), and how far it reaches out past the outer edge of the leg on that side (in H).
   Game hips from the rig trace (grab.mjs), the sheet's from measure.py's landmarks; a red-mask overlay sheet for the eye.
   python3 tools/measure/chars_ref/cape_sides.py [frames/critic_chars_r3_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from measure import REF
from cape import red
from pairs import refmask, REF as PAIRS_REF

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r3_ref')
J = json.load(open(OUT / 'game/joints.json'))


def hips_of(name, im_h):
    if name.startswith('ref'):
        r = REF['warrior']; rgb, m = refmask('art/char_refs/warrior_a_v2.png'); x0, y0, x1, y1 = PAIRS_REF['warrior'][1]
        ox = np.nonzero(m[y0:y1, x0:x1].any(0))[0].min()
        return [r[k][0] - ox for k in ('hipL', 'hipR', 'ankleL', 'ankleR')], 0
    v = name[len('hero_'):]; j = J[v]['joints']; box = J[v]['box']; k = J[v]['at'][2] if v.startswith('arch') else 1
    at = J[v]['at'] if v.startswith('arch') else None
    tr = (lambda p: at[0] + (p[0] - at[0]) * k - box[0]) if at else (lambda p: p[0] - box[0])
    m = np.load(OUT / f'mask_{v}.npy'); a = np.asarray(Image.open(OUT / f'game/{v}_all.png').convert('RGB')).astype(int)
    b = np.asarray(Image.open(OUT / f'game/{v}_none.png').convert('RGB')).astype(int)
    full = np.abs(a - b).sum(2) > 6; xs = np.nonzero(full.any(0))[0]
    return [tr(j[n]) - xs.min() for n in ('hipL', 'hipR', 'ankleL', 'ankleR')], 0


tiles = []
for n in ['ref_warrior_big', 'ref_warrior_small', 'hero_arch_warrior', 'hero_rest_warrior_right', 'hero_rest_warrior_nos_right']:
    im = np.asarray(Image.open(OUT / f'{n}.png').convert('RGB'))
    body = np.abs(im.astype(int) - np.array([28, 28, 36])).sum(2) > 6
    H, W = im.shape[:2]; r = red(im) & body
    if n == 'ref_warrior_small':
        mid = W * 0.47; legL = legR = None
    else:
        (hL, hR, aL, aR), _ = hips_of(n, H); mid = (hL + hR) / 2; legL, legR = min(hL, aL), max(hR, aR)
    out = [f'{n} H={H}']
    for f0, f1 in [(0.55, 0.65), (0.65, 0.75), (0.75, 0.85), (0.85, 0.95)]:
        y0, y1 = int(f0 * H), int(f1 * H); b = r[y0:y1]; xs = np.nonzero(b)[1]
        left, right = (xs < mid).sum() / H / H * 1000, (xs >= mid).sum() / H / H * 1000
        outR = (xs.max() - legR) / H if legR is not None and len(xs) and xs.max() > mid else float('nan')
        outL = (legL - xs.min()) / H if legL is not None and len(xs) and xs.min() < mid else float('nan')
        out.append(f'  {f0:.2f}-{f1:.2f}: red left {left:5.1f} right {right:5.1f} (x1000 H^2); out past leg L {outL:+.3f} R {outR:+.3f} H')
    print('\n'.join(out))
    v = im.copy(); v[r] = [255, 40, 200]
    t = Image.fromarray(v); tiles.append(t.resize((round(t.width * 400 / H), 400), Image.NEAREST))
S = Image.new('RGB', (sum(t.width for t in tiles) + 20 * len(tiles), 400), (20, 20, 26)); x = 0
for t in tiles:
    S.paste(t, (x, 0)); x += t.width + 20
S.save(OUT / 'cape_sides.png')
