import math
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"

PAL = {
    "W": (0xE8, 0xFB, 0xFF, 255),
    "C": (0x9F, 0xE6, 0xFF, 255),
    "L": (0x64, 0xBD, 0xEA, 255),
    "M": (0x3A, 0x7F, 0xD0, 255),
    "D": (0x22, 0x44, 0x8C, 255),
    "h": (0x3A, 0x7F, 0xD0, 120),
    "k": (0x64, 0xBD, 0xEA, 60),
}

ORB_SMALL = [
    "..kkhkk..",
    ".khMLMhk.",
    "khMLCLMhk",
    "hMLCWWCMh",
    "hLCWWCLMh",
    "hMCCLMMDh",
    "khMLMMDhk",
    ".khDDDhk.",
    "..kkhkk..",
]

V2 = "mage_a_v2.png"
V2_BODY = (516, 227, 686, 400)
V2_ORB = (601, 318, 140)
HAND = (540, 372, 665, 470)
CELL = 8
D3 = 13
HALO = 2
V3_CENTER = (614, 340)
RUNES = [(-4, 1), (3, -3)]


def small_orb():
    a = np.zeros((len(ORB_SMALL), len(ORB_SMALL[0]), 4), np.uint8)
    for j, row in enumerate(ORB_SMALL):
        for i, ch in enumerate(row):
            if ch != ".":
                a[j, i] = PAL[ch]
    return Image.fromarray(a)


def nearest_tone(rgb):
    tones = [PAL[k][:3] for k in "WCLMD"]
    return min(tones, key=lambda t: sum((int(rgb[i]) - t[i]) ** 2 for i in range(3)))


def darker(tone):
    keys = "WCLMD"
    k = next(k for k in keys if PAL[k][:3] == tone)
    return PAL[keys[min(keys.index(k) + 1, 4)]][:3]


def mix(c, bg, t):
    return tuple(round(c[i] * t + bg[i] * (1 - t)) for i in range(3))


def v2_body_cells(src):
    x0, y0, x1, _ = V2_BODY
    d = x1 - x0 + 1
    crop = src.crop((x0, y0, x0 + d, y0 + d)).resize((D3, D3), Image.BOX)
    return np.asarray(crop).astype(int)


def big_orb_cells(bg, body=None):
    n = D3 + 2 * HALO
    R = D3 / 2
    c = n / 2
    cells = {}
    for j in range(n):
        for i in range(n):
            x, y = i + 0.5 - c, j + 0.5 - c
            r = math.hypot(x, y) / R
            if r > 1 + (HALO - 0.2) / R:
                continue
            if r > 1:
                inner = r <= 1 + 1.1 / R
                cells[i, j] = mix(PAL["L"] if inner else PAL["M"], bg, 0.5 if inner else 0.24)
                continue
            if body is not None:
                tone = nearest_tone(body[j - HALO, i - HALO])
                if 0.35 < r < 0.8 and (math.atan2(y, x) - 2.8 * r) % math.pi < 0.4:
                    tone = darker(tone)
                cells[i, j] = tone
                if r >= 0.8 and y > 0.3 * R:
                    cells[i, j] = PAL["D"][:3]
                continue
            t = math.atan2(y, x)
            key = "W" if r < 0.3 else "C" if r < 0.52 else "L" if r < 0.8 else "M"
            swirl = (t - 3.2 * r) % math.pi < 0.55
            if swirl and 0.3 <= r < 0.92:
                key = {"C": "L", "L": "M", "M": "M"}[key]
            if r >= 0.75 and y > 0.25 * R:
                key = "D"
            cells[i, j] = PAL[key][:3]
    for rx, ry in RUNES:
        cx, cy = int(c + rx), int(c + ry)
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            cells[cx + dx, cy + dy] = PAL["W"][:3]
        cells[cx, cy] = PAL["D"][:3]
    return n, cells


def mage_v3():
    im = Image.open(REFS / V2).convert("RGB")
    a = np.array(im).astype(int)
    bg = a[5, 5].copy()
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    ox, oy, orad = V2_ORB
    hx0, hy0, hx1, hy1 = HAND
    in_hand = (xx >= hx0) & (xx <= hx1) & (yy >= hy0) & (yy <= hy1)
    blue = a[..., 2] > a[..., 0] + 18
    bright = a.sum(-1) > 450
    erase = ((xx - ox) ** 2 + (yy - oy) ** 2 <= orad ** 2) & (xx >= 518) & (blue | bright) & ~in_hand
    hand_keep = in_hand & ~blue
    hand = a.copy()
    a[erase] = bg
    n, cells = big_orb_cells(tuple(int(v) for v in bg), v2_body_cells(im))
    x0 = V3_CENTER[0] - n * CELL // 2
    y0 = V3_CENTER[1] - n * CELL // 2
    for (i, j), col in cells.items():
        a[y0 + j * CELL:y0 + (j + 1) * CELL, x0 + i * CELL:x0 + (i + 1) * CELL] = col
    a[hand_keep] = hand[hand_keep]
    return Image.fromarray(a.astype(np.uint8)), n


if __name__ == "__main__":
    small_orb().save(REFS / "mage_orb_small.png")
    v3, n = mage_v3()
    v3.save(REFS / "mage_a_v3.png")
    print("v2 body diameter px", V2_BODY[2] - V2_BODY[0] + 1, "v3 body diameter px", D3 * CELL, "cells", D3, "with halo", n)
