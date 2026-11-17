"""Share of each class's signature colour (warrior red cloth, mage blue robe, archer green cloak) in the small ref and in the game rig
parts: python3 tools/measure/chars_style/signature.py
Game share = signature pixels / opaque pixels summed over the front rig parts (body, cape, arms, legs, feet) at their texture size, a
proxy for the assembled figure (parts overlap a little). Ref share counts the 64x64 small ref's figure."""
import glob
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools/measure/fidelity'))
from labc import lab  # noqa: E402

SIG = {
    'warrior': ('hero', 'warrior_a_small_r4', lambda L, C, h: (C > 35) & ((h < 45) | (h > 350)) & (L < 50)),
    'mage': ('mage', 'mage_a_small_noorb_r4', lambda L, C, h: (C > 18) & (h > 250) & (h < 310)),
    'archer': ('archer', 'archer_a_small_r4', lambda L, C, h: (C > 10) & (h > 80) & (h < 130) & (L < 60)),
}
PARTS = ['body', 'cape', 'uarmL', 'uarmR', 'farmL', 'farmR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']


def pix(path, ref=False):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(float)
    m = a[..., 3] > 127
    if ref:
        m &= np.abs(a[..., :3] - np.array([26, 26, 36])).sum(-1) > 24
    p = a[..., :3][m]
    return p[p.sum(1) > 90]


def share(p, f):
    L, A, B = lab(p)
    C, h = np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360
    return f(L, C, h).mean(), len(p)


for cls, (pre, ref, f) in SIG.items():
    rs, _ = share(pix(os.path.join(ROOT, 'art/char_refs', ref + '.png'), True), f)
    parts = [os.path.join(ROOT, 'art/gen', f'{pre}__{n}.png') for n in PARTS]
    parts = [p for p in parts if os.path.exists(p)]
    allp = np.concatenate([pix(p) for p in parts])
    gs, n = share(allp, f)
    per = ', '.join(f'{os.path.basename(p)[len(pre) + 2:-4]} {share(pix(p), f)[0]:.0%}' for p in parts[:2])
    menu = os.path.join(ROOT, 'art/gen', f'{pre}__body_menu.png')
    ms = share(pix(menu), f)[0] if os.path.exists(menu) else float('nan')
    print(f'{cls:8s} ref {rs:5.1%}   game parts {gs:5.1%} ({n} px; {per})   menu body {ms:5.1%}')
