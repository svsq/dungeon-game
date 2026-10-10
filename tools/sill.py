# the sanctuary threshold drawn on the world's art grid (34×7 art px, saved ×2): a painted sill shrunk to this size loses its inlay
import numpy as np; from PIL import Image
src = np.array(Image.open('art/old/sanct/sanct_sill_full.png').convert('RGBA')).astype(float); op = src[..., 3] > 200
L = src[..., :3] @ [0.3, 0.59, 0.11]; gold_m = op & (src[..., 0] > src[..., 2] + 60) & (L > 120); stone_m = op & ~gold_m & (L > 110)
gold = np.median(src[gold_m][:, :3], 0); stone = np.median(src[stone_m][:, :3], 0); ink = np.array([28, 20, 18.])
W, H = 34, 7; rng = np.random.default_rng(7); a = np.zeros((H, W, 4))
for y in range(H):
    for x in range(W):
        c = stone * 0.78 * (1.15 if y == 1 else 0.8 if y == 5 else 1.0) * (1 + rng.uniform(-0.05, 0.05)); a[y, x] = [*c, 255]
a[0, :, :3] = a[H - 1, :, :3] = ink; a[:, 0, :3] = a[:, W - 1, :3] = ink
for x in (0, 1, W - 2, W - 1): a[0, x, 3] = a[H - 1, x, 3] = 0
a[0, 1, :3] = a[H - 1, 1, :3] = a[0, W - 2, :3] = a[H - 1, W - 2, :3] = ink; a[0, 1, 3] = a[H - 1, 1, 3] = a[0, W - 2, 3] = a[H - 1, W - 2, 3] = 255
a[2, 2:W - 2, :3] = a[4, 2:W - 2, :3] = stone * 0.45; a[3, 2:W - 2, :3] = gold
for sx in (7, 17, 26):
    for dy, dx in ((-2, 0), (-1, -1), (-1, 0), (-1, 1), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (1, -1), (1, 0), (1, 1), (2, 0)): a[3 + dy, sx + dx, :3] = gold
    a[3, sx, :3] = np.minimum(255, gold * 1.25)
Image.fromarray(a.clip(0, 255).astype(np.uint8)).resize((W * 2, H * 2), Image.NEAREST).save('art/gen/sanct_sill.png')
print('gold', gold.round(), 'stone', stone.round())
