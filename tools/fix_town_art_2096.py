import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from fix_town_art_2094 import to_lab, from_lab, pct

STAMP = "20261116-2096"
# stairs: the r9 critic's jamb window read L50 35 / a 20 against 13 / 10 in the ref, so the stone goes to half its L* and 0.4 of its a*;
# seams are pixels well under their neighbourhood, pushed near black so the arch keeps the ref's black joints under the braziers' light
# disc: the source is drawn ~12x larger than the game shows it, so its own 8 px rings vanish; the new grooves are ~2 px on screen
PARAMS = {
    "stairs_tw": {"a_min": 2, "b_max": 15, "l_mul": 0.5, "a_mul": 0.4, "sigma": 5, "seam_drop": 5, "seam_l": 2.5},
    "disc_tw": {"rings": [0.26, 0.5], "spokes": 8, "spoke_r": [0.5, 0.8], "groove": 0.024, "lip": 0.02, "lip_raise": 16,
                "groove_l": 4, "a_mul": 0.7},
}


def stairs(rgb, a, p):
    op = a > 0
    lab = to_lab(rgb.astype(float))
    L = lab[..., 0]
    stone = op & (lab[..., 1] > p["a_min"]) & (lab[..., 2] < p["b_max"])
    w = op.astype(float)
    loc = ndi.gaussian_filter(L * w, p["sigma"]) / np.maximum(ndi.gaussian_filter(w, p["sigma"]), 1e-6)
    seam = op & (L <= loc - p["seam_drop"]) & (lab[..., 2] < p["b_max"])
    before = pct(L[stone])
    lab[stone, 0] *= p["l_mul"]
    lab[stone, 1] *= p["a_mul"]
    lab[seam, 0] = np.minimum(lab[seam, 0], p["seam_l"])
    print("stone %d px L* p5/p50/p95 %s -> %s; seams %d px" % (stone.sum(), before, pct(lab[stone, 0]), seam.sum()))
    return from_lab(lab).astype(np.uint8), a


def disc(rgb, a, p):
    op = a > 0
    ys, xs = np.nonzero(op)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rx, ry = (xs.max() - xs.min()) / 2, (ys.max() - ys.min()) / 2
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    u, v = (xx - cx) / rx, (yy - cy) / ry
    r = np.hypot(u, v)
    ang = np.arctan2(v, u)
    g, lip = p["groove"], p["lip"]
    groove = np.zeros_like(op)
    lipm = np.zeros_like(op)
    for rr in p["rings"]:
        groove |= np.abs(r - rr) < g
        lipm |= (r - rr >= g) & (r - rr < g + lip) & (v > 0)
        lipm |= (rr - r >= g) & (rr - r < g + lip) & (v < 0)
    step = 2 * np.pi / p["spokes"]
    sd = (((ang + step / 2) % step) - step / 2) * r
    band = (r > p["spoke_r"][0]) & (r < p["spoke_r"][1])
    groove |= band & (np.abs(sd) < g)
    lipm |= band & (sd >= g) & (sd < g + lip)
    groove &= op
    lipm &= op & ~groove
    lab = to_lab(rgb.astype(float))
    before = pct(lab[op, 0])
    lab[op, 1] *= p["a_mul"]
    lab[groove, 0] = np.minimum(lab[groove, 0], p["groove_l"])
    lab[groove, 1:] *= 0.4
    lab[lipm, 0] = np.clip(lab[lipm, 0] + p["lip_raise"], 0, 100)
    print("L* p5/p50/p95 %s -> %s  (groove %d px, lip %d px)" % (before, pct(lab[op, 0]), groove.sum(), lipm.sum()))
    return from_lab(lab).astype(np.uint8), a


# 2131: the disc stood in the frame at the pave's own tone with dark grooves, so the mip's average read as the pave seen through glass.
# The ref's disc is dark slate under bright amber carving: the stone goes dark and cool, the old grooves filled, the carving
# re-cut as amber lines `line` px wide on screen (the disc is shown about `scr` px, so the widths are screen px, not the source's),
# and a dark lip round the edge parts it from the pave
STONE = {"disc_tw": {"scr": [83.2, 35.5], "l0": 20, "l_k": 0.45, "l_rng": [10, 32], "ab": [2.5, -2.5], "fill_l": 8, "rings": [0.22, 0.5, 0.8],
                     "spokes": 8, "spoke_r": [0.5, 0.8], "line": 1.3, "amber": [72, 22, 50], "lip": 1.3, "lip_l": 6, "cut": 128,
                     "stamp": "20261116-2131"}}


