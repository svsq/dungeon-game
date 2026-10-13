# fit art/gen/hero_body_back.png onto the hero rig canvas so it swaps 1:1 with hero__body: the same height (head top to hem),
# the pauldrons' midpoint on the rig's shoulder midpoint
import json, re; from PIL import Image; import numpy as np
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))['hero']
op = lambda im: np.array(im)[:, :, 3] > 110
fy, fx = np.where(op(Image.open('art/gen/hero__body.png')))
im = Image.open('art/gen/hero_body_back.png').convert('RGBA'); a = op(im); ys, xs = np.where(a)
S = (fy.max() - fy.min()) / (ys.max() - ys.min())
band = range(ys.min() + int(0.15 * (ys.max() - ys.min())), ys.min() + int(0.35 * (ys.max() - ys.min())))
w = max(band, key=lambda y: np.ptp(np.where(a[y])[0])); row = np.where(a[w])[0]; mid = (row.min() + row.max()) / 2
small = im.resize((round(im.width * S), round(im.height * S)), Image.LANCZOS)
out = Image.new('RGBA', (R['w'], R['h'])); ox = round((R['shL'][0] + R['shR'][0]) / 2 - mid * S); oy = round(fy.min() - ys.min() * S)
out.alpha_composite(small, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
arr = np.array(out); arr[:, :, 3] = np.where(arr[:, :, 3] > 110, 255, 0); Image.fromarray(arr).save('art/gen/hero__body_back.png')
print('scale', round(S, 4), 'offset', ox, oy)
