#!/usr/bin/env python3
"""fix_cart_ore_2133.py — one ore for every cart painting (TASKS 2133, town r10): the load is found by a mask and its L* is mapped by rank
onto one slate curve with one cold a*/b*, in the 3/4 and the head-on paintings alike; the head-on ones also get the shader grade
CART.grade had (TASKS 2122) baked into their box, so the draw no longer grades them and the heap is not flattened with the box.
Edits live/assets/<name>.png and the same pixels of art/gen/<name>.png; old files go to art/old/<name>-<STAMP>.png.
usage: python3 tools/fix_cart_ore_2133.py [--preview OUT.png]"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
from fix_town_art_2094 import to_lab, from_lab

STAMP = "20261116-2133"
# the 3/4 wheels' hubs and the head-on near rim, as live/data_town.js CART.hubs and CART.rim: grey iron below them is not ore
HUBS = {"cart_tw": [[0.595, 0.868], [0.946, 0.592]], "cart_tw_half": [[0.596, 0.854], [0.948, 0.549]], "cart_tw_empty": [[0.595, 0.851], [0.946, 0.547]]}
RIM = {"cart_tw_f": 0.51, "cart_tw_f_half": 0.6, "cart_tw_f_empty": 0.6}
GRADE = {"cart_tw_f": [1, 0.83, 0, 0.71], "cart_tw_f_half": [1, 0.79, 0, 1.1], "cart_tw_f_empty": [1, 0.81, 0, 0.88]}
LOADED = ["cart_tw", "cart_tw_half", "cart_tw_f", "cart_tw_f_half"]
# the ore's L* by rank: dark slate with light facets, near the mason's stone (town_tool_stone L* p50 37, p90 72, b* -9), which is also
# the one lump of load 1; the 3/4 heap was 22/43 and the graded head-on one 34 on the frame (town_assets_r10 1, town_fidelity_r10 1)
CURVE = ([0, 0.1, 0.5, 0.8, 0.9, 0.97, 1], [14, 19, 35, 52, 66, 76, 82])
AB = (2.0, -6.0, 0.35)
# the head-on paintings are only seen at the adit, in its lamp's hot core (scene_map.js TOWN_LIGHT.adit, warm [1, 0.72, 0.3]), which on the
# frame made the same slate 11 L* lighter, 13 b* yellower and greener than the 3/4 heap at the rails' end (tools/measure/assets/cartore.py):
# their ore is set darker by about that much luminance, colder and redder, so on screen both views show one ore
FRONT = {"y": 1 / 2.05, "a": 3.0, "b": -12.0}
P = {"chroma": 14, "ink": 12, "core": 600, "reach": 40, "speck": 300, "hub": (0.1, 0.14), "below": 0.02}


def ore_mask(lab, a, name):
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    h, w = L.shape
    yy, xx = np.mgrid[:h, :w]
    grey = (a > 0) & (np.hypot(A, B) < P["chroma"]) & (L > P["ink"])
    keep = np.ones_like(grey)
    for hx, hy in HUBS.get(name, []):
        keep &= ((xx / w - hx) / P["hub"][0]) ** 2 + ((yy / h - hy) / P["hub"][1]) ** 2 > 1
    if name in RIM:
        keep &= yy < (1 - RIM[name] + P["below"]) * h
    core = grey & keep
    lab_, k = ndi.label(core)
    core = np.isin(lab_, 1 + np.where(ndi.sum(core, lab_, range(1, k + 1)) >= P["core"])[0])
    reg = ndi.binary_fill_holes(ndi.binary_dilation(core, iterations=P["reach"]))
    wood = (A > 9) & (B > 18)
    m = reg & (a > 0) & ~wood & (L > P["ink"]) & (core | ~grey)
    lab_, k = ndi.label(m)
    return np.isin(lab_, 1 + np.where(ndi.sum(m, lab_, range(1, k + 1)) >= P["speck"])[0])


def bake(rgb, g):
    c = rgb / 255.0
    l = c @ [0.299, 0.587, 0.114]
    c = (l[..., None] + (c - l[..., None]) * g[0]) * g[1]
    c = (c - 0.5) * g[3] + 0.5
    return np.clip(np.round(c * 255), 0, 255)


def L_of_y(L, k):
    y = np.where(L > 8, ((L + 16) / 116) ** 3, L / 903.3) * k
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def fix(name):
    old = "art/old/%s-%s-asset.png" % (name, STAMP)
    im = np.array(Image.open(old if os.path.exists(old) else "live/assets/%s.png" % name).convert("RGBA"))
    rgb, a = im[..., :3].astype(float), im[..., 3]
    lab = to_lab(rgb)
    out = rgb.copy()
    if name in GRADE:
        out[a > 0] = bake(rgb[a > 0], GRADE[name])
    m = ore_mask(lab, a, name) if name in LOADED else np.zeros_like(a, bool)
    if m.any():
        L = lab[..., 0][m]
        rank = np.argsort(np.argsort(L, kind="stable"), kind="stable") / max(1, L.size - 1)
        A, B = lab[..., 1][m], lab[..., 2][m]
        Lt, bt = np.interp(rank, *CURVE), AB[1]
        if name in RIM:
            Lt, bt = np.maximum(L_of_y(Lt, FRONT["y"]), CURVE[1][0]), bt + FRONT["b"]
        at = AB[0] + (FRONT["a"] if name in RIM else 0)
        new = np.stack([Lt, at + (A - A.mean()) * AB[2], bt + (B - B.mean()) * AB[2]], -1)
        out[m] = from_lab(new)
    res = np.dstack([out, a]).astype(np.uint8)
    return res, m


def save(name, res):
    gen = "art/gen/%s.png" % name
    g = np.array(Image.open(gen).convert("RGBA"))
    ys, xs = np.where(g[..., 3] > 0)
    y0, x0 = ys.min() - 4, xs.min() - 4
    sub = g[y0:y0 + res.shape[0], x0:x0 + res.shape[1]]
    if sub.shape != res.shape or ((sub[..., 3] > 0) != (res[..., 3] > 0)).any():
        sys.exit("art/gen/%s.png is not the asset's source" % name)
    for src in (gen, "live/assets/%s.png" % name):
        bak = "art/old/%s-%s%s.png" % (name, STAMP, "" if src == gen else "-asset")
        if not os.path.exists(bak):
            Image.open(src).save(bak)
    on = res[..., 3] > 0
    sub[on] = res[on]
    Image.fromarray(g).save(gen)
    Image.fromarray(res).save("live/assets/%s.png" % name)


if __name__ == "__main__":
    names = LOADED + ["cart_tw_empty", "cart_tw_f_empty"]
    sheet = Image.new("RGBA", (len(names) * 300, 600), (128, 128, 128, 255))
    for i, n in enumerate(names):
        res, m = fix(n)
        if m.any():
            L = to_lab(res[..., :3][m].astype(float))
            print("%-16s ore px %6d  L* p10/50/90 %s  a %.1f b %.1f" % (n, m.sum(), np.percentile(L[:, 0], [10, 50, 90]).round(1), L[:, 1].mean(), L[:, 2].mean()))
        old = "art/old/%s-%s-asset.png" % (n, STAMP)
        for j, src in enumerate((np.array(Image.open(old if os.path.exists(old) else "live/assets/%s.png" % n).convert("RGBA")), res)):
            t = Image.fromarray(src)
            t.thumbnail((290, 290))
            sheet.alpha_composite(t, (i * 300, j * 300))
        if "--preview" not in sys.argv:
            save(n, res)
    if "--preview" in sys.argv:
        sheet.save(sys.argv[sys.argv.index("--preview") + 1])
