import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from orb_r3 import HAND, V2, V2_BODY, V2_ORB  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
OUT = ROOT / "frames/char_refs_r4/mage_a_v4_script.png"

SCALE = 0.6
CELL = 4
COLORS = 16
BODY_R = (V2_BODY[2] - V2_BODY[0] + 1) / 2
CENTER = (614, int(V2_BODY[3] - BODY_R * SCALE) + 2)


def masks(a):
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    ox, oy, orad = V2_ORB
    hx0, hy0, hx1, hy1 = HAND
    in_hand = (xx >= hx0) & (xx <= hx1) & (yy >= hy0) & (yy <= hy1)
    blue = a[..., 2] > a[..., 0] + 18
    bright = a.sum(-1) > 450
    disc = (xx - ox) ** 2 + (yy - oy) ** 2 <= orad ** 2
    orb = disc & (xx >= 518) & (blue | bright) & ~in_hand
    body = (xx - ox) ** 2 + (yy - oy) ** 2 <= BODY_R ** 2
    hand_keep = in_hand & ~blue
    return orb, body, hand_keep


def fill_occluded(a, orb, body):
    out = a.copy()
    hole = body & ~orb
    ys, xs = np.where(hole)
    known = np.argwhere(orb)
    for y, x in zip(ys, xs):
        col = known[known[:, 1] == x]
        if len(col):
            out[y, x] = a[tuple(col[np.argmin(np.abs(col[:, 0] - y))])]
    return out, orb | body


def shrink_orb(a, orb, bg):
    ox, oy, orad = V2_ORB
    box = (ox - orad, oy - orad, ox + orad + 1, oy + orad + 1)
    rgb = Image.fromarray(np.where(orb[..., None], a, bg).astype(np.uint8)).crop(box)
    alpha = Image.fromarray((orb * 255).astype(np.uint8)).crop(box)
    pal = rgb.quantize(COLORS, method=Image.MEDIANCUT, dither=Image.NONE)
    n = round(rgb.width * SCALE)
    cells = round(n / CELL)
    small = rgb.filter(ImageFilter.UnsharpMask(radius=3, percent=120, threshold=2)).resize((cells, cells), Image.LANCZOS)
    small = small.quantize(palette=pal, dither=Image.NONE).convert("RGB")
    amask = alpha.resize((cells, cells), Image.BOX)
    side = cells * CELL
    return small.resize((side, side), Image.NEAREST), amask.point(lambda v: 255 if v > 110 else 0).resize((side, side), Image.NEAREST)


def mage_v4():
    a = np.asarray(Image.open(REFS / V2).convert("RGB")).astype(int)
    bg = a[5, 5].copy()
    orb, body, hand_keep = masks(a)
    full, orb_full = fill_occluded(a, orb, body)
    small, amask = shrink_orb(full, orb_full, bg)
    out = a.copy()
    out[orb] = bg
    x0 = CENTER[0] - small.width // 2
    y0 = CENTER[1] - small.height // 2
    s = np.asarray(small).astype(int)
    m = np.asarray(amask) > 0
    region = out[y0:y0 + s.shape[0], x0:x0 + s.shape[1]]
    region[m] = s[m]
    out[hand_keep] = a[hand_keep]
    return Image.fromarray(out.astype(np.uint8)), small.width


if __name__ == "__main__":
    im, side = mage_v4()
    im.save(OUT)
    print("v2 body diameter", BODY_R * 2, "v4 body diameter", round(BODY_R * 2 * SCALE), "orb+halo box", side, "centre", CENTER)
