# python3 tools/measure/chars_assets/helmband.py: (r2) how the mage's world helms read at 84 px: on the 42-row grid (speckle.py's vote), the
# cells of the head box (rows 0..10) split into hair/helm, skin and band by Lab, and the band's ΔE to skin and to the helm dome; plus how many
# grid cells the circlet changes against the bare head (mage__head_ci vs mage__body, |dRGB| sum > 60)
import os, sys; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backhair import lab
SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'speckle.py'); ns = {'__file__': SP}
exec(open(SP).read().split('for f in sorted')[0], ns); vote = ns['vote']
def grid(n): return vote(np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float))[:12]
le = grid('mage__head_le'); op = le[..., 3] > 0; L = lab(le[..., :3] * 255)
band = op & (L[..., 0] > 60) & (L[..., 2] > 25); skin = op & (L[..., 0] > 45) & (L[..., 0] <= 60) & (L[..., 1] > 12)
dome = op & ~band & ~skin & (L[..., 0] > 18)
m = lambda k: L[k].mean(0).round(1) if k.any() else None
print('head_le cells', op.sum(), 'band', band.sum(), m(band), 'skin', skin.sum(), m(skin), 'dome', dome.sum(), m(dome))
if band.any() and skin.any(): print('band dE to skin %.1f, to dome %.1f' % (np.linalg.norm(m(band) - m(skin)), np.linalg.norm(m(band) - m(dome))))
ys, xs = np.nonzero(band); print('band rows', sorted(set(ys.tolist())), 'cols', sorted(set(xs.tolist())))
b, c = grid('mage__body'), grid('mage__head_ci'); w = min(b.shape[1], c.shape[1])
diff = (np.abs(b[:, :w, :3] - c[:, :w, :3]).sum(-1) * 255 > 60) & (c[:, :w, 3] > 0)
print('circlet: grid cells differing from bare head', int(diff.sum()), 'of', int((c[..., 3] > 0).sum()))
