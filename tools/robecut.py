# cut a robed (legless) approved sprite into body + arm parts by polygons, on one shared canvas scaled to 320 px, with pivots in
# live/rigs.js — for monsters whose legs hide under a robe (rigcut needs two separate feet)
#   python3 tools/robecut.py NAME SRC "SIDE:upper|x,y;...|fore|x,y;...|sh|x,y|elbow|x,y|hand|x,y" ... ["H:head|x,y;...|neck|x,y"]
import sys, json, re, os; import numpy as np; from PIL import Image, ImageDraw; from scipy import ndimage as nd
name, src, specs, H = sys.argv[1], sys.argv[2], sys.argv[3:], 320
im = Image.open(src).convert('RGBA'); a = np.array(im)[..., 3]; ys, xs = np.where(a > 60)
im = im.crop((max(0, xs.min() - 3), max(0, ys.min() - 3), min(im.width, xs.max() + 4), min(im.height, ys.max() + 4)))
im = im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS); P = np.array(im); W = P.shape[1]
poly = lambda s: [tuple(map(float, p.split(','))) for p in s.split(';')]
def mask(pts): m = Image.new('L', (W, H)); ImageDraw.Draw(m).polygon(pts, fill=255); return np.array(m) > 0
body = P[..., 3] > 0; headcut = np.zeros(P.shape[:2], bool); meta = {'w': W, 'h': H, 'face': 'right', 'parts': ['body']}; cut = np.zeros_like(body)
for sp in specs:
    side, rest = sp.split(':', 1); f = rest.split('|'); kv = dict(zip(f[0::2], f[1::2]))
    for part in ('upper', 'fore', 'head'):
        if part not in kv: continue
        m = mask(poly(kv[part])) & body & ~cut; cut |= m; headcut |= m if part == 'head' else False; Q = P.copy(); Q[~m, 3] = 0; nm = {'upper': 'uarm' + side, 'fore': 'farm' + side, 'head': 'head'}[part]
        Image.fromarray(Q).save(f'art/gen/{name}__{nm}.png'); meta['parts'].append(nm)
    for k in ('sh', 'elbow', 'hand', 'neck'):
        if k in kv: meta[k + ('' if side == 'H' else side)] = list(map(float, kv[k].split(',')))
B = P.copy(); B[cut, 3] = 0
# back-fill the hole an arm leaves in the robe from the nearest robe pixels, darker (the occluded side)
hole = cut & nd.binary_fill_holes(B[..., 3] > 0 | cut) & ~(nd.binary_erosion(P[..., 3] > 0, iterations=2) == 0)
_, (iy, ix) = nd.distance_transform_edt(~(B[..., 3] > 0), return_indices=True); fill = B[iy, ix].astype(float); fill[..., :3] *= 0.75; fill[..., 3] = 255
inside = cut & nd.binary_erosion(nd.binary_fill_holes(B[..., 3] > 0), iterations=1)
# under the head: the neck and the chest behind the beard, so a nod never opens a hole (above the shoulders stays empty)
if 'neck' in meta: nx, ny = meta['neck']; inside |= headcut & (np.arange(H)[:, None] > ny - 30) & (np.abs(np.arange(W)[None, :] - nx) < 44)
B[inside] = fill[inside].astype(np.uint8)
Image.fromarray(B).save(f'art/gen/{name}__body.png')
ys, xs = np.where(P[..., 3] > 60); meta['top'] = [float(xs[ys == ys.min()].mean()), float(ys.min())]; meta['foot'] = float(ys.max()); meta['gap'] = float(xs.mean())
rp = 'live/rigs.js'; R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(rp).read().strip())); R[name] = meta
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open(rp, 'w').write(txt); print(name, {k: v for k, v in meta.items() if k != 'parts'}, meta['parts'])
