import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
SRC = REFS / "mage_a_small.png"
NOORB = REFS / "mage_a_small_noorb_r4.png"
ORB = REFS / "mage_orb_small_r4.png"
ON = REFS / "mage_a_small_orb_r4.png"

ORB_BOX = (36, 22, 47, 32)
OUTLINE = (0x21, 0x09, 0x09)

PAL = {
    "W": (0xE8, 0xFB, 0xFF, 255),
    "C": (0xC1, 0xF5, 0xFD, 255),
    "L": (0x77, 0xE4, 0xFA, 255),
    "M": (0x2E, 0x5A, 0xA2, 255),
    "D": (0x1D, 0x2B, 0x59, 255),
    "h": (0x64, 0xBD, 0xEA, 150),
    "k": (0x3A, 0x7F, 0xD0, 70),
}

ORB_MAP = [
    "...kkkkk...",
    "..khhhhhk..",
    ".khMLLLMhk.",
    "khMLCCLMMhk",
    "khLCWWCMLhk",
    "khLCWCMLMhk",
    "khMLMMLLMhk",
    "khMMLLLMDhk",
    ".khDMMMDDk.",
    "..khhhhhk..",
    "...kkkkk...",
]

ORB_AT = (36, 22)


def is_outline(c):
    return c.sum() < 110 and c[0] >= c[2]


def no_orb(a, bg):
    x0, y0, x1, y1 = ORB_BOX
    out = a.copy()
    erase = np.zeros(a.shape[:2], bool)
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = a[y, x]
            if b > r + 10 and not (x == 36 and y >= 32):
                erase[y, x] = True
    out[erase] = bg
    for y, x in zip(*np.where(erase)):
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            c = out[y + dy, x + dx]
            if not erase[y + dy, x + dx] and (np.abs(c - bg).sum() > 30) and not is_outline(c):
                out[y, x] = OUTLINE
                break
    return out, erase


def orb_layer():
    a = np.zeros((len(ORB_MAP), len(ORB_MAP[0]), 4), np.uint8)
    for j, row in enumerate(ORB_MAP):
        for i, ch in enumerate(row):
            if ch != ".":
                a[j, i] = PAL[ch]
    return Image.fromarray(a)


def main():
    a = np.asarray(Image.open(SRC).convert("RGB")).astype(int)
    bg = a[0, 0].copy()
    out, erase = no_orb(a, bg)
    rgba = np.dstack([out, np.where(np.abs(out - bg).sum(-1) <= 6, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba).save(NOORB)
    orb = orb_layer()
    orb.save(ORB)
    on = Image.fromarray(out.astype(np.uint8)).convert("RGBA")
    on.alpha_composite(orb, ORB_AT)
    on.convert("RGB").save(ON)
    print("erased", int(erase.sum()), "orb", orb.size, "at", ORB_AT, "centre", (ORB_AT[0] + orb.width // 2, ORB_AT[1] + orb.height // 2))


if __name__ == "__main__":
    main()
