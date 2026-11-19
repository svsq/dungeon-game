# cartviews.py (TASKS 2140): the two cart views at the change of view on cartviews.js's 1:1 crops. The cart is what differs from the
# render without it; per load and view: its bbox (w x h px), mean Lab of the box's wood (warm), the ore (grey above the wheels' band),
# the wheels (non-ink px of the head-on slabs, SLAB px wide and tall above their feet, or of the 3/4 discs, HUB of the hubs' distance round
# each hub, places from cartviews.js) and the ink (L* < INK), the wood's lit side (L* p90) and the outline's weight (ink px over the
# mask's edge px). The rope (2 px) is opened out of the mask. With --seq, the cart's bbox and wood L* frame by frame across the bend.
# run: python3 tools/measure/cart2140/cartviews.py frames/cart_2140_before [--seq]
import json, os, sys
import numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'fidelity'))
from labc import lab, load
INK, DIFF, WHEEL, ROPE, SLAB, HUB = 12, 10, 0.3, 2, (3, 8), 0.3


def parts(d, name, bg, info=None):
  a, b = load(os.path.join(d, name + '.png')), load(os.path.join(d, bg + '.png'))
  m = np.abs(a - b).max(-1) > DIFF
  m &= ndi.binary_dilation(ndi.binary_opening(m, iterations=ROPE), iterations=ROPE)
  lb, k = ndi.label(m)
  if not k: return None
  m = lb == 1 + np.argmax(ndi.sum(m, lb, range(1, k + 1)))
  m = ndi.binary_fill_holes(m)
  ys, xs = np.where(m)
  y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
  L, A, B = lab(a); yy = np.mgrid[:m.shape[0], :m.shape[1]][0]
  ink = m & (L < INK); wood = m & ~ink & (A > 9) & (B > 18); grey = m & ~ink & ~wood & (np.hypot(A, B) < 14)
  low = yy >= y1 - WHEEL * (y1 - y0)
  edge = m & ~ndi.binary_erosion(m)
  mean = lambda q: tuple(round(float(np.mean(c[q])), 1) for c in (L, A, B)) if q.any() else None
  xx = np.mgrid[:m.shape[0], :m.shape[1]][1]
  wh = np.zeros_like(m)
  for px, py in (info or {}).get('wheels', []):
    wh |= (np.hypot(xx - px, yy - py) < HUB * info['hub']) if info['hub'] else ((np.abs(xx + 0.5 - px) <= SLAB[0]) & (yy + 0.5 <= py) & (yy + 0.5 > py - SLAB[1]))
  return dict(w=int(x1 - x0), h=int(y1 - y0), wood=mean(wood), ore=mean(grey & ~low), wheels=mean(wh & m & ~ink), ink=mean(ink),
              lit=round(float(np.percentile(L[wood], 90)), 1) if wood.any() else None, line=round(ink.sum() / max(1, edge.sum()), 2), n=int(m.sum()))


def main():
  d = sys.argv[1]
  info = json.load(open(os.path.join(d, 'views.json')))['info']
  for ld in (3, 2, 0):
    r = {t: parts(d, f'{t}_l{ld}', f'bg_l{ld}', info[f'{t}_l{ld}']) for t in ('front', 'side')}
    for t, p in r.items(): print(f'load {ld} {t:5s}', p)
    f, s = r['front'], r['side']
    dl = {k: round(s[k][0] - f[k][0], 1) for k in ('wood', 'ore', 'wheels', 'ink') if f[k] and s[k]}
    print(f'load {ld} side-front: w {s["w"] - f["w"]} h {s["h"] - f["h"]} dL {dl} lit {round(s["lit"] - f["lit"], 1)} line {round(s["line"] - f["line"], 2)}')
  if '--seq' in sys.argv:
    for ld in (3, 2, 0):
      fs = sorted(x[:-4] for x in os.listdir(d) if x.startswith(f'seq_l{ld}_'))
      row = [parts(d, n, f'bg_l{ld}') for n in fs]
      print(f'seq load {ld}', ' '.join(f'{p["w"]}x{p["h"]}/{p["wood"][0] if p["wood"] else "-"}' for p in row if p))


main()
