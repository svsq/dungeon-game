#!/usr/bin/env python3
"""TASKS 2187: the mage's orb hand, palm up under the orb with the fingers curled round it, and that forearm without its hand.

The cup (mage__cupL) is its own small sprite drawn over the orb by drawHero, upright whatever the forearm's turn: the palm a bowl under
the orb's lower edge (the orb sinks SINK art px into it), three fingers curled up the orb's outer side with their tips on its face, the
thumb across its lower front from the wrist, the wrist a stub on the body's side that meets the sleeve. Built from shapes in art pixels
of PIX rig px and toned with the hand's own palette (fist_2177.palette), as the staff fist is; _menu is the cup as built, the world
texture the same cup in cells of the world grid (fist_2177.cells), where only its silhouette survives: a bowl of skin cells under the
orb and one or two finger cells on its outer edge.
The cuff (mage__cuffL, world and _menu) is the forearm (farmL) cut where its sleeve ends, so the drawn hand does not show under the cup.
  python3 tools/cup_2187.py run        art/gen/mage__cupL(_menu).png, mage__cuffL(_menu).png; prints the anchors for scene_hero.js ORB_CUP
  python3 tools/cup_2187.py sheet out.png   the cup over the arch orb ×8 beside the orb hand of mage_a_v4.png at the same orb size"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import fist_2177 as F

RIG, PIX, CELLS = 'mage', 2, 42
OUT = os.environ.get('OUT', 'art/gen')
# the orb as drawn on the palm: 14 px of the hero's 84 is 60 rig px, ORB_R art px round its centre O in the cup's canvas
W, H, ORB_R, O, SINK = 28, 20, 15, (17.0, -1.0), 1.5
# the pieces in art px, drawn in this order, each later one over the earlier: the wrist (polyline, radius) from the sleeve on the body's
# side; the palm a bowl (centre, half width, half height) under the orb, its top hugging the orb's lower edge SINK px inside it; three
# fingers from the palm's outer end up round the orb's rim, their tips curled in on its face, the back one outermost and highest; the
# thumb from the wrist across the orb's lower front
WRIST = ([(22.5, 14.5), (26.0, 13.6)], 2.8)
PALM = ((14.0, 15.3), 10.5, 3.3)
FINGERS = [([(4.5, 13.5), (3.0, 9.0), (2.8, 4.5), (4.6, 1.6)], 1.6), ([(7.5, 14.5), (6.0, 10.5), (6.0, 6.5), (7.8, 5.0)], 1.6),
           ([(10.5, 15.0), (9.4, 12.0), (9.8, 9.6), (11.6, 8.6)], 1.6)]
THUMB = ([(23.0, 14.0), (21.0, 11.5), (19.6, 10.6)], 1.4)

def capsule(p, q, r):
    yy, xx = np.mgrid[0:H, 0:W] + 0.5; p, q = np.array(p), np.array(q); d = q - p; L2 = max(d @ d, 1e-9)
    t = np.clip(((xx - p[0]) * d[0] + (yy - p[1]) * d[1]) / L2, 0, 1)
    return np.hypot(xx - p[0] - t * d[0], yy - p[1] - t * d[1]) <= r

def stroke(pts, r):
    m = np.zeros((H, W), bool)
    for p, q in zip(pts, pts[1:]): m |= capsule(p, q, r)
    return m

def shapes():
    """the cup's pieces back to front: (mask, kind)"""
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    palm = (((xx - PALM[0][0]) / PALM[1]) ** 2 + ((yy - PALM[0][1]) / PALM[2]) ** 2 <= 1) & (np.hypot(xx - O[0], yy - O[1]) > ORB_R - SINK)
    return [(stroke(*WRIST), 'wrist'), (palm, 'palm')] + [(stroke(*f), 'finger') for f in FINGERS] + [(stroke(*THUMB), 'thumb')]

