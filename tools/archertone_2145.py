# TASKS 2145: the archer looked ill: straw hair and a pale face in the same khaki as his jacket, all of it greyed by his look's low
# saturation, read as one sickly green. Here, in OKLab: the hair goes dark blond to chestnut, the face warmer, the jacket, sleeves and
# cape a muted olive. Rebuilds from the originals in art/old/<name>-20261117-2145.png, so a second run changes nothing; edit those to
# change the source. The *_w files are soft-bone weight maps, not paint. Then: python3 tools/prep.py --only <the names printed>
# usage: python3 tools/archertone_2145.py
import os, shutil
import numpy as np
from PIL import Image, ImageDraw

GEN, OLD, TAG = 'art/gen', 'art/old', '20261117-2145'
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
def oklab(c): c = c / 255; return np.cbrt(np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92) @ M1.T) @ M2.T
def srgb(lab): c = np.clip((lab @ np.linalg.inv(M2).T) ** 3 @ np.linalg.inv(M1).T, 0, 1); return 255 * np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
# the head on the 188 × 360 rig canvas lies above the scarf's top row; on the 1024 portrait above its scarf, the quiver's feathers boxed out
HEAD = {'rig': 76, 'portrait': 590}
FEATHERS = (760, 440, 950, 640)
# the portrait's lit skin reaches 74° (the rig's stops under 68°): inside its face, ear and neck only the hair over 75° is hair
KHAKI, SKIN, PORTRAIT_HAIR_H = (68, 100), (35, 68), 75
PORTRAIT_FACE = [(370, 350), (500, 300), (660, 280), (740, 330), (740, 500), (680, 580), (580, 600), (480, 600), (400, 500), (370, 430)]
HAIR = {'L': (0.39, 0.83, 0.30, 0.60), 'h': 62, 'hk': 0.5, 'C': 1.05}
FACE = {'dh': -8, 'C': 1.2}
# the cream scarf shares the jacket's hue, lighter: the cloth fades out over CLOTH['L'] so the scarf keeps its cream; under a hood
# the bangs are the light khaki and the hood the dark
CLOTH = {'h': 96, 'hk': 0.5, 'C': 0.62, 'L': (0.56, 0.64)}
BANGS_L = 0.55
def ss(e0, e1, x): q = np.clip((x - e0) / (e1 - e0), 0, 1); return q * q * (3 - 2 * q)

def tone(a, head_rows, hood, portrait):
    H, W = a.shape[:2]; on = a[..., 3] > 0; lab = oklab(a[..., :3]); L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    C, h = np.hypot(A, B), np.degrees(np.arctan2(B, A)) % 360; ys, xs = np.mgrid[0:H, 0:W]
    head = on & (ys < head_rows)
    if portrait: x0, y0, x1, y1 = FEATHERS; head &= ~((xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1))
    khaki = on & (C > 0.025) & (h >= KHAKI[0]) & (h < KHAKI[1])
    skin = np.zeros((H, W), bool)
    if portrait: m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(PORTRAIT_FACE, fill=1); skin = np.array(m) > 0
    hair = head & khaki & (L < 0.88) & ((L > BANGS_L) if hood else True) & ~(skin & (h < PORTRAIT_HAIR_H))
    face = head & (C > 0.03) & (h >= SKIN[0]) & (h < SKIN[1]) & (L > 0.55) & (not portrait)
    cloth = (khaki & ~hair & ~face & (on if hood else ~head)) & (not portrait)
    nL, nC, nh = L.copy(), C.copy(), h.copy()
    l0, l1, m0, m1 = HAIR['L']; nL[hair] = np.clip(m0 + (L[hair] - l0) * (m1 - m0) / (l1 - l0), 0.12, m1 + 0.05)
    nh[hair] = HAIR['h'] + (h[hair] - 80) * HAIR['hk']; nC[hair] = C[hair] * HAIR['C']
    nh[face] = h[face] + FACE['dh']; nC[face] = C[face] * FACE['C']
    wc = cloth * (1 - ss(*CLOTH['L'], L))
    nh[cloth] = h[cloth] + (CLOTH['h'] + (h[cloth] - 80) * CLOTH['hk'] - h[cloth]) * wc[cloth]; nC[cloth] = C[cloth] * (1 + (CLOTH['C'] - 1) * wc[cloth])
    hit = hair | face | cloth; r = np.radians(nh)
    out = srgb(np.stack([nL, nC * np.cos(r), nC * np.sin(r)], -1)); a[hit, :3] = out[hit]
    return a, hair.sum(), face.sum(), int((wc > 0.5).sum())

names = sorted(n[:-4] for n in os.listdir(GEN) if n.startswith('archer__') and n.endswith('.png') and not n.endswith('_w.png')) + ['portrait_archer']
done = []
for n in names:
    src = f'{OLD}/{n}-{TAG}.png'
    if not os.path.exists(src): shutil.copy(f'{GEN}/{n}.png', src)
    a = np.array(Image.open(src).convert('RGBA')).astype(float)
    portrait = n.startswith('portrait'); headed = portrait or '__body' in n or '__head' in n
    a, nh, nf, nc = tone(a, HEAD['portrait' if portrait else 'rig'] if headed else 0, '_hd' in n, portrait)
    if nh + nf + nc == 0: os.remove(src); continue
    Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8)).save(f'{GEN}/{n}.png'); done.append(n)
    print(n, 'hair', nh, 'face', nf, 'cloth', nc)
print('prep:', ','.join(done))
