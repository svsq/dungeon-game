import sys, os
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from fix_town_art_2094 import to_lab, from_lab

STAMP = "20261116-2109"
NAMES = ["cart_tw_f", "cart_tw_f_half", "cart_tw_f_empty"]
# the head-on cart is first seen against the adit's black mouth: its planks, rim and load are lifted, the ink line kept (TASKS 2109)
P = {"ink": 12, "wood": (1.18, 6), "rim": (55, 8), "ore": (1.22, 5), "top": 90}


def lift(rgb, a):
    lab = to_lab(rgb.astype(float))
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    on = (a > 0) & (L > P["ink"])
    wood = on & (A > 8) & (B > 12)
    ore = on & ~wood & (np.hypot(A, B) < 12)
    out = L.copy()
    out[wood] = L[wood] * P["wood"][0] + P["wood"][1]
    out[wood & (L > P["rim"][0])] += P["rim"][1]
    out[ore] = L[ore] * P["ore"][0] + P["ore"][1]
    lab[..., 0] = np.minimum(out, P["top"])
    res = from_lab(lab)
    res[~on] = rgb[~on]
    return res


def run(name):
    src = "art/gen/%s.png" % name
    bak = "art/old/%s-%s.png" % (name, STAMP)
    if os.path.exists(bak):
        sys.exit("backup exists: " + bak)
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    im.save(bak)
    res = np.dstack([lift(arr[..., :3], arr[..., 3]), arr[..., 3]]).astype(np.uint8)
    Image.fromarray(res, "RGBA").save(src)
    print(name)


if __name__ == "__main__":
    for n in NAMES if sys.argv[1] == "all" else [sys.argv[1]]:
        run(n)
