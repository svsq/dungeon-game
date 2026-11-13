# refstone.py: neutral stone in ref_cave_lava (pixels with C* < 12 and 6 < L* < 60 over boxes of basalt tops/columns) vs the magma props as
# props.js measured them: L* p50/p90 and hue p50 of the stone. Answers "are the basalt props the ref's basalt".
import os, numpy as np
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
im = np.asarray(Image.open(os.path.join(ROOT, 'study/refs/ref_cave_lava.png')).convert('RGB')).astype(float) / 255
def lab(a):
    a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = a @ [0.4124, 0.3576, 0.1805] / 0.9505; Y = a @ [0.2126, 0.7152, 0.0722]; Z = a @ [0.0193, 0.1192, 0.9505] / 1.089
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return 116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))
for nm, (x0, y0, x1, y1) in {'lake columns R': (1260, 330, 1420, 420), 'arch': (170, 230, 440, 330), 'ridge mid': (980, 460, 1180, 560), 'cols bottom': (640, 720, 900, 880), 'whole': (0, 0, 1536, 1024)}.items():
    L, A, B = lab(im[y0:y1, x0:x1].reshape(-1, 3)); C = np.hypot(A, B); h = (np.degrees(np.arctan2(B, A)) + 360) % 360
    m = (C < 12) & (L > 6) & (L < 60)
    print(f"{nm:16s} n {m.sum():6d}  L50 {np.percentile(L[m],50):5.1f} L90 {np.percentile(L[m],90):5.1f}  C50 {np.percentile(C[m],50):4.1f}  hue50 {np.percentile(h[m],50):5.1f}")
