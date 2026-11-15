import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from labc import lab, load
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')
# r7's measures repeated on r8 frames (r7's own script was lost; windows re-chosen by eye on the same objects, ref box | zone_town box)
SVC = {'forge hearth': ((995, 280, 1050, 320), (1410, 250, 1465, 292)), 'altar candles': ((950, 585, 1050, 640), (1295, 625, 1375, 665)),
  'portal disc': ((450, 600, 540, 680), (650, 645, 740, 695)), 'adit lantern': ((1380, 495, 1415, 535), (1670, 590, 1705, 630)),
  'brazier': ((675, 295, 705, 335), (965, 250, 1005, 292)), 'campfire': ((735, 435, 780, 495), (1030, 455, 1075, 505)),
  'rails': ((1200, 770, 1320, 820), (1540, 760, 1620, 860))}
FIRE = {'ref': (757, 470), 'game': (1050, 492)}
def main(frame, others):
  r = load(REF); g = load(frame)
  Lr = lab(r[40:990, 40:1500])[0]; Lg = lab(g[70:940, 230:1520])[0]
  print('frame L p5/25/50/75/95/99 ref ', ' / '.join(f'{np.percentile(Lr, p):.1f}' for p in (5, 25, 50, 75, 95, 99)))
  print('frame L p5/25/50/75/95/99 game', ' / '.join(f'{np.percentile(Lg, p):.1f}' for p in (5, 25, 50, 75, 95, 99)))
  for nm, a in (('ref', r[40:990, 40:1500]), ('game', g[70:940, 230:1520])):
    L, A, B = lab(a); m = (L >= 50) & (L < 75); print(f'chroma L50-75 {nm}: a {A[m].mean():.1f} b {B[m].mean():.1f}')
  for k, (rb, gb) in SVC.items():
    pr = 97 if k == 'rails' else 99
    Lr_ = lab(load(REF, box=rb))[0]; Lg_ = lab(load(frame, box=gb))[0]
    print(f'{k:14s} L p{pr}: ref {np.percentile(Lr_, pr):5.1f} game {np.percentile(Lg_, pr):5.1f}')
  for nm, img, c in (('ref', r, FIRE['ref']), ('game', g, FIRE['game'])):
    L = lab(img)[0]; yy, xx = np.mgrid[:L.shape[0], :L.shape[1]]; d = np.hypot(xx - c[0], yy - c[1])
    print(f'fire falloff {nm}:', ' / '.join(f'{np.median(L[(d >= a) & (d < b)]):.1f}' for a, b in ((40, 70), (70, 110), (110, 160), (160, 220))))
  for f in others:
    a = np.asarray(Image.open(f).convert('RGB')).astype(float); print(f'black share (mean<6) {os.path.basename(f)}: {((a.mean(2) < 6).mean() * 100):.1f}%')
if __name__ == '__main__':
  main(sys.argv[1], sys.argv[2:])
