#!/usr/bin/env python3
"""fix_headback_2134.py — the back of the hero's head in chestnut (TASKS 2134, town_assets_r10 2): the repaint of 2092 lit its top
peach, lighter than the paving and 1.7 times the front hair, so it read bald. Its hair is mapped by rank of L* onto the front hair's
curve a step lighter, with the front's a*/b*, so the strands keep their order and the dark gaps stay dark. The ear and the ink are kept.
Edits the head of art/gen/hero_body_back.png and the head rows of the outfits' backs; old files go to art/old/<name>-<STAMP>.png.
usage: python3 tools/fix_headback_2134.py [--preview OUT.png]"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
from fix_town_art_2094 import to_lab, from_lab
from gear import HEAD

STAMP = "20261116-2134"
# headback_2092.py's CUT: the gold collar starts below it in the source
SRC = ("art/gen/hero_body_back.png", 452)
BACKS = [("live/assets/hero__body_back%s.png" % s, HEAD["body_back"]) for s in ("", "_cl", "_le", "_pw")]
# the front hair (live/assets/hero__body.png, head rows, L* 15..55) is L* p10/50/90/99 16/21/27/33, a* 18, b* 18; the back is lit
# from above, so a step lighter at its top, and no lighter than RGB 150/90/60 (L* 44), the r10 ceiling
CURVE = ([0, 0.1, 0.5, 0.9, 0.99, 1], [15, 18, 25, 36, 42, 44])
AB = (19.0, 21.0, 0.5)
# the gaps between strands are 1 px ink lines in the 188 px back, a quarter of a pixel in play: widened by `gap` px either side to
# L* `gapL` they hold as one dark pixel (r10: gaps L* <= 20, one art px); the outline (ink within `rim` px of the transparent) is not widened
P = {"ink": 15, "ear": (0.68, 0.75), "gap": 1, "gapL": 17, "rim": 2}


def hair(lab, a):
    L = lab[..., 0]
    ys, xs = np.where(a)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    yy, xx = np.mgrid[:L.shape[0], :L.shape[1]]
    ear = (xx >= x0 + P["ear"][0] * (x1 - x0)) & (yy >= y0 + P["ear"][1] * (y1 - y0))
    return a & (L >= P["ink"]) & ~ear


def gaps(lab, a, m, scale):
    ink = a & (lab[..., 0] < P["ink"])
    rim = ndi.binary_dilation(~a, iterations=max(1, round(P["rim"] * scale)))
    return m & ndi.binary_dilation(ink & ~rim, iterations=max(1, round(P["gap"] * scale)))


def recolour(im, rows, scale):
    out = im.copy()
    head = im[:rows]
    rgb, a = head[..., :3].astype(float), head[..., 3] > 0
    lab = to_lab(rgb)
    m = hair(lab, a)
    L, A, B = lab[..., 0][m], lab[..., 1][m], lab[..., 2][m]
    rank = np.argsort(np.argsort(L, kind="stable"), kind="stable") / max(1, L.size - 1)
    new = np.stack([np.interp(rank, *CURVE), AB[0] + (A - A.mean()) * AB[2], AB[1] + (B - B.mean()) * AB[2]], -1)
    res = rgb.copy()
    res[m] = from_lab(new)
    g = gaps(lab, a, m, scale)
    dark = to_lab(res[g])
    dark[:, 0] = np.minimum(dark[:, 0], P["gapL"])
    res[g] = from_lab(dark)
    out[:rows, :, :3] = res.astype(np.uint8)
    return out, m


def keep(path):
    bak = "art/old/%s-%s.png" % (os.path.splitext(os.path.basename(path))[0], STAMP)
    if not os.path.exists(bak):
        Image.open(path).save(bak)
    return bak


if __name__ == "__main__":
    prev = "--preview" in sys.argv
    sheet = Image.new("RGBA", (2 * 188 * 4, 80 * 4), (128, 128, 128, 255))
    for i, (path, rows) in enumerate([SRC] + BACKS):
        bak = "art/old/%s-%s.png" % (os.path.splitext(os.path.basename(path))[0], STAMP)
        im = np.array(Image.open(bak if os.path.exists(bak) else path).convert("RGBA"))
        out, m = recolour(im, rows, 1 if rows == HEAD["body_back"] else 4)
        print("%-40s hair px %6d  L* p50/90 %s -> %s" % (path, m.sum(), np.percentile(to_lab(im[:rows][m][:, :3].astype(float))[:, 0], [50, 90]).round(1),
                                                         np.percentile(to_lab(out[:rows][m][:, :3].astype(float))[:, 0], [50, 90]).round(1)))
        if i == 1:
            for j, x in enumerate((im, out)):
                sheet.alpha_composite(Image.fromarray(x[:80]).resize((188 * 4, 320), Image.NEAREST), (j * 188 * 4, 0))
                sm = Image.fromarray(x[:80]).resize((44, 19), Image.BOX).resize((44 * 8, 19 * 8), Image.NEAREST)
                sheet.alpha_composite(sm, (j * 188 * 4 + 400, 160))
        if not prev:
            keep(path)
            Image.fromarray(out).save(path)
    if prev:
        sheet.save(sys.argv[sys.argv.index("--preview") + 1])