def tones():
    """tone map, -1 empty, 0 outline .. 4 highlight: each piece outlined against the empty canvas and edged a tone darker than its
    shadow against a piece under it (the gaps between the fingers), lit along its upper edge and shaded along its lower one"""
    t = np.full((H, W), -1); lab = np.full((H, W), -1)
    for k, (m, kind) in enumerate(shapes()):
        yy, xx = np.nonzero(m)
        for y, x in zip(yy, xx):
            nb = [(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            out = [not (0 <= v < H and 0 <= u < W) or not m[v, u] for v, u in nb]
            empty = any(o and (not (0 <= v < H and 0 <= u < W) or lab[v, u] < 0) for o, (v, u) in zip(out, nb))
            up = y == 0 or not m[y - 1, x]; down = y == H - 1 or not m[y + 1, x]
            if empty: c = 0
            elif any(out): c = 1
            elif kind == 'palm': c = 1 if y + 2 < H and not m[y + 2, x] else 2 if x > O[0] + 3 else 3
            elif kind == "wrist": c = 3 if y < 14 else 2
            elif y > 0 and (not m[y - 1, x] or y < 2 or not m[y - 2, x]): c = 4
            elif y + 2 < H and not m[y + 2, x]: c = 2
            else: c = 3
            t[y, x] = c; lab[y, x] = k
    return t

def cut_cuff(farm, R, d):
    E, Hd = np.array(R['elbowL']), np.array(R['handL']); u = (Hd - E) / np.linalg.norm(Hd - E)
    yy, xx = np.mgrid[0:farm.shape[0], 0:farm.shape[1]] + 0.5
    out = farm.copy(); out[(xx - E[0]) * u[0] + (yy - E[1]) * u[1] > d] = 0; return out

def sleeve_end(farm, R):
    """how far down the forearm from the elbow its skin starts (the sleeve's end), in rig px"""
    E, Hd = np.array(R['elbowL']), np.array(R['handL']); u = (Hd - E) / np.linalg.norm(Hd - E)
    a = farm.astype(int); skin = (a[..., 3] > 200) & (a[..., 0] > 150) & (a[..., 0] - a[..., 2] > 60) & (a[..., 1] > 90)
    yy, xx = np.nonzero(skin); al = (xx + 0.5 - E[0]) * u[0] + (yy + 0.5 - E[1]) * u[1]
    al = al[al > 0.3 * np.linalg.norm(Hd - E)]
    return float(np.percentile(al, 2)), float(np.linalg.norm(Hd - E))

def anchors():
    wrist = (WRIST[0][-1][0] - 1, WRIST[0][-1][1])
    return {'w': W * PIX, 'h': H * PIX, 'orb': [O[0] / W, O[1] / H], 'wrist': [round(wrist[0] / W, 4), round(wrist[1] / H, 4)]}

def build():
    R = F.rigs()[RIG]; C = R['h'] / CELLS; names = []
    pal = F.palette('mage__farmL_menu', (40, 170, 80, 212))
    menu = F.paint(np.kron(tones(), np.ones((PIX, PIX), int)), pal)
    Image.fromarray(menu).save(f'{OUT}/{RIG}__cupL_menu.png'); Image.fromarray(F.cells(menu, C)).save(f'{OUT}/{RIG}__cupL.png')
    d, L = sleeve_end(F.load(f'art/gen/{RIG}__farmL_menu.png'), R)
    for m in ('', '_menu'):
        Image.fromarray(cut_cuff(F.load(f'art/gen/{RIG}__farmL{m}.png'), R, d)).save(f'{OUT}/{RIG}__cuffL{m}.png')
    names += [f'{RIG}__cupL', f'{RIG}__cupL_menu', f'{RIG}__cuffL', f'{RIG}__cuffL_menu']
    a = anchors(); a['cut'] = round(d / L, 3)
    print('ORB_CUP', json.dumps(a))
    print('python3 tools/prep.py --only ' + ','.join(names))

def sheet(out):
    """the cup on the arch orb at ×8 of the arch's texels, beside mage_a_v4's orb hand scaled to the same orb width"""
    a = anchors(); cup = Image.open(f'{OUT}/{RIG}__cupL_menu.png').convert('RGBA'); cw = cup.size[0]
    orb = Image.open('live/assets/orb_held_menu.png').convert('RGBA'); od = int(round(2 * ORB_R * PIX)); orb = orb.resize((od, od), Image.LANCZOS)
    k = 8; bg = Image.new('RGBA', (cw + 40, od + 60), (34, 30, 40, 255)); ox, oy = 20 + a['orb'][0] * cw - od / 2, 30 + a['orb'][1] * cup.size[1] - od / 2
    bg.alpha_composite(orb, (int(round(ox)), int(round(oy)) + 10)); bg.alpha_composite(cup, (20, 40))
    world = Image.open(f'{OUT}/{RIG}__cupL.png').convert('RGBA'); wb = Image.new('RGBA', bg.size, (34, 30, 40, 255)); wb.alpha_composite(orb, (int(round(ox)), int(round(oy)) + 10)); wb.alpha_composite(world, (20, 40))
    ref = Image.open('art/char_refs/mage_a_v4.png').convert('RGBA').crop((530, 290, 670, 440)); rs = od / 112; ref = ref.resize((int(ref.size[0] * rs), int(ref.size[1] * rs)), Image.LANCZOS)
    tiles = [t.resize((t.size[0] * k, t.size[1] * k), Image.NEAREST) for t in (bg, wb, ref)]
    o = Image.new('RGBA', (sum(t.size[0] + 8 for t in tiles), max(t.size[1] for t in tiles)), (0, 0, 0, 255)); x = 0
    for t in tiles: o.paste(t, (x, 0)); x += t.size[0] + 8
    o.save(out)

if __name__ == '__main__':
    if sys.argv[1:2] == ['run']: build()
    elif sys.argv[1:2] == ['sheet']: sheet(sys.argv[2])
    else: print(__doc__)
