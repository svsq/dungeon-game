# post-fixes for TASKS 32; rebuilds from art/old/cleanfix/ so it can be re-run
import numpy as np; from PIL import Image; from scipy import ndimage as nd
SRC, DST = 'art/old/cleanfix', 'art/gen'
load = lambda n: np.array(Image.open(f'{SRC}/{n}.png').convert('RGBA')).astype(float)
save = lambda a, n: Image.fromarray(a.clip(0, 255).round().astype(np.uint8)).save(f'{DST}/{n}.png')

for n in ['en_brute', 'en_cultist', 'en_ghost', 'en_goblin', 'en_skeleton', 'en_spider']:
    a = load(n); lab, k = nd.label(a[..., 3] > 8, structure=np.ones((3, 3))); sz = np.bincount(lab.ravel()); sz[0] = 1 << 30
    drop = (sz[lab] < 20) | ((a[..., 3] <= 8) & ~nd.binary_dilation(lab > 0, iterations=1))
    print(n, 'specks', int((sz[1:] < 20).sum()), 'px', int(drop.sum())); a[drop, 3] = 0; save(a, n)

# the wax tops were near-white; the brightest step tops out at warm cream so the flame stays the hottest thing
a = load('candles'); L = a[..., :3] @ [0.3, 0.59, 0.11]; top = np.array([0xee, 0xd6, 0x8a], float)
hot = (a[..., 3] > 0) & (L > 205); k = np.clip((L - 205) / 40, 0, 1)[..., None]
a[..., :3] = np.where(hot[..., None], a[..., :3] * (1 - k) + top * k, a[..., :3]); print('candles clamped', int(hot.sum())); save(a, 'candles')
