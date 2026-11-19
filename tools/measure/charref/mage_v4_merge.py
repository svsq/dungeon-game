import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
EDIT = ROOT / "frames/char_refs_r4/gen/charref4_mage_a.png"
OUT = REFS / "mage_a_v4.png"

V2_ORB = (601, 318)
HAND = (540, 372, 665, 470)
REACH = 150
DIFF = 90
GROW = 6


def merge():
    v2 = np.asarray(Image.open(REFS / "mage_a_v2.png").convert("RGB")).astype(int)
    ed = np.asarray(Image.open(EDIT).convert("RGB")).astype(int)
    H, W = v2.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    disc = (xx - V2_ORB[0]) ** 2 + (yy - V2_ORB[1]) ** 2 <= REACH ** 2
    changed = (np.abs(ed - v2).sum(-1) > DIFF) & disc
    old_orb = disc & (xx >= 518) & ((v2[..., 2] > v2[..., 0] + 18) | (v2.sum(-1) > 450))
    old_orb &= ~((xx >= HAND[0]) & (xx <= HAND[2]) & (yy >= HAND[1]) & (yy <= HAND[3]))
    changed |= ndimage.binary_dilation(old_orb, iterations=2) & (xx >= 518)
    region = ndimage.binary_fill_holes(ndimage.binary_closing(changed, iterations=GROW))
    region = ndimage.binary_dilation(region, iterations=2) & disc
    out = np.where(region[..., None], ed, v2)
    Image.fromarray(out.astype(np.uint8)).save(OUT)
    return int(region.sum())


if __name__ == "__main__":
    print("merged px", merge())
