# cartgrade.py (TASKS 2122): fits the sprite shader's grade (brightness b, contrast c; rgb*b then (rgb-0.5)*c+0.5) that brings each front
# cart painting to its 3/4 one's L* p10/p50/p90 (srclab.py's pixels: a > 200, ink L < 15 dropped), and prints both before and after.
# run: python3 tools/measure/assets/cartgrade.py
import os, sys, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
def lab_L(rgb):
    a = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4); Y = a @ [0.2126, 0.7152, 0.0722]
    return 116 * np.where(Y > 0.008856, np.cbrt(Y), 7.787 * Y + 16 / 116) - 16
def px(n):
    im = np.asarray(Image.open(os.path.join(ROOT, 'live', 'assets', n + '.png')).convert('RGBA')).astype(float)
    return im[im[..., 3] > 200][:, :3] / 255.0
def pct(rgb):
    L = lab_L(np.clip(rgb, 0, 1)); L = L[L >= 15]; return np.percentile(L, [10, 50, 90])
for s, f in [('cart_tw', 'cart_tw_f'), ('cart_tw_half', 'cart_tw_f_half'), ('cart_tw_empty', 'cart_tw_f_empty')]:
    want, src = pct(px(s)), px(f); sub = src[:: max(1, len(src) // 60000)]; best = None
    for b in np.arange(0.5, 1.101, 0.01):
        for c in np.arange(0.6, 1.401, 0.01):
            got = pct((sub * b - 0.5) * c + 0.5); e = float(((got - want) ** 2).sum())
            if best is None or e < best[0]: best = (e, b, c, got)
    e, b, c, got = best
    print(f"{f:16s} -> {s:13s} 3/4 {want.round(0)} front {pct(src).round(0)} graded {pct((src * b - 0.5) * c + 0.5).round(0)}  b {b:.2f} c {c:.2f}")
