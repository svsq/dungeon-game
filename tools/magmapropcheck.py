#!/usr/bin/env python3
"""The magma caves' props against the hero (TASKS 405, rule of 327): no prop's painted outline finer than the hero's by more than
1.5x at its display height, hard alpha, and a contact sheet at the art grid in frames/magma_props. Exit 1 on failure.
  python3 tools/magmapropcheck.py"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

out = Path('frames/magma_props'); out.mkdir(parents=True, exist_ok=True)
sizes = dict((k, int(v)) for k, v in re.findall(r'(\w+): (\d+)', Path('live/sizes.js').read_text().split('const HEIGHT')[1].split('};')[0]))
props = ['basalt_a', 'basalt_b', 'boulder_mg_a', 'boulder_mg_b', 'obsidian_mg', 'skel_mg', 'banner_mg', 'vent_mg', 'cage', 'barrel', 'crate']


def contour(name):
    im = Image.open('art/gen/' + name + '.png').convert('RGBA'); a = np.array(im)
    bb = im.getbbox(); h = sizes[name] * im.height / (bb[3] - bb[1]) if name != 'hero' else sizes[name]
    solid = a[..., 3] > 128
    dist = distance_transform_edt(solid) * h / im.height
    dark = solid & (a[..., :3] @ np.array([0.3, 0.59, 0.11]) < 50) & (dist <= 4)
    return float(np.median(dist[dark]) * 2) if dark.any() else 0.0, im, h


hero = contour('hero')[0]; fails = []
sheet = Image.new('RGB', (len(props) * 160, 260), '#504b48'); d = ImageDraw.Draw(sheet)
print('hero paint contour %.2f view px' % hero)
for i, n in enumerate(props):
    w, im, h = contour(n)
    a = np.array(im)[..., 3]; hard = set(np.unique(a)) <= {0, 255}
    ok = w >= hero / 1.5
    print('%-14s contour %.2f view px  %s%s' % (n, w, 'ok' if ok else 'TOO FINE', '' if hard else '  partial alpha'))
    if not ok: fails.append(n + ': contour')
    if not hard and n not in ('cage', 'barrel', 'crate'): fails.append(n + ': partial alpha')
    im2 = im.crop(im.getbbox()); vh = sizes[n]; vw = max(1, round(im2.width * vh / im2.height))
    art = im2.resize((max(1, vw // 2), max(1, vh // 2)), Image.Resampling.BOX).resize((max(1, vw // 2) * 2, max(1, vh // 2) * 2), Image.Resampling.NEAREST)
    sheet.paste(art, (i * 160 + (160 - art.width) // 2, 220 - art.height), art); d.text((i * 160 + 6, 232), '%s %.2f' % (n, w), fill='white')
sheet.save(out / 'sheet.png')
if fails: print('magmapropcheck: FAIL', fails); sys.exit(1)
print('magmapropcheck: ok')
