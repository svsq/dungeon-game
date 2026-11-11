#!/usr/bin/env python3
"""Kit B parts onto the kit's art pixel (TASKS 1743, 1755): art/raw/<name>.png (the keyed generation) → art/gen/<name>.png.
The piece is cut to its alpha box, put on a grid of its drawn width in art px (PART.art in hud_kit.js), each cell the most
common of 16 colours, alpha hard, then every cell blown up to up to 8 src px (fewer when that would pass prep's 2048 px cap). Textures load with linear filtering and mipmaps,
so an art-px texture drawn at KIT.PX = 2 would blur; several src px to an art px minify to crisp 2 px squares (as the wear tiles).
  python3 tools/ui_b_snap.py [name ...]
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.expanduser('~/.claude/skills/ref2game/scripts'))
from gen import pixel_snap  # noqa: E402

ART = {
    'ui_b_tab': 120, 'ui_b_clasp': 48, 'ui_b_flourish': 64, 'ui_b_wax_seal': 40, 'ui_b_parchment_tile': 128,
    'ui_b_menu_leaf': 310, 'ui_b_strap': 24, 'ui_b_strap_ring': 32,
}
OPAQUE = {'ui_b_parchment_tile'}
# the tab's generated corner glints are lighter than any parchment of the kit, and the open tab is tinted red, where they turned
# into orange blots: they take the paper's own light tone
GLINT = {'ui_b_tab': (240, 200, 120)}
# the menu leaf came out a step darker than the sheet of ref_ui_menu_b (median 180,141,110 against 193,156,120)
GAIN = {'ui_b_menu_leaf': (1.07, 1.1, 1.09)}


def snap(name, aw):
    im = Image.open(f'art/raw/{name}.png').convert('RGBA')
    if name not in OPAQUE:
        im = im.crop(Image.fromarray((np.array(im)[..., 3] > 128).astype(np.uint8) * 255).getbbox())
    if name in GAIN:
        a = np.array(im).astype(np.float32); a[..., :3] = np.clip(a[..., :3] * np.array(GAIN[name]), 0, 255); im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    ah = max(1, round(aw * im.height / im.width))
    k = 8
    s, _ = pixel_snap(im.resize((aw * k, ah * k), Image.LANCZOS), grid=k, colors=16)
    a = np.array(s)
    if name in OPAQUE: a[..., 3] = 255
    if name in GLINT:
        r, g, b = GLINT[name]
        hot = (a[..., 0] >= r) & (a[..., 1] >= g) & (a[..., 2] <= b + 60) & (a[..., 3] > 0)
        paper = a[(a[..., 3] > 0) & ~hot][:, :3]
        light = np.percentile(paper[paper.sum(-1) > np.median(paper.sum(-1))], 50, axis=0).astype(np.uint8)
        a[hot, :3] = light
    cell = max(1, min(8, 2048 // max(aw, ah)))
    out = Image.fromarray(a, 'RGBA').resize((aw * cell, ah * cell), Image.NEAREST)
    if name in OPAQUE: out = out.convert('RGB')
    out.save(f'art/gen/{name}.png')
    print(name, f'{aw}x{ah} art px, {cell} src px each → {out.width}x{out.height}')


for n in sys.argv[1:] or ART:
    snap(n, ART[n])
