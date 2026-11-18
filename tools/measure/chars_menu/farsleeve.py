# the mage's far (weapon, screen-right) shoulder in the arch: Lab of the blue sleeve top against the blue of the chest beside it, and
# the dark outline pixels on the seam between them (a column scan for a dark run inside the blue); for every frame given
#   python3 tools/measure/chars_menu/farsleeve.py frames/.../a.png [b.png ...]   (boxes for the arch at 1920x1080)
import sys, os, colorsys
from PIL import Image
def lab(p):
    f = lambda c: ((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92
    r, g, b = (f(c) for c in p[:3]); X = (0.4124*r+0.3576*g+0.1805*b)/0.95047; Y = 0.2126*r+0.7152*g+0.0722*b; Z = (0.0193*r+0.1192*g+0.9505*b)/1.08883
    h = lambda t: t ** (1/3) if t > 216/24389 else (24389/27*t+16)/116
    return (116*h(Y)-16, 500*(h(X)-h(Y)), 200*(h(Y)-h(Z)))
blue = lambda p: (lambda h, s, v: 0.55 < h < 0.72 and s > 0.35 and v > 0.25)(*colorsys.rgb_to_hsv(*[x/255 for x in p[:3]]))
dark = lambda p: max(p[:3]) < 60
def mean(im, box):
    L = [lab(im.getpixel((x, y))) for y in range(box[1], box[3]) for x in range(box[0], box[2]) if blue(im.getpixel((x, y)))]
    return tuple(sum(v[i] for v in L)/len(L) for i in range(3)) if L else None, len(L)
# the far shoulder's cap (lit blue, 924-941 x 536-552) and the chest's blue under the clasp strap (918-928 x 562-580)
SLEEVE, CHEST = (929, 537, 941, 552), (917, 562, 927, 580)
for fr in sys.argv[1:]:
    im = Image.open(fr).convert('RGB')
    s, ns = mean(im, SLEEVE); c, nc = mean(im, CHEST)
    # the seam: rows of the sleeve's height, a dark pixel between two blue ones within 6 px left of the sleeve box
    seam = 0
    for y in range(SLEEVE[1], SLEEVE[3]):
        row = [im.getpixel((x, y)) for x in range(SLEEVE[0] - 8, SLEEVE[0] + 4)]
        for i in range(1, len(row) - 1):
            if dark(row[i]) and any(blue(q) for q in row[:i]) and any(blue(q) for q in row[i+1:]): seam += 1; break
    dE = sum((a-b)**2 for a, b in zip(s, c)) ** 0.5 if s and c else None
    print(f"{os.path.basename(fr):28s} sleeve Lab {tuple(round(v,1) for v in s) if s else '-'} (n {ns})  chest Lab {tuple(round(v,1) for v in c) if c else '-'} (n {nc})  dE76 {dE and round(dE,1)}  seam rows {seam}/{SLEEVE[3]-SLEEVE[1]}")
