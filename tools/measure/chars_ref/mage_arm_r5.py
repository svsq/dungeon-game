# ref critic r5, remark 11 / task 2204: the mage's far (weapon) arm from mage_arm_r5.mjs. Per view: the share of uarmR seen in the
# final frame (all vs no_uarmR), Lab of the visible sleeve (uarmR + cuffR blue pixels) against the torso's blue near the far shoulder,
# the grey cuff's visible area, and the dark ink (L < 18) on the line where the cuff/sleeve meets the torso
import os, sys, glob, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cape_r5 import lab
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5_ref') + '/mage_arm')
ld = lambda n, k: np.asarray(Image.open(os.path.join(D, f'{n}__{k}.png')).convert('RGB')).astype(float)
def dil(m, r=1):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): o |= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
for f in sorted(glob.glob(os.path.join(D, '*__all.png'))):
    n = os.path.basename(f)[:-9]; al, no = ld(n, 'all'), ld(n, 'none'); L = lab(al)
    part = lambda k: np.abs(ld(n, 'only_' + k) - no).sum(2) > 24
    up, cu, bo = part('uarmR'), part('cuffR'), part('body')
    upv = up & (np.abs(al - ld(n, 'no_uarmR')).sum(2) > 6); cuv = cu & (np.abs(al - ld(n, 'no_cuffR')).sum(2) > 6)
    blue = (L[..., 2] < -12)
    sleeve = (upv | cuv) & blue; grey = cuv & (np.abs(L[..., 1]) < 6) & (np.abs(L[..., 2]) < 8) & (L[..., 0] > 50)
    xs = np.where(cu | up)[1]; x0 = xs.min() if len(xs) else 0
    tb = bo & blue & ~dil(cu | up, 1); ys, xb = np.where(tb); near = tb.copy()
    if len(xb): near[:, : max(0, x0 - 12)] = False
    seam = dil(cuv | upv, 1) & dil(tb, 1) & (L[..., 0] < 18)
    ls = np.round(L[sleeve].mean(0), 1) if sleeve.any() else None; lt = np.round(L[near].mean(0), 1) if near.any() else None
    dE = round(float(np.linalg.norm(ls - lt)), 1) if ls is not None and lt is not None else None
    print(f'{n:34} uarmR seen {upv.sum():4}/{up.sum():4} px  sleeve(blue) {sleeve.sum():4} Lab {ls}  torso blue {lt}  dE {dE}  grey cuff {grey.sum():3} px  ink seam {seam.sum():3} px')
