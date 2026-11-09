import os, shutil
import numpy as np
from PIL import Image

SRC = 'art/gen/cage_big.png'
OLD = 'art/old/cage_big.png'
CX, MAXW = 551, 60

if not os.path.exists(OLD):
    shutil.copy(SRC, OLD)
im = np.array(Image.open(OLD).convert('RGBA'))
op = im[:, :, 3] > 0

def run(y):
    if not op[y, CX]:
        return None
    l = r = CX
    while l > 0 and op[y, l - 1]: l -= 1
    while r < op.shape[1] - 1 and op[y, r + 1]: r += 1
    return l, r

runs = [run(y) for y in range(600, 701)]
x0 = min(r[0] for r in runs)
x1 = max(r[1] for r in runs)

def is_bar(y):
    r = run(y)
    return r is not None and r[1] - r[0] + 1 <= MAXW and r[0] >= x0 - 2 and r[1] <= x1 + 2

y0 = 650
while is_bar(y0 - 1): y0 -= 1
y1 = 650
while is_bar(y1 + 1): y1 += 1

before = im[:, :, 3].copy()
im[y0:y1 + 1, x0:x1 + 1, 3] = 0
changed = int((before != im[:, :, 3]).sum())
foreign = int(op[y0:y1 + 1, x0 - 6:x0].sum() + op[y0:y1 + 1, x1 + 1:x1 + 7].sum())
Image.fromarray(im).save(SRC)
print(f'cols {x0}-{x1} rows {y0}-{y1} changed {changed} neighbour-opaque {foreign}')
