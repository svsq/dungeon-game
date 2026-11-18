#!/usr/bin/env python3
"""TASKS 2193 (chars_assets_r4.md 4, chars_menu_r4.md 5): the mage's grey hair under the circlet.
2183 cooled the hair under the circlet one fixed way: from behind (mage__head_back_ci) it stayed warmer than the back of the bare head
(mage__body_back, ΔE 10.1), and in the arch (mage__head_ci_menu) its magenta read lilac under the torches.
Here the hair px of each (low chroma, not dark: HAIR) move in OKLab a and b by the difference between the mean of their light ones and
the mean of the same px of the bare head (from behind) or a cool grey (the arch), lightness kept. Every source is kept once as
art/old/<name>-20261118-2193.png and each run starts from it; fix_2183.py hair and fix_mage_2170.py heads over these parts undo it,
so this step runs after them.
  python3 tools/fix_2193.py hair      (then the printed prep line; python3 tools/measure/fix2193/hair.py measures)"""
import os, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G

TAG = '20261118-2193'
# part: (the bare head it matches, or the OKLab a, b its light hair is set to, head rows of each, the hair's chroma under and OKLab
# lightness over). The arch's head goes to a cool grey with no magenta, not to the bare head's warm one: the hair is the author's
# cold grey (2183, heroBackCheck), and the lilac the critic saw was its magenta
HAIR = {'mage__head_back_ci': ('mage__body_back', None, 48, 0.075, 0.26), 'mage__head_ci_menu': ((0.0, -0.008), None, 48, 0.06, 0.38)}
# the means are taken over the light hair (OKLab L over LIGHT, CIELab about 45): the tone the eye reads as the hair's, where the dark
# strands at the roots would pull it to the shade
LIGHT = 0.5
load = lambda p: np.array(Image.open(p).convert('RGBA'))

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

def mask(a, rows, cmax, lo):
    lab = G.oklab(a[..., :3].astype(float)); m = (a[..., 3] >= 128) & (np.hypot(lab[..., 1], lab[..., 2]) < cmax) & (lab[..., 0] > lo)
    if rows is not None: m[rows:] = False
    return lab, m

def hair():
    for n, (ref, rows, rrows, cmax, lo) in HAIR.items():
        a = keep(n); lab, m = mask(a, rows, cmax, lo); lt = m & (lab[..., 0] > LIGHT)
        if isinstance(ref, str): rl, rm = mask(load(f'art/gen/{ref}.png'), rrows, cmax, lo); goal = rl[rm & (rl[..., 0] > LIGHT)][:, 1:].mean(0)
        else: goal = np.array(ref)
        d = goal - lab[lt][:, 1:].mean(0); new = lab.copy(); new[..., 1:] += d
        out = a.copy(); out[..., :3] = np.where(m[..., None], np.round(G.srgb(new)), a[..., :3]).astype(np.uint8)
        Image.fromarray(out).save(f'art/gen/{n}.png'); print(f'{n}: {int(m.sum())} hair px, a/b moved by {d.round(4)}')
    print('python3 tools/prep.py --only ' + ','.join(HAIR))

if __name__ == '__main__':
    {'hair': hair}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
