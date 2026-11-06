# the waystone's runes as their own texture (TASKS 1009): the dark-cut grooves of its front face, lifted to a cold glow and drawn
# over the stone in the emissive pass once it is awake. usage: python3 tools/waystone_runes.py (art/gen/waystone.png → waystone_runes.png)
import numpy as np; from PIL import Image
from scipy import ndimage
a = np.array(Image.open('art/gen/waystone.png').convert('RGBA')).astype(float)
lum = a[..., :3].mean(-1); m = (lum < 62) & (a[..., 3] > 200)
box = np.zeros_like(m); box[300:1200, 360:570] = True; m &= box
labels, n = ndimage.label(m, np.ones((3, 3))); sizes = np.bincount(labels.ravel()); keep = sizes >= 400; keep[0] = False; m = keep[labels]
soft = ndimage.gaussian_filter(m.astype(float), 1.2); soft = np.clip(soft * 1.6, 0, 1)
o = np.zeros_like(a); o[..., 0] = 150; o[..., 1] = 205; o[..., 2] = 255; o[..., 3] = soft * 255
Image.fromarray(o.astype(np.uint8)).save('art/gen/waystone_runes.png'); print('runes', int(m.sum()), 'px in', int(keep.sum()), 'marks')
