"""The hero as the player sees it: mask = pixels that change when the hero is hidden (qashot --eval "S.run.hero.qaHide=1").
python3 tools/measure/chars_style/heromask.py ON_DIR OFF_DIR state [state ...]
Per state: silhouette box and height (screen px), signature colour share (as signature.py), mean L* of the hero against a 12 px
ring of floor round its box, the brightest 5% of the hero's L*, and a cut-out PNG (ON_DIR/<state>_cut.png) on flat grey."""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

on_dir, off_dir, states = sys.argv[1], sys.argv[2], sys.argv[3:]
SIG = {'warrior': lambda L, C, h: (C > 35) & ((h < 45) | (h > 350)) & (L < 55),
       'mage': lambda L, C, h: (C > 18) & (h > 250) & (h < 310),
       'archer': lambda L, C, h: (C > 10) & (h > 80) & (h < 130) & (L < 60)}
for st in states:
    cls = 'archer' if 'archer' in st else 'mage' if st.startswith('mage_') and st != 'mage_warrior' or st == 'town_mage' else 'warrior'
    a = np.asarray(Image.open(os.path.join(ROOT, on_dir, st + '.png')).convert('RGB')).astype(float)
    b = np.asarray(Image.open(os.path.join(ROOT, off_dir, st + '.png')).convert('RGB')).astype(float)
    m = np.abs(a - b).sum(-1) > 30
    ys, xs = np.where(m)
    # keep the biggest blob's box: the hero; a light change elsewhere is a few stray pixels
    cy, cx = np.median(ys), np.median(xs)
    keep = (np.abs(ys - cy) < 70) & (np.abs(xs - cx) < 70)
    ys, xs = ys[keep], xs[keep]
    m2 = np.zeros_like(m); m2[ys, xs] = True
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    L, A, B = lab(a[m2]); C, h = np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360
    ring = np.zeros_like(m); ring[max(0, y0 - 12):y1 + 12, max(0, x0 - 12):x1 + 12] = True; ring &= ~m
    Lr = lab(b[ring])[0]
    print(f'{st:14s} {cls:7s} box {x1 - x0}x{y1 - y0} px  sig {SIG[cls](L, C, h).mean():5.1%}  L hero {L.mean():4.1f} ring {Lr.mean():4.1f}  '
          f'dL {L.mean() - Lr.mean():+5.1f}  L95 {np.percentile(L, 95):4.1f}  C mean {C.mean():4.1f}')
    cut = np.full_like(a, 60); cut[m2] = a[m2]
    Image.fromarray(cut[y0 - 4:y1 + 4, x0 - 4:x1 + 4].astype(np.uint8)).resize(((x1 - x0 + 8) * 4, (y1 - y0 + 8) * 4), Image.NEAREST).save(os.path.join(ROOT, on_dir, st + '_cut.png'))
