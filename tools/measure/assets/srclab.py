# srclab.py names...: Lab of the opaque pixels of live/assets sources (a > 200, ink L < 15 dropped): L* p10/p50/p90, C* p50, hue p50 (deg of a*b*),
# share of the source's opaque px. Used to set a repaint against its family (planks against crate, rails against crate, cart against crate).
import os, sys, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
def lab(rgb):
    a = rgb / 255.0; a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = a @ [0.4124, 0.3576, 0.1805] / 0.9505; Y = a @ [0.2126, 0.7152, 0.0722]; Z = a @ [0.0193, 0.1192, 0.9505] / 1.089
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return 116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))
print(f"{'name':18s}  L10  L50  L90  C50  hue50")
for n in sys.argv[1:]:
    im = np.asarray(Image.open(os.path.join(ROOT, 'live', 'assets', n + '.png')).convert('RGBA')).astype(float)
    px = im[im[..., 3] > 200][:, :3]; L, A, B = lab(px); k = L >= 15; L, A, B = L[k], A[k], B[k]
    C = np.hypot(A, B); h = (np.degrees(np.arctan2(B, A)) + 360) % 360
    print(f"{n:18s} {np.percentile(L,10):4.0f} {np.percentile(L,50):4.0f} {np.percentile(L,90):4.0f} {np.median(C):4.0f}  {np.median(h):5.0f}")
