#!/usr/bin/env python3
"""Cuts the loose shards of art/gen/dc_shards.png into art/gen/shard_N.png, one connected piece each."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd

GEN = Path(__file__).resolve().parent.parent / "art" / "gen"
KEEP = ((147, 13), (198, 62), (134, 109), (51, 145), (228, 149), (155, 185), (95, 195), (154, 232))

src = np.array(Image.open(GEN / "dc_shards.png").convert("RGBA"))
lab, _ = nd.label(src[..., 3] > 40, structure=np.ones((3, 3)))
boxes = nd.find_objects(lab)
for i, (x, y) in enumerate(KEEP):
    k = next(j for j, b in enumerate(boxes) if b[1].start == x and b[0].start == y)
    box = boxes[k]
    out = src[box].copy()
    out[lab[box] != k + 1, 3] = 0
    Image.fromarray(out).save(GEN / f"shard_{i}.png")
