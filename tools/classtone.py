#!/usr/bin/env python3
"""classtone.py DIR: the archer's jacket under the crypt's light, on `qashot --states zone_crypt_archer,zone_crypt_mage,zone_crypt --out DIR`
(TASKS 1159): the torch's green pushed his ochre to flat orange. Prints each class's cloth and fails the archer outside its band."""
import colorsys, sys
import numpy as np
from PIL import Image
BAND = {'v': (0.5, 0.72), 'clip': 0.05, 'h': (27, 48)}
d = sys.argv[1]; bad = 0
for name in ('zone_crypt_archer', 'town_archer', 'zone_crypt_mage', 'zone_crypt'):
    a = np.array(Image.open(f'{d}/{name}.png').convert('RGB')).astype(float); W, H = a.shape[1], a.shape[0]
    c = a[H // 2 - 70:H // 2 + 10, W // 2 - 26:W // 2 + 26].reshape(-1, 3) / 255
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in c]); hue = hsv[:, 0] * 360
    want = ((hue > 15) & (hue < 70)) if name.endswith('archer') else ((hue > 195) & (hue < 250)) if name.endswith('mage') else ((hue < 12) | (hue > 345))
    m = want & (hsv[:, 1] > 0.3) & (hsv[:, 2] > 0.3)
    if not m.any(): print(name, 'no cloth found'); bad += name.endswith('archer'); continue
    h, s, v, clip = np.median(hue[m]), np.median(hsv[m, 1]), np.median(hsv[m, 2]), (c[m, 0] > 0.97).mean()
    print(f'{name}: {m.sum()} px, hue {h:.0f}, sat {s:.2f}, value {v:.2f}, red clipped {clip * 100:.0f} %')
    if name.endswith('archer') and not (BAND['h'][0] <= h <= BAND['h'][1] and BAND['v'][0] <= v <= BAND['v'][1] and clip <= BAND['clip']): print('  FAIL outside', BAND); bad += 1
sys.exit(1 if bad else 0)
