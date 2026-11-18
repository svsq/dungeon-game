# ref critic r5, remark 7 / task 2202: the warrior's cloak as the player sees it: front view (cape layer) against the back view drawn in
# a turn or walking up (cape painted into body_back): lowest cloak row over the ground, rows of cloak, Lab of the cloak's red pixels
import os, sys, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cape_r5 import lab
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, 'frames/critic_chars_r5_ref/' + (sys.argv[1] if len(sys.argv) > 1 else 'cape_town'))
def ld(n, k): return np.asarray(Image.open(os.path.join(D, f'{n}__{k}.png')).convert('RGB')).astype(float)
for n in sys.argv[2:] or ['def_run_r_38', 'def_run_l_38', 'def_walk_l_3', 'def_walk_l_6', 'def_walk_l_9', 'def_walk_dl_6', 'def_walk_ul_9', 'def_run_u_38', 'def_run_ur_38']:
    al, no = ld(n, 'all'), ld(n, 'none'); hero = np.abs(al - no).sum(2) > 24; L = lab(al)
    red = hero & (L[..., 1] > 12) & (L[..., 1] > L[..., 2] * 0.7) & (L[..., 0] < 45)
    ys = np.where(hero)[0]; ry = np.where(red)[0]; foot = ys.max()
    print(f'{n:16} hero rows {ys.min()}-{foot} ({foot - ys.min() + 1}) cloak rows {ry.min()}-{ry.max()} ({ry.max() - ry.min() + 1}) hem above sole {foot - ry.max()} px, red px {red.sum()}, Lab {np.round(L[red].mean(0), 1)}')
