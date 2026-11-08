# the lava salamander rig (TASKS 408) from its part sheet (art/gen/salamander_parts_sheet.png, seen from straight above, the head up):
# the head, body and tail in one drawing (salamander__body) bent in the shader on three soft bones (art/softbones.json: the tail from
# the hips, its tip riding on it, the neck from the shoulders), and one leg split at the knee into legA and legB. The scene lays the
# parts out on the floor round its facing, so only the drawings and their joint points (sheet px × K, each part's own crop) are stored
import json, re; import numpy as np; from PIL import Image; from scipy import ndimage as nd
S = np.array(Image.open('art/gen/salamander_parts_sheet.png').convert('RGBA')); lab, n = nd.label(S[..., 3] > 60)
K = 0.32
X = np.arange(S.shape[1])[None, :].repeat(S.shape[0], 0)
def blob(x, y, keep=None, pad=8):
    m = lab == lab[y, x]
    if keep is not None: m &= keep
    ys, xs = np.where(m); x0, y0 = int(xs.min()) - pad, int(ys.min()) - pad
    c = S[y0:ys.max() + 1 + pad, x0:xs.max() + 1 + pad].copy(); mm = m[y0:ys.max() + 1 + pad, x0:xs.max() + 1 + pad]; c[~mm] = 0
    im = Image.fromarray(c).resize((round(c.shape[1] * K), round(c.shape[0] * K)), Image.Resampling.BOX); a = np.array(im)
    a[..., 3] = np.where(a[..., 3] >= 110, 255, 0); a[a[..., 3] == 0] = 0
    return a, (x0, y0)
def save(name, img): Image.fromarray(img).save(f'art/gen/salamander__{name}.png')
def P(p, o): return [round((p[0] - o[0]) * K), round((p[1] - o[1]) * K)]
body, bo = blob(385, 500); save('body', body)
KNEE = (1068, 300)
legA, la = blob(900, 300, X < KNEE[0] + 6); legB, lb = blob(1200, 300, X >= KNEE[0] - 6); save('legA', legA); save('legB', legB)
rg = {'w': body.shape[1], 'h': body.shape[0], 'c': P((385, 470), bo), 'nose': P((385, 30), bo), 'tail': P((385, 1000), bo),
      'legs': [P(p, bo) for p in [(290, 325), (290, 600)]], 'mouth': P((385, 60), bo),
      'legA': {'w': legA.shape[1], 'h': legA.shape[0], 'root': P((862, 296), la), 'end': P(KNEE, la)},
      'legB': {'w': legB.shape[1], 'h': legB.shape[0], 'root': P(KNEE, lb), 'end': P((1300, 300), lb)},
      # the soft bones (prepped px of the body): the tail from the hips (R), the neck from the shoulders (G), the tail's tip (B, riding on R)
      'bones': [P((385, 625), bo), P((385, 300), bo), P((385, 800), bo)]}
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); R['salamander'] = rg
open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(R) + ';\n')
W, H = body.shape[1], body.shape[0]; Q = lambda p: P(p, bo)
bones = [
  {'poly': [[0, Q((0, 610))[1]], [W, Q((0, 610))[1]], [W, H], [0, H]], 'root': Q((385, 625)), 'tip': Q((385, 1000)), 't0': 0.0, 't1': 1.0, 'seam': [[0, Q((0, 615))[1]], [W, Q((0, 615))[1]]], 'ramp': 14, 'feather': 2},
  {'poly': [[0, 0], [W, 0], [W, Q((0, 310))[1]], [0, Q((0, 310))[1]]], 'root': Q((385, 300)), 'tip': Q((385, 30)), 't0': 0.0, 't1': 0.7, 'seam': [[0, Q((0, 305))[1]], [W, Q((0, 305))[1]]], 'ramp': 12, 'feather': 2},
  {'poly': [[0, Q((0, 790))[1]], [W, Q((0, 790))[1]], [W, H], [0, H]], 'root': Q((385, 800)), 'tip': Q((385, 1000)), 't0': 0.0, 't1': 1.0, 'seam': [[0, Q((0, 795))[1]], [W, Q((0, 795))[1]]], 'ramp': 10, 'feather': 2}]
src = open('art/softbones.json').read(); src = re.sub(r',\n  "salamander__body": \{.*?\n\] \}', '', src, flags=re.S).rstrip()[:-1].rstrip()
src += ',\n  "salamander__body": { "bones": [\n' + ',\n'.join('  ' + json.dumps(b) for b in bones) + '\n] }\n}\n'; json.loads(src)
open('art/softbones.json', 'w').write(src); print(json.dumps(rg))
