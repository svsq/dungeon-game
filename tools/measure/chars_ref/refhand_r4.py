"""ref critic r4: the orb hand on mage_a_v4.png in numbers comparable with hand_r4.py: skin round the orb by angle (0 = the side away
   from the body, -90 = straight below), how high up the orb's side the fingers climb, the palm's width and the wrist's length in orb
   diameters, the cuff's tone. The game's numbers are mirrored to the same convention (its orb hand is on the other side of the body).
   python3 tools/measure/chars_ref/refhand_r4.py [frames/critic_chars_r4_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r4_ref')

def stats(A, orb, skin, side, tag):
    ys, xs = np.nonzero(orb); c = (xs.mean(), ys.mean()); d = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1; r = d / 2
    sy, sx = np.nonzero(skin); dx = (sx - c[0]) * side; dy = -(sy - c[1]); ang = np.degrees(np.arctan2(dy, dx)); dist = np.hypot(dx, dy)
    near = dist < 1.35 * r
    a = ang[near]
    top = (-(sy[near] - c[1])).max() / r
    on_face = int((dist < 0.85 * r).sum())
    width = (sx.max() - sx.min() + 1) / d; height = (sy.max() - sy.min() + 1) / d
    print(f'{tag:22s} orb d={d:4d}  hand angles 5..95% {np.percentile(a,5):5.0f}..{np.percentile(a,95):5.0f} deg  highest skin {top:+.2f} r over the centre  '
          f'skin on the orb face {on_face/(d*d)*1000:5.1f} per mille of d^2  hand box {width:.2f} x {height:.2f} d  skin share of hand box {len(sx)/((sx.max()-sx.min()+1)*(sy.max()-sy.min()+1)):.2f}')
    return c, d

a = np.asarray(Image.open(ROOT / 'art/char_refs/mage_a_v4.png').convert('RGB')).astype(int)
sub = a[260:470, 500:690]
blue = (sub[..., 2] > 140) & (sub[..., 2] - sub[..., 0] > 70)
lab, n = ndi.label(ndi.binary_closing(blue, iterations=3)); orb = ndi.binary_fill_holes(lab == (np.bincount(lab.ravel())[1:].argmax() + 1))
skin = (sub[..., 0] > 120) & (sub[..., 0] - sub[..., 2] > 50) & (sub[..., 1] > 60) & ~orb
lab, n = ndi.label(skin); skin = np.isin(lab, [i + 1 for i, s in enumerate(np.bincount(lab.ravel())[1:]) if s > 40])
# only the hand: below the orb's top and right of the robe's edge
stats(sub, orb, skin, 1, 'mage_a_v4')
sm = np.asarray(Image.open(ROOT / 'art/char_refs/mage_a_small_orb_r4.png').convert('RGBA')).astype(int)
o = (sm[..., 2] > 150) & (sm[..., 2] - sm[..., 0] > 60) & (sm[..., 3] > 0)
lab, n = ndi.label(o); o = ndi.binary_fill_holes(lab == (np.bincount(lab.ravel())[1:].argmax() + 1))
ys, xs = np.nonzero(o); cx = xs.mean()
sk = (sm[..., 0] > 140) & (sm[..., 0] - sm[..., 2] > 50) & (sm[..., 3] > 0); sk[:, :int(cx - 8)] = False
stats(sm, o, sk, 1, 'mage_a_small_orb_r4')
L = OUT / 'layers'; M = json.load(open(L / 'meta.json'))
for v in [k for k in M if 'mage' in k and (L / f'{k}__only_cupL.png').exists()]:
    img = lambda k: np.asarray(Image.open(L / f'{v}__{k}.png').convert('RGB')).astype(int)
    A = img('all'); orb = np.abs(img('only_orb') - img('none')).sum(2) > 24
    hand = (np.abs(A - img('no_cupL')).sum(2) > 24)
    stats(A, orb, hand, -1, v)
