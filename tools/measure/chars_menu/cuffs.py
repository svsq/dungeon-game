# pale low-saturation pixels (the "prosthesis" read) near the mage's two fists in the arch: count, mean Lab, and the sleeve's Lab
#   python3 tools/measure/chars_menu/cuffs.py frames/.../mage_*.png   (1920x1080 arch boxes)
import sys, colorsys
from PIL import Image
def lab(c):
    f = lambda u: ((u / 255 + 0.055) / 1.055) ** 2.4 if u / 255 > 0.04045 else u / 255 / 12.92
    r, g, b = map(f, c[:3]); X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047; Y = 0.2126*r + 0.7152*g + 0.0722*b; Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883
    t = lambda v: v ** (1/3) if v > 0.008856 else 7.787*v + 16/116
    return 116*t(Y) - 16, 500*(t(X) - t(Y)), 200*(t(Y) - t(Z))
BOXES = {'far': (925, 545, 952, 590), 'near': (830, 570, 870, 605)}
def pale(c):
    h, s, v = colorsys.rgb_to_hsv(*(u/255 for u in c[:3])); L = lab(c)[0]
    return L > 50 and s < 0.25
def blue(c):
    L, a, b = lab(c); return b < -20 and L < 45
for fr in sys.argv[1:]:
    im = Image.open(fr).convert('RGB'); out = []
    for k, (x0, y0, x1, y1) in BOXES.items():
        px = [im.getpixel((x, y)) for x in range(x0, x1) for y in range(y0, y1)]
        p = [lab(c) for c in px if pale(c)]; bl = [lab(c) for c in px if blue(c)]
        m = lambda v: tuple(round(sum(t[i] for t in v) / len(v), 1) for i in range(3)) if v else None
        out.append(f'{k}: pale {len(p)} Lab {m(p)} sleeve {m(bl)}')
    print(fr.split('/')[-1].ljust(28), ' | '.join(out))
