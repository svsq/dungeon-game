# tileseam.py frames...: tile-grid seams in the assembled frame. Mean |dL*| of horizontal (vertical) neighbours by x (y) mod TILE over the box
# 300-1500 x 130-880 (clear of the top-left HUD, the minimap at x > 1530 and the bottom panel); the camera offset is unknown, so the score is
# the best phase over the mean of the phases of its own 2-px parity (the art grid alone would double it): 1.00 = no grid, > 1.15 shows tile lines. Also the 2-px parity (best of x mod 2 over the mean): the
# art-pixel grid, ~2 = every edge on one parity (on the 2-px grid), 1.0 = edges anywhere (off grid, resampled art).
import os, sys, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
T = 32
def L(a):
    a = a / 255.0; a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4); y = a @ [0.2126, 0.7152, 0.0722]
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)
print(f"{'frame':28s} tileX tileY  px2X  px2Y")
for f in sys.argv[1:]:
    p = f if os.path.isabs(f) else os.path.join(ROOT, f)
    l = L(np.asarray(Image.open(p).convert('RGB'))[130:880, 300:1500].astype(float))
    dx = np.abs(np.diff(l, axis=1)); dy = np.abs(np.diff(l, axis=0))
    px = np.array([dx[:, i::T].mean() for i in range(T)]); py = np.array([dy[i::T, :].mean() for i in range(T)])
    qx = np.array([dx[:, i::2].mean() for i in range(2)]); qy = np.array([dy[i::2, :].mean() for i in range(2)])
    ex = lambda c: c.max() / c[np.argmax(c) % 2::2].mean()
    print(f"{os.path.basename(f):28s} {ex(px):5.2f} {ex(py):5.2f}  {qx.max()/qx.mean():4.2f}  {qy.max()/qy.mean():4.2f}")
