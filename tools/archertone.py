#!/usr/bin/env python3
"""archertone.py — the archer's colours after `gear.py cut archer*` (TASKS 1124, critic archer_look_r1): the generator drifted the
cloth to hue ~31 (orange) where the brief asks for ochre at ~40, the legs came out near black and the cream scarf as light as the
face. Run on freshly cut parts only (the cut rewrites them from the sheets), then prep.py:
  legs (thigh, shin, foot): value ×1.55, nothing else (round 2: the cloth rule darkened the trousers first); cloth: hue set to 40°, saturation ×0.95, value ×0.7 (under the hero's own lantern light ochre went pale yellow, one with the hair); scarf (saturation under 0.45): value ×0.8."""
import colorsys, glob, re
import numpy as np
from PIL import Image
for p in sorted(glob.glob('art/gen/archer__*.png')):
    if p.endswith('_w.png'): continue
    leg = re.search(r'__(thigh|shin|foot)', p) is not None
    a = np.array(Image.open(p).convert('RGBA')).astype(float); n = 0
    for y, x in zip(*np.where(a[..., 3] > 0)):
        h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255)); H = h * 360
        if leg: v = min(1, v * 1.55) if v > 0.08 else v
        elif 18 <= H <= 48 and s > 0.5 and v > 0.25: h, s, v = 40 / 360, min(1, s * 0.95), v * 0.7; n += 1
        elif 30 <= H <= 62 and s < 0.45 and v > 0.65: v *= 0.8; n += 1
        a[y, x, :3] = np.array(colorsys.hsv_to_rgb(h, s, v)) * 255
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(p); print(p, n)
