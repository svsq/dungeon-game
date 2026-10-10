# the spider rig from its part sheet: the body (socket holes filled with shell), one leg split at the knee into two segments;
# the scene lays out eight legs and walks them, so only the drawings and their joint points are stored
import json, re; import numpy as np; from PIL import Image; from scipy import ndimage as nd
S = np.array(Image.open('art/gen/spider_parts_sheet.png').convert('RGBA')); M = S[..., 3] > 60; lab, n = nd.label(M)
def blob(x, y): k = lab[y, x]; ys, xs = np.where(lab == k); c = S[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); c[lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1] != k, 3] = 0; return c, (xs.min(), ys.min())
body, bo = blob(445, 400); leg, lo = blob(1000, 585)
# plug the drawn leg sockets: their dark cores take the nearest shell colour, darkened
L = body[..., :3].astype(float) @ [0.3, 0.59, 0.11]; sock = [(255, 570), (255, 665), (265, 740), (300, 812), (610, 570), (610, 665), (600, 740), (575, 812)]
yy, xx = np.mgrid[:body.shape[0], :body.shape[1]]; hole = np.zeros(L.shape, bool)
for (x, y) in sock: hole |= ((xx - (x - bo[0])) ** 2 + (yy - (y - bo[1])) ** 2 < 40 ** 2) & (L < 70) & (body[..., 3] > 0)
src = (body[..., 3] > 0) & ~hole & (L >= 70); _, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
f = body[iy, ix].astype(float); f[..., :3] = nd.uniform_filter(f[..., :3], size=(7, 7, 1)) * 0.7; body[hole, :3] = f[hole, :3].astype(np.uint8)
Image.fromarray(body).save('art/gen/spider__body.png')
cut = 1160 - lo[0]; A = leg.copy(); A[:, cut:, 3] = 0; B = leg.copy(); B[:, :cut, 3] = 0
ya, xa = np.where(A[..., 3] > 0); yb, xb = np.where(B[..., 3] > 0)
A = A[:, :xa.max() + 1]; B = B[:, xb.min():]; Image.fromarray(A).save('art/gen/spider__legA.png'); Image.fromarray(B).save('art/gen/spider__legB.png')
P = lambda x, y, ox=0: [int(x - lo[0] - ox), int(y - lo[1])]
rg = {'w': int(body.shape[1]), 'h': int(body.shape[0]), 'sockets': [[int(x - bo[0]), int(y - bo[1])] for x, y in sock],
      'legA': {'w': int(A.shape[1]), 'h': int(A.shape[0]), 'root': P(895, 585), 'end': P(1175, 560)},
      'legB': {'w': int(B.shape[1]), 'h': int(B.shape[0]), 'root': P(1175, 560, xb.min()), 'end': P(1385, 835, xb.min())}}
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); R['spider'] = rg
txt = 'window.RIGS = ' + json.dumps(R) + ';\n'; open('live/rigs.js', 'w').write(txt); print(json.dumps(rg)[:400], int(hole.sum()), 'socket px plugged')
