# post-fixes for hero rig parts (TASKS 24, 30); always rebuilds from art/old/herofix/ so it can be re-run
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

# the near (R) limbs were cut from the same drawing as the far ones: rebuild each from its L twin (the untouched source) moved onto
# the R part's own box, then light it as the limb nearer the camera, its outer half warm and lit, the half toward the body in shade (TASKS 24)
def across(m):   # 0 at a row's left (body) edge, 1 at its right (outer) edge: one world pixel is ~8 source px, so light has to span the limb
    t = np.zeros(m.shape)
    for y in np.where(m.any(1))[0]:
        xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); t[y, x0:x1 + 1] = (np.arange(x0, x1 + 1) - x0) / max(1, x1 - x0)
    return t
ss = lambda a, b, x: (lambda q: q * q * (3 - 2 * q))(np.clip((x - a) / (b - a), 0, 1))
def bbox(a):
    ys, xs = np.where(a[..., 3] > 0); return ys.min(), xs.min(), ys.max() + 1, xs.max() + 1
for n in ('uarm', 'farm', 'thigh', 'shin', 'foot'):
    cur = np.array(Image.open(f'{DST}/hero__{n}R.png').convert('RGBA')).astype(float)
    if n == 'farm': src = cur   # the mirrored fist, rebuilt above
    else:
        L = np.array(Image.open(f'{DST}/hero__{n}L.png').convert('RGBA')).astype(float)
        y0, x0, y1, x1 = bbox(L); Y0, X0, _, _ = bbox(cur); src = np.zeros_like(L); src[Y0:Y0 + y1 - y0, X0:X0 + x1 - x0] = L[y0:y1, x0:x1]
    m = src[..., 3] > 0; t = across(m); lit, shade = ss(0.5, 1, t), ss(0.45, 0, t)
    for c, k in zip(range(3), (1.2, 1.12, 1.0)): src[..., c] *= 1 + (k - 1) * lit
    src[..., :3] *= (1 - 0.18 * shade)[..., None]
    save(src, f'hero__{n}R')
print('near limbs relit')
