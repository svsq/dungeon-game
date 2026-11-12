# bandbr.py frame x0 y0 x1 y1 [step]: B-R of the bright body pixels (L-ish sum > 150, not lava: R-B < 120) per row band — the cold band of 1928
# over the colossus (r14: 550-569 at -31/-34 against -41..-49 above). Prints band, n, mean B-R.
import os, sys, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
f, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6]); st = int(sys.argv[6]) if len(sys.argv) > 6 else 20
a = np.asarray(Image.open(f if os.path.isabs(f) else os.path.join(ROOT, f)).convert('RGB')).astype(int)[y0:y1, x0:x1]
for y in range(0, y1 - y0, st):
    b = a[y:y + st].reshape(-1, 3); s = b.sum(1); m = (s > 150) & (b[:, 0] - b[:, 2] < 120)
    print(f"{y0 + y:4d}-{y0 + y + st - 1:4d} n {m.sum():5d}  B-R {(b[m, 2] - b[m, 0]).mean() if m.any() else float('nan'):6.1f}")
