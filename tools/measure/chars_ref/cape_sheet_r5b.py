# ref critic r5b, task 2202/2205: the warrior's cloak front vs back on the town square (cape_r5.mjs --town), x4 side by side, and per
# frame the lowest row of cloak-red pixels that are not boot (a* > 18, below the belt) over the hero's lowest row
import os, sys, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cape_r5 import lab
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
F = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5b_ref'))
D = os.path.join(F, sys.argv[1] if len(sys.argv) > 1 else 'cape_town')
N = sys.argv[2:] or ['def_run_r_38', 'def_run_l_38', 'def_walk_l_6', 'def_walk_l_9', 'def_walk_ul_9', 'def_run_u_38', 'def_run_ur_38', 'def_run_ul_38']
ims = []
for n in N:
    if not os.path.exists(os.path.join(D, f'{n}__all.png')): continue
    a = Image.open(os.path.join(D, f'{n}__all.png')).convert('RGB'); A = np.asarray(a).astype(float); no = np.asarray(Image.open(os.path.join(D, f'{n}__none.png')).convert('RGB')).astype(float)
    hero = np.abs(A - no).sum(2) > 24; L = lab(A); ys = np.where(hero.any(1))[0]; top, bot = ys.min(), ys.max(); H = bot - top
    red = hero & (L[..., 1] > 18) & (L[..., 1] > L[..., 2]) & (L[..., 0] < 45); red[: top + H // 2] = False
    rr = np.where(red.sum(1) >= 2)[0]; hem = bot - rr.max() if len(rr) else None
    print(f'{n:16} H {H:3}  cloak red (a*>18, a*>b*) lowest row {hem} px over the sole = {hem / H if hem is not None else 0:.2f} H, red px below mid {red.sum():4}, Lab {np.round(L[red].mean(0), 1) if red.any() else None}')
    ims.append(a)
w, h = ims[0].size; s = 4; out = Image.new('RGB', ((w * s + 8) * len(ims), h * s), (255, 0, 255))
for i, im in enumerate(ims): out.paste(im.resize((w * s, h * s), Image.NEAREST), (i * (w * s + 8), 0))
out.save(os.path.join(F, 'z', 'z4_cape_front_back.png'))
