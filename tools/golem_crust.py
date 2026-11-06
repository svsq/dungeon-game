# the magma golem's crust as four plates over its molten core (TASKS 458): the plates come off one by one under the first blows
# and grow back, so the silhouette tells how much crust is left. usage, after tools/rig_golem.sh:
#   python3 tools/golem_crust.py && python3 tools/emitmask.py golem golemE
# art/gen/en_golem_core.png is en_golem.png edited with the chest and belly plates knocked off (art/prompts/en_golem_core.txt). Only
# its core is taken: the edit redrew the rest of the body a few pixels off, so the core is pasted into the approved drawing. Out, on
# the rig's canvas: golem__core (the body with the core bare), golem__plate1..4 (the body's own pixels over each part of the core),
# golem__corelit1..4 (the core under each plate, for its glow); rigs.js golem.plates: each plate's middle. Plate 4 goes first, plate 1
# last
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

root = Path('art/gen')
rigs_path = Path('live/rigs.js')
rigs = json.loads(rigs_path.read_text()[14:].rstrip(';\n'))
rig = rigs['golem']
W, H = rig['w'], rig['h']


def bbox(im, cut=60):
    ys, xs = np.where(np.array(im)[..., 3] > cut)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


src = Image.open(root / 'en_golem.png').convert('RGBA')
edit = Image.open(root / 'en_golem_core.png').convert('RGBA')
b0, b1 = bbox(src), bbox(edit)
aligned = Image.new('RGBA', src.size)
aligned.paste(edit.crop(b1).resize((b0[2] - b0[0], b0[3] - b0[1]), Image.Resampling.LANCZOS), b0[:2])

# the rig's canvas is the drawing's box scaled to it (rigcut): the margin that puts the drawing back on the cut body is the one taken
body = np.array(Image.open(root / 'golem__body.png').convert('RGBA'))
parts = [np.array(Image.open(p).convert('RGBA'))[..., 3] > 128 for p in root.glob('golem__*.png') if p.stem.split('__')[1] in rig['parts']]
union = np.any(parts, axis=0)
best = None
for m in range(0, 6):
    box = (max(0, b0[0] - m), max(0, b0[1] - m), min(src.width, b0[2] + m), min(src.height, b0[3] + m))
    a = np.array(src.crop(box).resize((W, H), Image.Resampling.LANCZOS))[..., 3] > 128
    miss = int((a ^ union).sum())
    if best is None or miss < best[0]: best = (miss, box)
box = best[1]
core = np.array(aligned.crop(box).resize((W, H), Image.Resampling.LANCZOS)).astype(int)

# the core: the edit's one big molten mass (red well over green and blue) inside the body, holes filled, grown a pixel under the
# plates' outline so no seam of the old plate shows round it
r, g, b = core[..., 0], core[..., 1], core[..., 2]
red = (r - np.maximum(g, b) > 30) & (core[..., 3] > 128) & (body[..., 3] > 128)
lab, n = ndimage.label(red, np.ones((3, 3)))
mask = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
mask = ndimage.binary_closing(mask, np.ones((5, 5)), iterations=2)
mask = ndimage.binary_fill_holes(mask)
mask = ndimage.binary_dilation(mask, iterations=1) & (body[..., 3] > 128)
print('core', int(mask.sum()), 'px of the body', int((body[..., 3] > 128).sum()))

# four plates along the drawing's own cracks: its rock blobs in the core's box, each given the quadrant of the core its middle is
# in; every other pixel of the core (the cracks) goes with the nearest blob
lum = 0.3 * body[..., 0] + 0.55 * body[..., 1] + 0.15 * body[..., 2]
rock = mask & (lum > 34) & ~(body[..., 0].astype(int) - np.maximum(body[..., 1], body[..., 2]) > 28)
rl, rn = ndimage.label(rock)
cy, cx = ndimage.center_of_mass(mask)
quad = np.full(mask.shape, -1)
for i, (y, x) in enumerate(ndimage.center_of_mass(rock, rl, range(1, rn + 1)), 1):
    quad[rl == i] = (0 if y > cy else 2) + (0 if (x < cx) == (y > cy) else 1)
_, (iy, ix) = ndimage.distance_transform_edt(quad < 0, return_indices=True)
quad = np.where(mask, quad[iy, ix], -1)

bare = body.copy(); bare[mask] = core[mask]; bare[mask, 3] = 255
centres = []
Image.fromarray(bare.astype(np.uint8)).save(root / 'golem__core.png')
for q in range(4):
    sel = quad == q
    plate = np.zeros_like(body); plate[sel] = body[sel]
    lit = np.zeros_like(core); lit[sel] = core[sel]; lit[sel, 3] = 255
    Image.fromarray(plate.astype(np.uint8)).save(root / f'golem__plate{q + 1}.png')
    Image.fromarray(lit.astype(np.uint8)).save(root / f'golem__corelit{q + 1}.png')
    print('plate', q + 1, int(sel.sum()))
    y, x = ndimage.center_of_mass(sel); centres.append([round(float(x), 1), round(float(y), 1)])
rig['plates'] = centres
rigs_path.write_text('window.RIGS = ' + json.dumps(rigs) + ';\n')
