# the warrior's near armpit in the arch (screen-left, under the pauldron, above the belt): the 2203 shade patch against the
# cuirass steel beside it: Lab, lightness spread and ΔE76 of the patch to the steel; a flat brown blob reads as dirt, not a shadow
#   python3 tools/measure/chars_menu/armshade.py frames/.../menu_continue.png [...]
import sys
from PIL import Image
def lab(c):
    f = lambda u: ((u / 255 + 0.055) / 1.055) ** 2.4 if u / 255 > 0.04045 else u / 255 / 12.92
    r, g, b = map(f, c[:3]); X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047; Y = 0.2126*r + 0.7152*g + 0.0722*b; Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883
    t = lambda v: v ** (1/3) if v > 0.008856 else 7.787*v + 16/116
    return 116*t(Y) - 16, 500*(t(X) - t(Y)), 200*(t(Y) - t(Z))
PATCH, STEEL = (867, 568, 878, 575), (882, 560, 900, 570)
def stats(im, box):
    x0, y0, x1, y1 = box; v = [lab(im.getpixel((x, y))) for x in range(x0, x1) for y in range(y0, y1)]
    m = [sum(t[i] for t in v) / len(v) for i in range(3)]; sd = (sum((t[0] - m[0]) ** 2 for t in v) / len(v)) ** 0.5
    return m, sd
for fr in sys.argv[1:]:
    im = Image.open(fr).convert('RGB'); (p, ps), (s, ss) = stats(im, PATCH), stats(im, STEEL)
    dE = sum((p[i] - s[i]) ** 2 for i in range(3)) ** 0.5
    print(fr.split('/')[-1].ljust(24), 'patch Lab %.1f/%.1f/%.1f sdL %.1f' % (*p, ps), '| steel Lab %.1f/%.1f/%.1f sdL %.1f' % (*s, ss), '| dE %.1f' % dE)