def disc_stone(rgb, a, p):
    op = a >= p["cut"]
    ys, xs = np.nonzero(op)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    sx, sy = (xs.max() - xs.min()) / p["scr"][0], (ys.max() - ys.min()) / p["scr"][1]
    A, B = (xs.max() - xs.min()) / 2 / sx, (ys.max() - ys.min()) / 2 / sy
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    X, Y = (xx - cx) / sx, (yy - cy) / sy
    r = np.maximum(np.hypot(X / A, Y / B), 1e-6)
    grad = np.hypot(X / A ** 2, Y / B ** 2) / r
    half = p["line"] / 2
    line = np.zeros_like(op)
    for rr in p["rings"]:
        line |= np.abs(r - rr) / np.maximum(grad, 1e-6) < half
    for k in range(p["spokes"]):
        th = (k + 0.5) * 2 * np.pi / p["spokes"]
        dx, dy = A * np.cos(th), B * np.sin(th)
        n = np.hypot(dx, dy)
        along = (X * dx + Y * dy) / n
        line |= (np.abs(X * dy - Y * dx) / n < half) & (along > 0) & (r > p["spoke_r"][0]) & (r < p["spoke_r"][1])
    lip = op & ((1 - r) / np.maximum(grad, 1e-6) < p["lip"])
    lab = to_lab(rgb.astype(float))
    L = lab[..., 0]
    before = pct(L[op])
    old = op & (L < p["fill_l"])
    src = np.where(old, np.nan, L)
    ok = ~np.isnan(src)
    idx = ndi.distance_transform_edt(~ok, return_distances=False, return_indices=True)
    L = src[tuple(idx)]
    lab[..., 0] = np.clip(p["l0"] + p["l_k"] * (L - np.median(L[op])), *p["l_rng"])
    lab[..., 1], lab[..., 2] = p["ab"]
    line &= op & ~lip
    lab[line] = p["amber"]
    lab[lip, 0] = p["lip_l"]
    print("L* p5/p50/p95 %s -> %s  (old grooves %d px filled, lines %d px, lip %d px)" % (before, pct(lab[op, 0]), old.sum(), line.sum(), lip.sum()))
    return from_lab(lab).astype(np.uint8), np.where(op, 255, 0).astype(np.uint8)


FUNCS = {"stairs_tw": stairs, "disc_tw": disc}


def assets_crop(name, res):
    import json, re
    meta = json.loads(re.search(r"=\s*(\{.*\})", open("live/assets.js").read(), re.S).group(1))[name]
    x0, y0, x1, y1 = meta["crop"]
    out = Image.fromarray(res, "RGBA").crop((x0, y0, x1, y1))
    assert out.size == (meta["w"], meta["h"]), (out.size, meta)
    return out


def run_stone(name):
    p = STONE[name]
    src = "art/gen/%s.png" % name
    bak = "art/old/%s-%s.png" % (name, p["stamp"])
    if os.path.exists(bak) and "--dry" not in sys.argv:
        sys.exit("backup exists: " + bak)
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    print(name, "(2131 stone)")
    out_rgb, out_a = disc_stone(arr[..., :3], arr[..., 3], p)
    res = np.dstack([out_rgb, out_a]).astype(np.uint8)
    res[out_a == 0, :3] = arr[out_a == 0, :3]
    if "--dry" in sys.argv:
        assets_crop(name, res).save(os.environ.get("DRY_OUT", "/tmp") + "/%s.png" % name)
        return
    im.save(bak)
    Image.open("live/assets/%s.png" % name).save("art/old/%s-%s-live.png" % (name, p["stamp"]))
    Image.fromarray(res, "RGBA").save(src)
    assets_crop(name, res).save("live/assets/%s.png" % name)


def run(name):
    src = "art/gen/%s.png" % name
    bak = "art/old/%s-%s.png" % (name, STAMP)
    if os.path.exists(bak):
        sys.exit("backup exists: " + bak)
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    rgb, a = arr[..., :3], arr[..., 3]
    print(name)
    out_rgb, out_a = FUNCS[name](rgb, a, PARAMS[name])
    res = np.dstack([out_rgb, out_a]).astype(np.uint8)
    res[a == 0, :3] = rgb[a == 0]
    if "--dry" in sys.argv:
        Image.fromarray(res, "RGBA").save(os.environ.get("DRY_OUT", "/tmp") + "/%s.png" % name)
        return
    im.save(bak)
    Image.fromarray(res, "RGBA").save(src)


if __name__ == "__main__":
    if "--stone" in sys.argv:
        run_stone(sys.argv[1])
        sys.exit()
    names = list(FUNCS) if sys.argv[1] == "all" else [sys.argv[1]]
    for n in names:
        run(n)
