# ref critic r5, author remarks 8-10 / task 2203: the torso's near side under the arm in the arch, from the layers of grab_r4.mjs
# (only_body): the flat strip (cloak-coloured, no quilting/seams) = body pixels left of the chest plate/jerkin, between armpit and hip,
# whose 3x3 neighbourhood is flat; its area in arch px and world px (/3.2^2), its Lab, and Lab of the reference's gambeson and cloak
import os, sys, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cape_r5 import lab
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
D = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5_ref') + '')
def flat(L, r=1):
    s = np.zeros(L.shape[:2]); H, W = s.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sh = np.roll(np.roll(L[..., 0], dy, 0), dx, 1); s = np.maximum(s, np.abs(sh - L[..., 0]))
    return s
REF = {'warrior': ('art/char_refs/warrior_a_v2.png', {'gambeson': (350, 500, 430, 560), 'cloak': (240, 600, 290, 700)}),
       'archer': ('art/char_refs/archer_a.png', {'jerkin': (330, 330, 420, 390), 'cloak': (215, 450, 260, 600)})}
# the strip's box in the arch layer crop (frame coords): x from the arm's inner edge to the chest's edge, armpit to hip
BOX = {'warrior': (222, 240, 252, 300), 'archer': (222, 240, 252, 300)}
for c in ['warrior', 'archer']:
    path, regs = REF[c]; R = lab(np.asarray(Image.open(os.path.join(ROOT, path)).convert('RGB')).astype(float))
    refl = {k: np.round(R[y0:y1, x0:x1].reshape(-1, 3).mean(0), 1) for k, (x0, y0, x1, y1) in regs.items()}
    for t in ['0.01', '1.2', '2.4']:
        b = np.asarray(Image.open(os.path.join(D, f'layers/arch_{c}_t{t}__only_body.png')).convert('RGB')).astype(float)
        nb = np.asarray(Image.open(os.path.join(D, f'layers/arch_{c}_t{t}__none.png')).convert('RGB')).astype(float)
        al = np.asarray(Image.open(os.path.join(D, f'layers/arch_{c}_t{t}__all.png')).convert('RGB')).astype(float)
        L = lab(b); body = np.abs(b - nb).sum(2) > 24; F = flat(L) < 4
        x0, y0, x1, y1 = BOX[c]; m = np.zeros(body.shape, bool); m[y0:y1, x0:x1] = True
        strip = m & body & F & (L[..., 0] > 12)
        vis = strip & (np.abs(al - b).sum(2) < 6)
        lm = np.round(L[strip].mean(0), 1) if strip.any() else None
        dE = {k: round(float(np.linalg.norm(lm - v)), 1) for k, v in refl.items()} if lm is not None else {}
        print(f'{c:7} t{t:4} flat strip {strip.sum():4} px ({strip.sum() / 3.2 ** 2:5.1f} world px²), visible in the arch {vis.sum():4} px, Lab {lm}, ΔE to ref {dE}, ref {refl}')
        if t == '0.01':
            g = Image.fromarray(al.astype(np.uint8)).crop((200, 215, 280, 345)); a = np.asarray(g).copy(); s = strip[215:345, 200:280] & vis[215:345, 200:280]
            a[s] = (0.5 * a[s] + 0.5 * np.array([0, 255, 0])).astype(np.uint8)
            Image.fromarray(a).resize((720, 1170), Image.NEAREST).save(os.path.join(D, f'z9_strip_{c}.png'))
            Image.fromarray(al.astype(np.uint8)).crop((200, 215, 280, 345)).resize((720, 1170), Image.NEAREST).save(os.path.join(D, f'z9_side_{c}.png'))
