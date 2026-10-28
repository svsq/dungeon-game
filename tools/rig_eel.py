# the eel rig (TASKS 310) from its part sheet (art/gen/eel_parts_sheet.png): the neck and head without the lower jaw, bent in the
# shader on three soft bones (art/softbones.json eel__body: base, mid-neck, head), and the lower jaw as a part hung at the mouth's
# hinge. Points are sheet px, stored in each part's own crop
import json, re; import numpy as np; from PIL import Image; from scipy import ndimage as nd
S = np.array(Image.open('art/gen/eel_parts_sheet.png').convert('RGBA')); lab, n = nd.label(S[..., 3] > 120)
def blob(x, y, pad=24):
    m = lab == lab[y, x]; ys, xs = np.where(m); x0, y0 = int(xs.min()) - pad, int(ys.min()) - pad
    c = S[y0:ys.max() + 1 + pad, x0:xs.max() + 1 + pad].copy(); mm = m[y0:ys.max() + 1 + pad, x0:xs.max() + 1 + pad]; c[~mm, 3] = 0; c[mm, 3] = 255; return c, (x0, y0)
def P(p, o): return [int(p[0] - o[0]), int(p[1] - o[1])]
body, bo = blob(420, 700); Image.fromarray(body).save('art/gen/eel__body.png')
jaw, jo = blob(1200, 760); Image.fromarray(jaw).save('art/gen/eel__jaw.png')
rg = {'w': body.shape[1], 'h': body.shape[0], 'base': P((405, 960), bo), 'hinge': P((545, 470), bo), 'chin': P((850, 482), bo), 'snout': P((846, 420), bo),
      'jaw': {'w': jaw.shape[1], 'h': jaw.shape[0], 'hinge': P((955, 675), jo), 'tip': P((1480, 790), jo)}}
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); R['eel'] = rg
open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(R) + ';\n')
# the soft bones, in the body's crop: base (G), mid-neck (R), head (B, a child of the mid-neck, a hinge behind the skull)
Q = lambda p: P(p, bo); W, H = body.shape[1], body.shape[0]; allr = [[0, 0], [W, 0], [W, H], [0, H]]
bones = [
  {'poly': allr, 'root': Q((380, 700)), 'tip': Q((430, 250)), 't0': 0.0, 't1': 0.4, 'feather': 4},
  {'poly': allr, 'root': Q((405, 985)), 'tip': Q((395, 300)), 't0': 0.0, 't1': 0.3, 'feather': 4},
  {'poly': [Q(p) for p in [(330, 30), (910, 30), (910, 760), (600, 760), (560, 570), (330, 220)]], 'root': Q((470, 400)), 'tip': Q((846, 420)),
   'seam': [Q((380, 150)), Q((520, 560))], 'ramp': 45, 'feather': 3}]
# the file is laid out by hand, one bone a line: only the eel's entry is rewritten
src = open('art/softbones.json').read(); src = re.sub(r',\n  "eel__body": \{.*?\n\] \}', '', src, flags=re.S).rstrip()[:-1].rstrip()
src += ',\n  "eel__body": { "bones": [\n' + ',\n'.join('  ' + json.dumps(b) for b in bones) + '\n] }\n}\n'; json.loads(src)
open('art/softbones.json', 'w').write(src); print(json.dumps(rg))
