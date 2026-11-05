import sys
from PIL import Image, ImageCms, ImageFilter
import numpy as np
src, ref, out = sys.argv[1:4]
sharpen = int(sys.argv[4]) if len(sys.argv) > 4 else 0
fwd = ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('sRGB'), ImageCms.createProfile('LAB'), 'RGB', 'LAB')
inv = ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('LAB'), ImageCms.createProfile('sRGB'), 'LAB', 'RGB')
def lab(im):
    a = np.asarray(ImageCms.applyTransform(im.convert('RGB'), fwd)).copy()
    return a[..., 0].astype(float) * 100 / 255, a[..., 1].view(np.int8).astype(float), a[..., 2].view(np.int8).astype(float)
def classes(L, A, B):
    C = np.hypot(A, B); h = np.degrees(np.arctan2(B, A)) % 360
    veg = (h > 75) & (h < 170) & (C > 5)
    warm = ~veg & (C > 8) & ((h <= 75) | (h > 330))
    neu = ~veg & ~warm
    return [veg, warm, neu]
L, A, B = lab(Image.open(src)); Lr, Ar, Br = lab(Image.open(ref))
cs, cr = classes(L, A, B), classes(Lr, Ar, Br)
edges = np.arange(5, 95, 10); cent = (edges[:-1] + edges[1:]) / 2
L2, A2, B2 = L.copy(), A.copy(), B.copy()
for m0, r0 in zip(cs, cr):
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = m0 & (L >= lo) & (L < hi); r = r0 & (Lr >= lo) & (Lr < hi)
        rows.append((A[m].mean(), B[m].mean(), A[m].std(), B[m].std(), Ar[r].mean(), Br[r].mean(), Ar[r].std(), Br[r].std()) if m.sum() > 300 and r.sum() > 300 else (np.nan,) * 8)
    R = np.array(rows); ok = ~np.isnan(R[:, 0])
    if ok.sum() < 2: continue
    f = [np.interp(L[m0], cent[ok], R[ok, j]) for j in range(8)]
    ka = np.clip(f[6] / np.maximum(f[2], 1e-3), 0.8, 1.6); kb = np.clip(f[7] / np.maximum(f[3], 1e-3), 0.8, 1.6)
    A2[m0] = (A[m0] - f[0]) * ka + f[4]; B2[m0] = (B[m0] - f[1]) * kb + f[5]
    # match each class's lightness distribution mean (keeps texture)
    dl = Lr[r0 & (Lr > 5)].mean() - L[m0 & (L > 5)].mean()
    L2[m0] = L[m0] + 0.7 * dl
w = np.clip((75 - L) / 20, 0, 1) * (L > 4)
A2 = np.clip(A + (A2 - A) * w, -128, 127); B2 = np.clip(B + (B2 - B) * w, -128, 127); L2 = np.clip(L + (L2 - L) * w, 0, 100)
o = np.stack([(L2 * 255 / 100).round().astype(np.uint8), A2.round().astype(np.int8).view(np.uint8), B2.round().astype(np.int8).view(np.uint8)], -1)
im = ImageCms.applyTransform(Image.fromarray(o, 'LAB'), inv)
if sharpen: im = im.filter(ImageFilter.UnsharpMask(radius=1, percent=sharpen, threshold=2))
im.save(out)
L3, A3, B3 = lab(im); k = L3 > 5; C = np.hypot(A3, B3)
print('after: a %.1f b %.1f chroma %.1f L %.1f' % (A3[k].mean(), B3[k].mean(), C[k].mean(), L3[k].mean()))
