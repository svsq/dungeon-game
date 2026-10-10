# post-fixes for hero rig parts (BUGS 23–25); always rebuilds from art/old/herofix/ so it can be re-run
import numpy as np; from PIL import Image; from scipy import ndimage as nd
SRC, DST = 'art/old/herofix', 'art/gen'
load = lambda n: np.array(Image.open(f'{SRC}/{n}.png').convert('RGBA')).astype(float)
save = lambda a, n: Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{DST}/{n}.png')
lum = lambda a: a[..., :3] @ [0.3, 0.59, 0.11]

def plug(a, box, thr=55, light=(1, -1)):
    # fill the dark hollow of a pauldron with a steel dome ramp from that pauldron's own palette; the outline stays
    x0, y0, x1, y1 = box; r = a[y0:y1, x0:x1]
    solid = r[..., 3] > 128; dark = solid & (lum(r) < thr) & (r[..., 0] < r[..., 2] + 25)
    lab, n = nd.label(dark)
    if n == 0: return
    hole = lab == np.argmax(np.bincount(lab.ravel())[1:]) + 1
    steel = solid & ~hole & (lum(r) > 80) & (np.abs(r[..., 0] - r[..., 2]) < 30)
    gold = solid & (lum(r) > 110) & (r[..., 0] > r[..., 2] + 40)
    core = hole & (nd.distance_transform_edt(~(~solid | (solid & ~hole & ~steel & ~gold))) > 1.5)
    sp = r[steel][:, :3]; sp = sp[np.argsort(lum(sp))]; pal = sp[[int(q * (len(sp) - 1)) for q in (0.2, 0.45, 0.7)]]
    yy, xx = np.nonzero(core); t = (xx - xx.mean()) * light[0] + (yy - yy.mean()) * light[1]
    t = (t - t.min()) / max(1e-6, np.ptp(t)); t = 0.1 + 0.8 * t
    r[yy, xx, :3] = pal[(t * (len(pal) - 1)).round().astype(int)]
    print('plugged', box, core.sum(), 'px')

def specks(a, min_px=20):
    lab, n = nd.label(a[..., 3] > 0); sz = np.bincount(lab.ravel()); sz[0] = 1 << 30
    a[sz[lab] < min_px, 3] = 0; return a

b = load('hero__body'); plug(b, (36, 92, 64, 130)); save(specks(b), 'hero__body')
bb = load('hero__body_back'); plug(bb, (28, 88, 52, 118), light=(1, -1)); plug(bb, (132, 90, 158, 120), light=(-1, -1)); save(specks(bb), 'hero__body_back')
h = load('hero'); plug(h, (36, 92, 64, 130)); save(specks(h), 'hero')

# near forearm: mirror the fist inside its own box so the two hands aren't the same drawing
f = load('hero__farmR'); g = (f[..., 3] > 0) & (f[..., 0] > f[..., 2] + 30)
ys = np.where(g.any(1))[0]; y0 = ys[(ys > 215) & (g.sum(1)[ys] > 0.6 * g.sum(1).max())].min(); rows = slice(y0, f.shape[0])
xs = np.where(f[rows][..., 3].any(0))[0]; x0, x1 = xs.min(), xs.max() + 1
f[rows, x0:x1] = f[rows, x0:x1][:, ::-1]; save(f, 'hero__farmR')
print('fist rows', y0, 'x', x0, x1)
