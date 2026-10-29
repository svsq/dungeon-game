# the crab rig (TASKS 309) from its part sheet (art/gen/crab_parts_sheet.png, seen from straight above, the front up): the shell, one
# walking leg split at the knee, one claw arm split at the elbow, the pincer with its fixed finger and the movable finger cut off the
# closed claw drawn above it. The scene lays the parts out on the floor round the crab's facing, so only the drawings and their joint
# points (sheet px, each part's own crop) are stored
import json, re; import numpy as np; from PIL import Image; from scipy import ndimage as nd
S = np.array(Image.open('art/gen/crab_parts_sheet.png').convert('RGBA')); lab, n = nd.label(S[..., 3] > 60)
def blob(x, y, keep=None):
    k = lab[y, x]; m = lab == k
    if keep is not None: m &= keep
    ys, xs = np.where(m); c = S[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(); c[~m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 3] = 0; return c, (int(xs.min()), int(ys.min()))
X = np.arange(S.shape[1])[None, :].repeat(S.shape[0], 0)
out = {}
def save(name, img): Image.fromarray(img).save(f'art/gen/crab__{name}.png')
def P(p, o): return [int(p[0] - o[0]), int(p[1] - o[1])]
body, bo = blob(447, 584); save('body', body)
legA, la = blob(1000, 850, X < 1168); legB, lb = blob(1250, 850, X >= 1168); save('legA', legA); save('legB', legB)
armA, aa = blob(1000, 660, X < 1132); armB, ab = blob(1250, 660, X >= 1132); save('armA', armA); save('armB', armB)
hand, ho = blob(1000, 430); save('hand', hand)
fing, fo = blob(1300, 150, X >= 1115); save('finger', fing)
KNEE, ELBOW, WRIST = (1150, 812), (1162, 657), (1390, 662)
sock = [(127, 435), (113, 577), (146, 678)]; cx = 435
rg = {'w': body.shape[1], 'h': body.shape[0], 'c': P((cx, 590), bo), 'front': P((cx, 300), bo),
      'legs': [P(p, bo) for p in sock], 'claw': P((262, 352), bo),
      'legA': {'w': legA.shape[1], 'h': legA.shape[0], 'root': P((900, 850), la), 'end': P(KNEE, la)},
      'legB': {'w': legB.shape[1], 'h': legB.shape[0], 'root': P(KNEE, lb), 'end': P((1375, 965), lb)},
      'armA': {'w': armA.shape[1], 'h': armA.shape[0], 'root': P((910, 660), aa), 'end': P(ELBOW, aa)},
      'armB': {'w': armB.shape[1], 'h': armB.shape[0], 'root': P(ELBOW, ab), 'end': P(WRIST, ab)},
      'hand': {'w': hand.shape[1], 'h': hand.shape[0], 'root': P((890, 447), ho), 'hinge': P((1165, 425), ho), 'end': P((1457, 382), ho)},
      'finger': {'w': fing.shape[1], 'h': fing.shape[0], 'root': P((1125, 140), fo), 'end': P((1457, 262), fo)}}
factor = 128 / rg['w']
def scaled(v):
    if isinstance(v, dict): return {k: scaled(x) for k, x in v.items()}
    if isinstance(v, list): return [scaled(x) for x in v]
    return round(v * factor)
rg = scaled(rg)
palette = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in ['#060506', '#231010', '#36120f', '#4f150c', '#73140d', '#552f25', '#733a21', '#934218', '#3e3234', '#6b5c56', '#c8b89a', '#eed68a', '#1a4135', '#64bdea']], dtype=float)
for name in ['body', 'legA', 'legB', 'armA', 'armB', 'hand', 'finger']:
    path = f'art/gen/crab__{name}.png'; im = Image.open(path).convert('RGBA')
    w, h = max(1, round(im.width * factor / 4)), max(1, round(im.height * factor / 4))
    a = np.array(im.resize((w, h), Image.Resampling.NEAREST)); rgb = a[..., :3].astype(float)
    near = ((rgb[:, :, None] - palette[None, None]) ** 2).sum(axis=3).argmin(axis=2)
    a[..., :3] = palette[near].astype(np.uint8); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a[a[..., 3] == 0] = 0
    Image.fromarray(a).resize((w * 4, h * 4), Image.Resampling.NEAREST).save(path)
    target = rg if name == 'body' else rg[name]; target['w'], target['h'] = w * 4, h * 4
R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip())); R['crab'] = rg
open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(R) + ';\n'); print(json.dumps(rg))
