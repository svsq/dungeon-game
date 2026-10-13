# post-fixes for hero rig parts (BUGS 24, 30); always rebuilds from art/old/herofix/ so it can be re-run
import numpy as np; from PIL import Image; from scipy import ndimage as nd
SRC, DST = 'art/old/herofix', 'art/gen'
load = lambda n: np.array(Image.open(f'{SRC}/{n}.png').convert('RGBA')).astype(float)
save = lambda a, n: Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{DST}/{n}.png')

def specks(a, min_px=20):
    lab, n = nd.label(a[..., 3] > 0); sz = np.bincount(lab.ravel()); sz[0] = 1 << 30
    a[sz[lab] < min_px, 3] = 0; return a

for n in ('hero__body', 'hero__body_back', 'hero'): save(specks(load(n)), n)

# near forearm: mirror the fist inside its own box so the two hands aren't the same drawing
f = load('hero__farmR'); g = (f[..., 3] > 0) & (f[..., 0] > f[..., 2] + 30)
ys = np.where(g.any(1))[0]; y0 = ys[(ys > 215) & (g.sum(1)[ys] > 0.6 * g.sum(1).max())].min(); rows = slice(y0, f.shape[0])
xs = np.where(f[rows][..., 3].any(0))[0]; x0, x1 = xs.min(), xs.max() + 1
f[rows, x0:x1] = f[rows, x0:x1][:, ::-1]; save(f, 'hero__farmR')
print('fist rows', y0, 'x', x0, x1)
