import sys, glob, os, numpy as np
from PIL import Image
from scipy import ndimage
# herosep_contrast.py dir [states]: hero mask from the with/without diff; ground = nohero pixels in a 6..30 px ring around the mask.
# prints hero/ground L p50, WCAG ratio of the medians, Lab dE of medians, and share of hero pixels within dE<12 of the ground median
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    X = c @ np.array([0.4124, 0.3576, 0.1805]); Y = c @ np.array([0.2126, 0.7152, 0.0722]); Z = c @ np.array([0.0193, 0.1192, 0.9505])
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(X / 0.9505), f(Y), f(Z / 1.089)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)
def relL(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92); return c @ np.array([0.2126, 0.7152, 0.0722])
d = sys.argv[1]; names = sys.argv[2:] or sorted(os.path.basename(f)[:-12] for f in glob.glob(os.path.join(d, '*__nohero.png')))
for n in names:
    a = np.asarray(Image.open(os.path.join(d, n + '.png')).convert('RGB')).astype(float); b = np.asarray(Image.open(os.path.join(d, n + '__nohero.png')).convert('RGB')).astype(float)
    m = np.abs(a - b).max(-1) > 24; m[:, 1536:] = False
    if m.sum() < 300: continue
    ring = ndimage.binary_dilation(m, iterations=30) & ~ndimage.binary_dilation(m, iterations=6)
    h, g = a[m], b[ring]; hl, gl = lab(h), lab(g)
    mh, mg = np.median(hl, 0), np.median(gl, 0); dE = np.linalg.norm(mh - mg)
    Lh, Lg = np.median(relL(h)), np.median(relL(g)); cr = (max(Lh, Lg) + 0.05) / (min(Lh, Lg) + 0.05)
    near = (np.linalg.norm(hl - mg, axis=1) < 12).mean() * 100
    print(f"{n:24s} heroL* {mh[0]:5.1f} groundL* {mg[0]:5.1f}  ratio {cr:4.2f}  dE {dE:5.1f}  hero a*b* ({mh[1]:5.1f},{mh[2]:5.1f}) ground a*b* ({mg[1]:5.1f},{mg[2]:5.1f})  hero px near ground {near:4.0f}%")
