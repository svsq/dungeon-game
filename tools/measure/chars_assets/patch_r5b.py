# python3 tools/measure/chars_assets/patch_r5b.py frame.png x0 y0 x1 y1 [rx0 ry0 rx1 ry1]: a patch on the arch's torso side vs a reference box
# (the breastplate / jerkin next to it): Lab mean, L* std, share of "flat" px (L* range < 2 in its 3x3), hue class counts, dE76 to the ref.
import sys, numpy as np
from PIL import Image
def lab(a):
    a = a / 255.; l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = l @ [0.4124, 0.3576, 0.1805] / 0.95047; Y = l @ [0.2126, 0.7152, 0.0722]; Z = l @ [0.0193, 0.1192, 0.9505] / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
im = lab(np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)); b = list(map(int, sys.argv[2:6]))
P = im[b[1]:b[3], b[0]:b[2]]; L = P[..., 0]
from scipy.ndimage import maximum_filter, minimum_filter
flat = (maximum_filter(im[..., 0], 3) - minimum_filter(im[..., 0], 3))[b[1]:b[3], b[0]:b[2]] < 2
olive = (P[..., 2] > P[..., 1] + 6) & (P[..., 2] > 10) & (P[..., 0] > 20)
red = (P[..., 1] > 15) & (P[..., 1] > P[..., 2] * 0.8)
pale = P[..., 0] > 55
print(f'patch {b} px {L.size} Lab {P.reshape(-1,3).mean(0).round(1)} L*std {L.std():.1f} flat {flat.mean():.2f} olive {olive.sum()} red {red.sum()} pale {pale.sum()}', end='')
if len(sys.argv) > 9:
    r = list(map(int, sys.argv[6:10])); R = im[r[1]:r[3], r[0]:r[2]].reshape(-1, 3).mean(0)
    print(f'  ref Lab {R.round(1)} dE {np.linalg.norm(P.reshape(-1,3).mean(0) - R):.1f}')
else: print()
