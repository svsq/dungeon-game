# specks.py [names...]: alpha hygiene of magma sources in art/gen. comps: alpha islands (8-connected, a > 0); specks: islands under 2 % of the
# largest (as tools/specks.py cuts them) and their px; semi: share of opaque-ish px with 0 < a < 250 (soft fringe); edge: share of the outer
# border px that are dark ink (L < 20 of 0-100, on rgb), i.e. a closed outline at source scale
import os, sys, glob, numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
G = os.path.join(ROOT, 'art', 'gen')
DEF = ['arch_mg', 'banner_mg', 'basalt_a', 'basalt_b', 'boulder_mg_a', 'boulder_mg_b', 'bridge_post_mg', 'forge_mg', 'obsidian_mg', 'skel_mg', 'slab_mg_a', 'slab_mg_b', 'slab_mg_c', 'slab_mg_d',
       'stairs_mg', 'stairs_up_mg', 'vent_mg', 'dc_ash_mg', 'dc_splash_mg', 'en_imp', 'en_golem', 'en_salamander', 'en_colossus', 'en_golem_core', 'en_cultist']
parts = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(G, '*.png')) if os.path.basename(p).split('__')[0] in ('imp', 'golem', 'colossus', 'salamander') and '__' in p)
names = sys.argv[1:] or DEF + parts
print(f"{'name':24s} {'size':>11s} comps specks speckpx  semi%  ink%")
for n in names:
    p = os.path.join(G, n + '.png')
    if not os.path.exists(p): print(n, 'missing'); continue
    im = np.asarray(Image.open(p).convert('RGBA')).astype(int); a = im[..., 3]; on = a > 0
    lab, k = ndimage.label(on, structure=np.ones((3, 3)))
    sz = np.bincount(lab.ravel())[1:] if k else np.array([0]); big = sz.max() if k else 0
    sp = sz[sz < 0.02 * big] if k else sz[:0]
    semi = ((a > 0) & (a < 250)).sum() / max(1, on.sum())
    er = on & ~ndimage.binary_erosion(on); Lr = (0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]) / 2.55
    ink = (er & (Lr < 20)).sum() / max(1, er.sum())
    print(f"{n:24s} {im.shape[1]:5d}x{im.shape[0]:<5d} {k:5d} {len(sp):6d} {int(sp.sum()):7d} {semi*100:6.1f} {ink*100:5.0f}")
