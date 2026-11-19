#!/usr/bin/env python3
"""fix_cart_views_2140.py — the head-on cart paintings brought to their 3/4 ones' colour (TASKS 2140): at the change of view both are seen
under one light, and the head-on box was paler and greyer (frame Lab 34/17/21 against 30/26/28), its ore darker and bluer, its iron darker.
Each painting is split into ore (fix_cart_ore_2133's mask), ink, lit rims, wood, iron and wheels, and every class gets the mean and spread of L*, a*, b* the
same class has in the 3/4 painting of the same load; the alpha is not touched.
Edits live/assets/<name>.png and the same pixels of art/gen/<name>.png; old files go to art/old/<name>-<STAMP>.png.
usage: python3 tools/fix_cart_views_2140.py [--preview OUT.png]"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
from fix_town_art_2094 import to_lab, from_lab
import fix_cart_ore_2133 as ore

STAMP = "20261117-2140"
PAIRS = {"cart_tw_f": "cart_tw", "cart_tw_f_half": "cart_tw_half", "cart_tw_f_empty": "cart_tw_empty"}
# ink: the painted outline and plank lines, darker than the outline ring's median by up to `INK` L*; the head-on full painting's
# grade lifted its line to L* 19 against 7 in the 3/4 one (the pale contour at the change). `COOL`: the head-on ore the 2133 mask misses
# (the half load's blue lumps) is the cool part above the near rim
# `LIT`: the rims' lit edges (L*, b* over these), tan in the head-on paintings and orange in the 3/4 ones, matched as a class of their own
INK, RING, COOL, WOOD, LIT = 3, 6, 1, (9, 18), (50, 15)
# `WHEEL`: the wheels, matched apart from the box's iron: the 3/4 ones' discs within (rx, ry) of their hubs (ore.HUBS), the head-on slabs
# within `dx` of their centres (CART.wheelsF x) below `y` of the height. The slabs are 2 px on screen, their light middle averaged with
# their ink, so matched to the discs' mean they still showed L* 17 against 26 (tools/measure/cart2140/cartviews.py): they take `lift` L* more
WHEEL = {"r": (0.12, 0.17), "dx": 0.06, "y": 0.84, "x": (0.129, 0.871), "lift": 22}
# what the frame at the change of view still showed after the class match (cartviews.py, side - front): the full heap 3.8 L* lighter,
# the half box 1.7 darker; L* added per painting and class
FIT = {"cart_tw_f": {"ore": -4}, "cart_tw_f_half": {"wood": 2, "lit": 2}}
# the spread is matched halfway: the 3/4 wood holds the box's shaded inside walls, which the head-on face lacks
SPREAD = 0.5


def classes(name, lab, a):
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    on = a > 0
    line = np.median(L[on & ~ndi.binary_erosion(on, iterations=RING)]) + INK
    m_ore = ore.ore_mask(lab, a, name) if name in ore.LOADED else np.zeros_like(on)
    if name in ore.RIM and name in ore.LOADED:
        yy = np.mgrid[:a.shape[0], :a.shape[1]][0]
        m_ore |= on & (L >= line) & (B < COOL) & (yy < (1 - ore.RIM[name] + ore.P["below"]) * a.shape[0])
    ink = on & ~m_ore & (L < line)
    lit = on & ~m_ore & ~ink & (L > LIT[0]) & (B > LIT[1])
    wood = on & ~m_ore & ~ink & ~lit & (A > WOOD[0]) & (B > WOOD[1])
    iron = on & ~m_ore & ~ink & ~lit & ~wood
    h, w = a.shape
    yy, xx = np.mgrid[:h, :w]
    if name in ore.HUBS:
        near = np.zeros_like(on)
        for hx, hy in ore.HUBS[name]:
            near |= ((xx / w - hx) / WHEEL["r"][0]) ** 2 + ((yy / h - hy) / WHEEL["r"][1]) ** 2 < 1
    else:
        near = (yy > WHEEL["y"] * h) & np.any([np.abs(xx / w - x) < WHEEL["dx"] for x in WHEEL["x"]], 0)
    wheel = iron & near
    return {"ore": m_ore, "ink": ink, "lit": lit, "wood": wood, "iron": iron & ~wheel, "wheel": wheel}


def source(name):
    old = "art/old/%s-%s-asset.png" % (name, STAMP)
    return np.array(Image.open(old if os.path.exists(old) else "live/assets/%s.png" % name).convert("RGBA"))


def fix(name):
    im, ref = source(name), source(PAIRS[name])
    rgb, a = im[..., :3].astype(float), im[..., 3]
    lab, rlab = to_lab(rgb), to_lab(ref[..., :3].astype(float))
    cs, rc = classes(name, lab, a), classes(PAIRS[name], rlab, ref[..., 3])
    out, log = rgb.copy(), {}
    for k, m in cs.items():
        if not m.any() or not rc[k].any():
            continue
        src, dst = lab[m], rlab[rc[k] | (rc["wheel"] if k == "iron" else False)]
        mu, sd, rmu, rsd = src.mean(0), src.std(0) + 1e-6, dst.mean(0), dst.std(0)
        new = rmu + (src - mu) * (1 + (1 if k == "ink" else SPREAD) * (rsd / sd - 1))
        new[:, 0] = np.clip(new[:, 0] + (WHEEL["lift"] if k == "wheel" and name not in ore.HUBS else 0) + FIT.get(name, {}).get(k, 0), 0, 100)
        out[m] = from_lab(new)
        log[k] = (mu.round(1), rmu.round(1))
    return np.dstack([out, a]).astype(np.uint8), log


if __name__ == "__main__":
    names = list(PAIRS)
    sheet = Image.new("RGBA", (len(names) * 3 * 200, 400), (90, 90, 90, 255))
    for i, n in enumerate(names):
        res, log = fix(n)
        for k, (f, r) in log.items():
            print("%-16s %-5s Lab %s -> %s" % (n, k, f, r))
        for j, src in enumerate((source(n), res, source(PAIRS[n]))):
            t = Image.fromarray(src)
            t.thumbnail((190, 390))
            sheet.alpha_composite(t, ((i * 3 + j) * 200, 0))
        if "--preview" not in sys.argv:
            ore.STAMP = STAMP
            ore.save(n, res)
    if "--preview" in sys.argv:
        sheet.save(sys.argv[sys.argv.index("--preview") + 1])
