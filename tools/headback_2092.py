#!/usr/bin/env python3
"""headback_2092.py — the hero's back of the head repainted (TASKS 2092, round 9): a generation over the crop of the approved back
(art/prompts/hero_head_back.txt) is fitted back onto art/gen/hero_body_back.png and replaces it above the collar; the cape, collar and
shoulders stay the approved back's. Then tools/fitback.py and tools/backgear.py carry it to the rig and the outfits.
usage: python3 tools/headback_2092.py art/gen/hero_head_back_cN.png [--preview OUT.png]"""
import shutil, sys, os
import numpy as np
from PIL import Image

SRC = 'art/gen/hero_body_back.png'
OLD = 'art/old/hero_body_back-20261116-2092b.png'
# the crop the generation was given (art/raw/ref_head_back_2092b.png) and the row of the source just above the gold collar: the cut
# runs through the dark neck strip, where old and new are the same near-black
CROP = (292, 140, 740, 560)
CUT = 452

def fit(cand, ref):
    """scale and offset of the candidate onto the crop: best alpha overlap of the head (above the cut), searched coarse to fine"""
    ra = ref[:CUT - CROP[1], :, 3] > 0
    best = (-1, None)
    for s in np.arange(0.38, 0.46, 0.0025):
        w, h = round(cand.width * s), round(cand.height * s)
        ca = np.array(cand.resize((w, h), Image.NEAREST))[:, :, 3] > 0
        for dy in range(-16, 17, 2):
            for dx in range(-16, 17, 2):
                pad = np.zeros((ra.shape[0] + 64, ra.shape[1] + 64), bool)
                y0, x0 = 32 + dy, 32 + dx
                hh, ww = min(h, pad.shape[0] - y0), min(w, pad.shape[1] - x0)
                pad[y0:y0 + hh, x0:x0 + ww] = ca[:hh, :ww]
                c = pad[32:32 + ra.shape[0], 32:32 + ra.shape[1]]
                iou = (c & ra).sum() / max(1, (c | ra).sum())
                if iou > best[0]: best = (iou, (s, dx, dy))
    return best

def compose(path):
    src = Image.open(SRC if not os.path.exists(OLD) else OLD).convert('RGBA'); cand = Image.open(path).convert('RGBA')
    ref = np.array(src.crop(CROP)); iou, (s, dx, dy) = fit(cand, ref)
    small = cand.resize((round(cand.width * s), round(cand.height * s)), Image.LANCZOS)
    layer = Image.new('RGBA', src.size); layer.alpha_composite(small, (CROP[0] + dx, CROP[1] + dy))
    out = np.array(src); new = np.array(layer); new[:, :, 3] = np.where(new[:, :, 3] > 110, 255, 0)
    out[:CUT] = new[:CUT]
    return Image.fromarray(out), iou, (s, dx, dy)

def rig():
    # fitback.py's placement, copied: importing it would rerun it and rewrite every back
    import json, re
    from gear import HEAD
    R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))['hero']
    op = lambda im: np.array(im)[:, :, 3] > 110
    fy, _ = np.where(op(Image.open('art/gen/hero__body.png')))
    old = Image.open(OLD).convert('RGBA'); a = op(old); ys, xs = np.where(a)
    S = (fy.max() - fy.min()) / (ys.max() - ys.min())
    band = range(ys.min() + int(0.15 * (ys.max() - ys.min())), ys.min() + int(0.35 * (ys.max() - ys.min())))
    w = max(band, key=lambda y: np.ptp(np.where(a[y])[0])); row = np.where(a[w])[0]; mid = (row.min() + row.max()) / 2
    ox, oy = round((R['shL'][0] + R['shR'][0]) / 2 - mid * S), round(fy.min() - ys.min() * S)
    def place(im):
        small = im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS)
        out = Image.new('RGBA', (R['w'], R['h'])); out.alpha_composite(small, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
        arr = np.array(out); arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0); return arr
    H = HEAD['body_back']; check = place(old)[:H]; head = place(Image.open(SRC).convert('RGBA'))[:H]
    print('scale', round(S, 4), 'offset', ox, oy)
    for n in ('hero__body_back', 'hero__body_back_cl', 'hero__body_back_le', 'hero__body_back_pw'):
        dst = f'live/assets/{n}.png'; cur = np.array(Image.open(dst).convert('RGBA'))
        print(n, 'old head reproduced on', round(float(((check[..., 3] > 0) == (cur[:H, :, 3] > 0)).mean()), 4), 'of its alpha')
        if '--dry' not in sys.argv: cur[:H] = head; Image.fromarray(cur).save(dst)

if __name__ == '__main__':
    if '--rig' in sys.argv: rig(); sys.exit()
    img, iou, f = compose(sys.argv[1])
    if '--preview' in sys.argv: img.save(sys.argv[sys.argv.index('--preview') + 1])
    else:
        if not os.path.exists(OLD): shutil.copy(SRC, OLD)
        img.save(SRC)
    print('fit iou', round(iou, 3), 'scale/dx/dy', [round(v, 4) for v in f])
