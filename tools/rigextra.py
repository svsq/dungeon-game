# extra held parts partrig doesn't know (a shield): cut the Nth blob (left to right) of a part sheet into <name>_<part>.png
# and store its width in rig px (scaled like the weapon) as RIGS[name][<part>W]
import sys, json, re; import numpy as np; from PIL import Image; from scipy import ndimage as nd
name, sheet, nparts, idx, part = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
a = np.array(Image.open(sheet).convert('RGBA')); m = a[..., 3] > 60; lab, n = nd.label(m); sz = nd.sum(m, lab, range(1, n + 1))
bl = sorted([nd.find_objects((lab == k).astype(int))[0] for k in np.argsort(-sz)[:nparts] + 1], key=lambda b: b[1].start)
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); rg = R[name]
wy = [b for b in bl if b is not bl[idx]]; wpn = Image.open(f'art/gen/{name}_weapon.png'); sc = rg['weaponLen'] / wpn.height
ys, xs = bl[idx]; crop = a[ys, xs].copy(); crop[..., 3] = np.where(lab[ys, xs] == lab[ys.start + (ys.stop - ys.start) // 2, xs.start + (xs.stop - xs.start) // 2], crop[..., 3], 0)
Image.fromarray(crop).save(f'art/gen/{name}_{part}.png'); rg[part + 'W'] = round(crop.shape[1] * sc, 1)
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open('live/rigs.js', 'w').write(txt); print(name, part, crop.shape[:2], rg[part + 'W'])
