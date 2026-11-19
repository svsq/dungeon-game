# the arch's near side of the torso under the arm (screen-left), between the sleeve and the chest, from the shoulder to the hips:
# the pixels of the cape's colour (warrior red, archer olive) as rows of width; the same on the sheet's standing figure scaled to
# the arch hero's height (255 px); the Lab and the lightness spread (quilting/seams read as spread, a flat fill as none)
#   python3 tools/measure/chars_menu/sidefill.py
import os, colorsys
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
def lab(p):
    f = lambda c: ((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92
    r, g, b = (f(c) for c in p[:3]); X = (0.4124*r+0.3576*g+0.1805*b)/0.95047; Y = 0.2126*r+0.7152*g+0.0722*b; Z = (0.0193*r+0.1192*g+0.9505*b)/1.08883
    h = lambda t: t ** (1/3) if t > 216/24389 else (24389/27*t+16)/116
    return (116*h(Y)-16, 500*(h(X)-h(Y)), 200*(h(Y)-h(Z)))
def isred(p): h, s, v = colorsys.rgb_to_hsv(*[x/255 for x in p]); return (h < 0.04 or h > 0.95) and s > 0.45 and v > 0.18
def isgrn(p): h, s, v = colorsys.rgb_to_hsv(*[x/255 for x in p]); return 0.14 < h < 0.45 and s > 0.15 and v > 0.12
def band(im, pred, x0, y0, x1, y1):
    rows, L = [], []
    for y in range(y0, y1):
        w = 0
        for x in range(x0, x1):
            p = im.getpixel((x, y))
            if pred(p): w += 1; L.append(lab(p))
        rows.append(w)
    m = tuple(sum(v[i] for v in L)/len(L) for i in range(3)) if L else (0, 0, 0)
    sd = (sum((v[0]-m[0])**2 for v in L)/len(L))**0.5 if L else 0
    return rows, m, sd
GH = 255
CASES = [  # name, frame, predicate, game box (x0,y0,x1,y1), sheet, sheet hero height px, sheet box, sheet's own cloth box (gambeson / jerkin)
    ('warrior', 'frames/critic_chars_r5_menu/menu_continue.png', isred, (865, 538, 890, 584), 'art/char_refs/warrior_a_v2.png', 925, (330, 250, 362, 380), (330, 480, 440, 600)),
    ('archer', 'frames/critic_chars_r5_menu/menu_continue_archer.png', isgrn, (862, 545, 892, 600), 'art/char_refs/archer_a.png', 860, (318, 330, 350, 470), (340, 300, 420, 420)),
]
for name, fr, pred, gb, sh, SH, sb, cb in CASES:
    g = Image.open(os.path.join(ROOT, fr)).convert('RGB')
    rows, m, sd = band(g, pred, *gb)
    tall = [w for w in rows if w >= 3]
    print(f'{name} arch: {sum(rows)} px = {sum(rows)/GH**2*1e4:.0f}e-4 H^2, rows >= 3 px: {len(tall)} = {len(tall)/GH:.3f} H, widest {max(rows)} px = {max(rows)/GH:.3f} H, median width {sorted(tall)[len(tall)//2] if tall else 0} px; Lab {tuple(round(v,1) for v in m)} sdL {sd:.1f}')
    if sb:
        s = Image.open(os.path.join(ROOT, sh)).convert('RGB')
        r2, m2, sd2 = band(s, pred, *sb); t2 = [w for w in r2 if w >= 3 * SH / GH]
        _, mc, sdc = band(s, pred, *cb)
        print(f'  sheet: {sum(r2)} px = {sum(r2)/SH**2*1e4:.0f}e-4 H^2, rows: {len(t2)} = {len(t2)/SH:.3f} H, widest {max(r2)/SH:.3f} H; Lab {tuple(round(v,1) for v in m2)}; sheet cloth Lab {tuple(round(v,1) for v in mc)} sdL {sdc:.1f}; dE76 game fill vs sheet cloth {sum((a-b)**2 for a,b in zip(m,mc))**0.5:.1f}')
