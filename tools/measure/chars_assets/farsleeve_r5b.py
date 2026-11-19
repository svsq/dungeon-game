# python3 tools/measure/chars_assets/farsleeve_r5b.py frame.png...: the mage arch's far (weapon) sleeve straight from the frame. Sleeve box
# x 932-948 y 568-596 (forearm between torso edge and the staff fist), torso box x 918-930 y 540-562. Blue px Lab of each, dE76,
# share of ink (L* < 22, chroma < 20), cream (L* > 60, chroma < 25), grey wedge (L* 45-75, chroma < 12) in the sleeve box.
import sys, numpy as np
from PIL import Image
def lab(a):
    a = a / 255.; l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    X = l @ [0.4124, 0.3576, 0.1805] / 0.95047; Y = l @ [0.2126, 0.7152, 0.0722]; Z = l @ [0.0193, 0.1192, 0.9505] / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
for p in sys.argv[1:]:
    im = lab(np.asarray(Image.open(p).convert('RGB')).astype(float))
    S, T = im[568:596, 932:948].reshape(-1, 3), im[540:562, 918:930].reshape(-1, 3)
    blue = lambda a: (a[:, 2] < -12) & (a[:, 0] >= 22); C = np.hypot(S[:, 1], S[:, 2])
    sb, tb = S[blue(S)].mean(0), T[blue(T)].mean(0)
    print(f'{p.split("/")[-4][15:]:>10s} {p.split("/")[-1]:22s} sleeve blue {blue(S).sum():3d} Lab {sb.round(1)}  torso {tb.round(1)}  dE {np.linalg.norm(sb - tb):4.1f}'
          f'  ink {((S[:,0] < 22) & (C < 20)).mean():.2f} cream {((S[:,0] > 60) & (C < 25)).sum():3d} grey {((S[:,0] > 45) & (S[:,0] < 75) & (C < 12)).sum():3d}')
