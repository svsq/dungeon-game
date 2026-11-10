import numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage

SRC = Path('art/old/ui_parchment_w.png')
DST = Path('art/gen/ui_parchment_w.png')

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
opaque = a[..., 3] >= 170
lab, n = ndimage.label(opaque)
keep = lab == (np.argmax(ndimage.sum(opaque, lab, range(1, n + 1))) + 1)
a[..., 3] = np.where(keep, 255, 0)
Image.fromarray(a).save(DST)
ys, xs = np.where(keep)
print('bbox', xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, 'aspect', (xs.max() + 1 - xs.min()) / (ys.max() + 1 - ys.min()))
Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(DST)
