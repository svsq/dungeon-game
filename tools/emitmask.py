# the glowing bits of a rig's parts as their own textures (TASKS 407–409): a magma golem's cracks, an imp's eyes, a salamander's
# ember spots. Painted unlit by the style bible, they are lifted to a hot ramp here and drawn over the part in the emissive pass with
# the part's own pose. usage: python3 tools/emitmask.py RIG OUT (art/gen/RIG__*.png → art/gen/OUT__*.png)
#   golem, colossus: the molten core between the plates (red well over green and blue); imp: the eyes (saturated red, bright);
#   salamander: the orange spots
import glob, os, sys; import numpy as np; from PIL import Image
from scipy import ndimage
rig, out = sys.argv[1], sys.argv[2]
for p in sorted(glob.glob(f'art/gen/{rig}__*.png')):
    part = os.path.basename(p)[len(rig) + 2:-4]
    if part.endswith('_w'): continue
    a = np.array(Image.open(p).convert('RGBA')).astype(float); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    if rig in ('golem', 'colossus'): m = (r - np.maximum(g, b) > 28) & (al > 128); heat = np.clip((r - 60) / 150, 0, 1) * 0.6 + np.clip((g - 30) / 90, 0, 1) * 0.4
    elif rig == 'imp': m = (r > 228) & (g < 64) & (b < 24) & (al > 128); heat = np.ones_like(r)
    else: m = (r > 170) & (g > 70) & (g < 140) & (b < 60) & (al > 128); heat = np.ones_like(r) * 0.8
    if rig == 'colossus':
        m &= (r - b) / np.maximum(r, 1) > 0.42
        labels, n = ndimage.label(m, np.ones((3, 3)))
        sizes = np.bincount(labels.ravel())
        keep = sizes >= 3; keep[0] = False
        m = keep[labels]
    o = np.zeros_like(a); hot = np.stack([np.full_like(r, 1.0), 0.28 + 0.5 * heat, 0.06 + 0.2 * heat ** 2], -1)
    o[..., :3] = np.clip(hot * 255 * (0.55 + 0.45 * heat)[..., None], 0, 255); o[..., 3] = np.where(m, 255, 0); o[~m] = 0
    Image.fromarray(o.astype(np.uint8)).save(f'art/gen/{out}__{part}.png'); print(part, int(m.sum()))
