#!/usr/bin/env python3
"""magecloak.py — the mage's traveller's cloak (TASKS 1114 critic r2): the generated hood came out orange (hue ~20), near the warrior's
red cape at play distance; its warm pixels are taken down to leather brown. Run after `gear.py cut mage_hood`, then prep.py."""
import colorsys, glob
import numpy as np
from PIL import Image
for p in sorted(glob.glob('art/gen/mage__*_hd*.png')):
    a = np.array(Image.open(p).convert('RGBA')).astype(float); n = 0
    for y, x in zip(*np.where(a[..., 3] > 0)):
        h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255))
        if 0.0 <= h * 360 <= 40 and s > 0.45 and v > 0.25:
            r, g, b = colorsys.hsv_to_rgb(h, s * 0.62, v * 0.78); a[y, x, :3] = np.array([r, g, b]) * 255; n += 1
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(p); print(p, n)
