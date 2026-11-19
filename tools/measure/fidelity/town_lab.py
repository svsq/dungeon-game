import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from labc import lab, load

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')

# Window pairs, one material each: ref box on ref_town.png (1536x1024, hero ~81 px) and game box on a 1920x1080 frame (hero ~84 px),
# so both sides are near the same art scale. Game boxes avoid HUD panels.
PAIRS = {
  'pave_lit':  ((540, 400, 620, 440), (860, 395, 960, 450)),
  'pave_dim':  ((705, 610, 745, 680), (1030, 660, 1090, 720)),
  'pave_dim2': ((705, 610, 745, 680), (930, 610, 1000, 660)),
  'earth':     ((500, 525, 560, 560), (560, 390, 660, 430)),
  'wall':      ((470, 712, 620, 748), (560, 785, 720, 820)),
  'stone_unlit': ((400, 100, 500, 135), (610, 160, 680, 200)),
}
FRAME_GAME = (230, 70, 1520, 940)
FRAME_REF = (40, 40, 1500, 990)

def stats(a):
  L, A, B = lab(a); C = np.hypot(A, B)
  q = lambda x, p: float(np.percentile(x, p))
  return dict(L10=q(L, 10), L50=q(L, 50), L90=q(L, 90), a=float(A.mean()), b=float(B.mean()), C50=q(C, 50), C90=q(C, 90))

def fmt(d): return ' '.join(f'{k}={v:6.1f}' for k, v in d.items())

def main(frame, out):
  res = {}
  r = stats(load(REF, box=FRAME_REF)); g = stats(load(frame, box=FRAME_GAME)); res['frame'] = dict(ref=r, game=g)
  print(f"{'frame':10s} ref  {fmt(r)}\n{'':10s} game {fmt(g)}")
  for nm, path, box in (('ref', REF, FRAME_REF), ('game', frame, FRAME_GAME)):
    L, A, B = lab(load(path, box=box)); line = []
    for lo, hi in ((0, 30), (30, 50), (50, 101)):
      m = (L >= lo) & (L < hi); line.append(f'L{lo}-{hi}: share={m.mean()*100:5.1f}% a={A[m].mean():5.1f} b={B[m].mean():5.1f}')
    res['bands_' + nm] = line; print(f'bands {nm:4s}', ' | '.join(line))
  tiles = []
  for k, (rb, gb) in PAIRS.items():
    r = stats(load(REF, box=rb)); g = stats(load(frame, box=gb)); res[k] = dict(ref=r, game=g)
    print(f"{k:10s} ref  {fmt(r)}\n{'':10s} game {fmt(g)}  dL50={g['L50']-r['L50']:+.1f} dC50={g['C50']-r['C50']:+.1f}")
    tiles.append((Image.open(REF).convert('RGB').crop(rb), Image.open(frame).convert('RGB').crop(gb), k))
  if out:
    W = 2 * 130 * 3 + 30; H = len(tiles) * 130 * 3 // 2 + 10
    sh = Image.new('RGB', (W, len(tiles) * 3 * 130 // 1 // 1), (40, 40, 40)); y = 0
    for a, b, k in tiles:
      for i, t in enumerate((a, b)): sh.paste(t.resize((t.width * 3, t.height * 3), Image.NEAREST), (i * (130 * 3 + 30), y))
      y += max(a.height, b.height) * 3 + 10
    sh.crop((0, 0, W, y)).save(out + '.png'); json.dump(res, open(out + '.json', 'w'), indent=1)

if __name__ == '__main__':
  main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '')
