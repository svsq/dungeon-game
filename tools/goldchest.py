# TASKS 196: chest_open_gold on its own art grid. Generated at ~10 px an art pixel on a 1024 canvas (three times chest_open's
# density), its coins came out as a smooth orange heap with no shadows: in the frame it read as an orange blot with no wood or
# iron. Shrunk onto its grid, every coin is redrawn in three flat golds with its lower rows a tone down, the gaps between coins
# a 1-art-px slit, the iron darkened to at most L 0.35 so the bands read against the gold, then saved ×3.
# The golds are the concept's own (its coin heaps split into three L bands): the style bible's #934218 / #c25d1a / #eed68a
# came out copper. Rebuilds from art/old/goldchest/ (the generated original) so it can be re-run.
import os, shutil, numpy as np; from PIL import Image
SRC, DST, CELL, UP = 'art/old/goldchest/chest_open_gold.png', 'art/gen/chest_open_gold.png', 10, 3
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
def oklab(c): c = c / 255; return np.cbrt(np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92) @ M1.T) @ M2.T
def srgb(lab): c = np.clip((lab @ np.linalg.inv(M2).T) ** 3 @ np.linalg.inv(M1).T, 0, 1); return 255 * np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
GOLD = [hexc('#9f5116'), hexc('#e2881e'), hexc('#f9ce4a')]
SLIT = hexc('#36120f')

if not os.path.exists(SRC): os.makedirs(os.path.dirname(SRC), exist_ok=True); shutil.copy(DST, SRC)
im = Image.open(SRC).convert('RGBA'); im = im.crop(im.getbbox())
a = np.array(im.resize((round(im.width / CELL), round(im.height / CELL)), Image.BOX)).astype(float)
al = a[..., 3] > 128; lab = oklab(a[..., :3]); L = lab[..., 0]; C = np.hypot(lab[..., 1], lab[..., 2]); h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
gold = al & (C > 0.08) & (h > 45) & (h < 105) & (L > 0.42)
iron = al & ~gold & (C < 0.045) & (L > 0.1)
out = a.copy()
# a gold pixel darker than the coins above and below it is the gap between two coins
up, dn = np.roll(L, 1, 0), np.roll(L, -1, 0)
slit = gold & (L < up - 0.06) & (L < dn - 0.06)
tone = np.where(L < 0.62, 0, np.where(L < 0.8, 1, 2))
below = np.roll(gold & ~slit, -1, 0) & np.roll(gold & ~slit, -2, 0)
tone = np.where(gold & ~below, np.maximum(tone - 1, 0), tone)
for k in range(3): out[gold & (tone == k), :3] = GOLD[k]
out[slit, :3] = SLIT
# iron: its own three steps, the lightest at L 0.35
li = L[iron]; q = np.searchsorted(np.percentile(li, [40, 80]), li)
out[iron, :3] = srgb(np.stack([np.array([0.2, 0.27, 0.35])[q], np.full(q.shape, 0.006), np.full(q.shape, -0.012)], -1))
out[..., 3] = np.where(al, 255, 0)
Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((out.shape[1] * UP, out.shape[0] * UP), Image.NEAREST).save(DST)
print('chest_open_gold', out.shape[1], 'x', out.shape[0], 'art px; gold', int(gold.sum()), 'slits', int(slit.sum()), 'iron', int(iron.sum()))
