"""ref critic r4: the near-shoulder wedge as the eye sees it. heroShoulderCheck (live/sim_checks_shoulder.js) counts only pixels no figure
   sprite covers; the author's frame 25 shows the cape (a 'behind' layer, but a drawn colour) and dark ink between the sleeve, the
   pauldron and the torso. Here, for every view of grab_r4.mjs: figure = the hero without its cape; wedge = pixels inside the figure's
   closing (radius 0.03 H) near the near shoulder that show the cape or the scene (cape/hole), plus the dark ink seam (L < 22) that
   runs between two different parts there. Counts in screen px and in world px (/(3.2^2) in the arch), crops x6 with the wedge green.
   python3 tools/measure/chars_ref/shoulder_r4.py [frames/critic_chars_r4_ref]"""
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(os.environ.get('ROOT', Path(__file__).resolve().parents[3]))
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'frames/critic_chars_r4_ref')
LY = OUT / 'layers'; CUT = OUT / 'cut4'; CUT.mkdir(exist_ok=True)
M = json.load(open(LY / 'meta.json'))
J0 = json.load(open(OUT / 'game/joints.json'))   # the arch's joints (grab.mjs): the layer renders trace no menu joints
img = lambda v, k: np.asarray(Image.open(LY / f'{v}__{k}.png').convert('RGB')).astype(int)
for v, r in M.items():
    if 'mage' in v or not (LY / f'{v}__no_cape.png').exists():
        continue
    j = r['joints'] if 'ground' in r['joints'] else J0['arch_' + v.split('_')[1]]['joints']; bx, by = r['box'][:2]; at = r.get('at') if v.startswith('arch') else None
    k = at[2] if at else 1
    P = (lambda p: (at[0] + (p[0] - at[0]) * k - bx, at[1] + (p[1] - at[1]) * k - by)) if at else (lambda p: (p[0] - bx, p[1] - by))
    A, N, NC = img(v, 'all'), img(v, 'none'), img(v, 'no_cape')
    fig = np.abs(NC - N).sum(2) > 24                      # the hero without the cape
    cape = (np.abs(A - NC).sum(2) > 24) & ~fig             # cape pixels showing
    hero = np.abs(A - N).sum(2) > 24
    H = (j['ground'][1] - j['top'][1]) * k
    rad = max(2, round(0.03 * H))
    closed = ndi.binary_closing(np.pad(fig, rad), structure=np.ones((3, 3)), iterations=rad)[rad:-rad, rad:-rad]
    wedge_cape = closed & cape; wedge_hole = closed & ~hero
    # ink seam: dark pixels of the figure whose 5x5 window holds two different parts (uarmL vs body) — read from the part renders
    U = np.abs(img(v, 'only_uarmL') - N).sum(2) > 24; B = np.abs(img(v, 'only_body') - N).sum(2) > 24
    Lum = A.mean(2)
    seam = fig & (Lum < 30) & ndi.binary_dilation(U & ~B, iterations=2) & ndi.binary_dilation(B & ~U, iterations=2)
    x, y = P(j['shL']); ex, ey = P(j['elbowL'])
    ys, xs = np.mgrid[0:A.shape[0], 0:A.shape[1]]
    up = max(1.0, np.hypot(ex - x, ey - y)); ax, ay = (ex - x) / up, (ey - y) / up
    along = (xs - x) * ax + (ys - y) * ay; off = np.abs((xs - x) * ay - (ys - y) * ax)
    near = (along > -0.05 * H) & (along < up + 0.03 * H) & (off < 0.09 * H)
    wc, wh, sm = int((wedge_cape & near).sum()), int((wedge_hole & near).sum()), int((seam & near).sum())
    w = 1 / (k * k)
    # the visible upper arm: how much of the uarmL sprite shows, and whether the pauldron/sleeve has the torso's shoulder line over it
    print(f'{v:28s} H={H:5.1f}  cape in wedge {wc:4d} px ({wc*w:5.1f} world px²)  scene holes {wh:3d} ({wh*w:4.1f})  ink seam arm|body {sm:4d} px ({sm*w:5.1f})')
    if wc + wh + sm:
        c = A.copy().astype(float)
        c[wedge_cape & near] = c[wedge_cape & near] * 0.3 + np.array([0, 255, 0]) * 0.7
        c[wedge_hole & near] = [255, 0, 255]
        c[seam & near] = c[seam & near] * 0.3 + np.array([255, 255, 0]) * 0.7
        x0, y0 = int(max(0, x - 0.16 * H)), int(max(0, y - 0.08 * H))
        t = Image.fromarray(c.clip(0, 255).astype(np.uint8)[y0:int(y + 0.4 * H), x0:int(x + 0.2 * H)])
        z = 3 if at else 8
        t.resize((t.width * z, t.height * z), Image.NEAREST).save(CUT / f'{v}.png')
