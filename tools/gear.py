#!/usr/bin/env python3
"""gear.py — worn equipment on the hero rig (TASKS 155): every outfit is one generation over a sheet of the hero's own rig parts.

  python3 tools/gear.py make         templates art/gen/gear_<set>_tpl.png (the current parts ×K on one sheet) + art/gear.json
  python3 tools/gear.py cut [SET..]  art/gen/gear_<set>.png (the repainted sheet) → art/gen/hero__<part>_<sfx>.png on the rig canvas

Each piece is cut from its slot of the sheet, scaled back by 1/K and fitted onto the part it was repainted from (scale and offset
searched for the best alpha overlap), so its pivots stay the rig's. The red cape is the hero's own and stays with every outfit: its
pixels come back from the original. Outfits that keep the head get the original head back; near (R) limbs are built from the far
ones and lit as nearer the camera, as herofix.py does for the plain hero. A helmet is a whole head: the body under it is drawn
without its own head (hero__body*_nh, written here for every armour), so no hair pokes out of the helmet.
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

W, H = 1536, 1024
GEN = 'art/gen'
HEAD = {'body': 76, 'body_back': 70}     # rows above this are the head (the collar and the cape start below)
# set → (suffix, scale, pieces in columns: each column a list of [piece, source]); source: a part name or 'head:<view>'
SETS = {
    'shirt': ('cl', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['farmL', 'farmL']], [['thighL', 'thighL'], ['shinL', 'shinL'], ['footL', 'footL']]]),
    'leather': ('le', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']], [['shinL', 'shinL'], ['footL', 'footL']]]),
    'hood': ('hd', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]]),
    'gauntlet': ('pl', 6, [[['farmL', 'farmL']]]),
    'helm_le': ('hle', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]]),
    'helm_kn': ('hkn', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]]),
}
BG = (58, 58, 68, 255)

load = lambda p: np.array(Image.open(p).convert('RGBA')).astype(float)
def bbox(m):
    ys, xs = np.where(m); return ys.min(), xs.min(), ys.max() + 1, xs.max() + 1

def source(src):
    if src.startswith('head:'):
        v = src[5:]; a = load(f'{GEN}/hero__{v}.png'); a[HEAD[v] + 14:] = 0; return a
    return load(f'{GEN}/hero__{src}.png')

def make():
    lay = {}
    for name, (sfx, K, cols) in SETS.items():
        sheet = Image.new('RGBA', (W, H), BG); items = []; widths = []
        for col in cols:
            ws = []; hs = 0
            for piece, src in col:
                a = source(src); y0, x0, y1, x1 = bbox(a[..., 3] > 24); ws.append((x1 - x0) * K); hs += (y1 - y0) * K
            widths.append(max(ws))
        gap = (W - sum(widths)) // (len(cols) + 1); x = gap
        for col, cw in zip(cols, widths):
            boxes = [];
            for piece, src in col:
                a = source(src); boxes.append((piece, src, bbox(a[..., 3] > 24)))
            th = sum((b[2] - b[0]) * K for _, _, b in boxes); vg = (H - th) // (len(boxes) + 1); y = vg
            for piece, src, (y0, x0, y1, x1) in boxes:
                a = source(src); crop = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.NEAREST)
                sheet.alpha_composite(crop, (x, y)); items.append({'piece': piece, 'src': src, 'box': [int(x0), int(y0), int(x1), int(y1)], 'at': [int(x), int(y)]})
                y += (y1 - y0) * K + vg
            x += cw + gap
        sheet.save(f'{GEN}/gear_{name}_tpl.png'); lay[name] = {'sfx': sfx, 'K': K, 'items': items}
        print(name, len(items), 'pieces')
    json.dump(lay, open('art/gear.json', 'w'), indent=1)

def fit(out, orig):
    """the repainted piece (canvas-sized RGBA, roughly placed) moved and scaled onto the original's alpha"""
    mo = orig[..., 3] > 110; best = None
    for sc in np.linspace(0.92, 1.08, 9):
        im = Image.fromarray(out.astype(np.uint8)); w, h = round(im.width * sc), round(im.height * sc)
        o2 = np.array(im.resize((w, h), Image.LANCZOS)).astype(float)
        cy, cx = bbox(o2[..., 3] > 110)[:2]; oy, ox = bbox(mo)[:2]
        for dy in range(-6, 7):
            for dx in range(-6, 7):
                c = np.zeros_like(orig); ty, tx = oy - cy + dy, ox - cx + dx
                ys, xs = slice(max(0, ty), min(c.shape[0], ty + h)), slice(max(0, tx), min(c.shape[1], tx + w))
                c[ys, xs] = o2[ys.start - ty:ys.stop - ty, xs.start - tx:xs.stop - tx]
                m = c[..., 3] > 110; iou = (m & mo).sum() / max(1, (m | mo).sum())
                if best is None or iou > best[0]: best = (iou, c)
    return best

def clean(a, min_px=20):
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    lab, n = nd.label(a[..., 3] > 0); sz = np.bincount(lab.ravel()); sz[0] = 1 << 30; a[sz[lab] < min_px, 3] = 0
    return a

def red(a): r, g, b = a[..., 0], a[..., 1], a[..., 2]; return (a[..., 3] > 0) & (r > 90) & (r > 1.7 * g) & (r > 1.7 * b)

def across(m):
    t = np.zeros(m.shape)
    for y in np.where(m.any(1))[0]:
        xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); t[y, x0:x1 + 1] = (np.arange(x0, x1 + 1) - x0) / max(1, x1 - x0)
    return t
ss = lambda a, b, x: (lambda q: q * q * (3 - 2 * q))(np.clip((x - a) / (b - a), 0, 1))
def near(L, part):
    """the near (R) twin of a far (L) limb: moved onto the R part's box and lit as nearer the camera (herofix.py)"""
    R0 = load(f'{GEN}/hero__{part}R.png'); y0, x0, y1, x1 = bbox(L[..., 3] > 0); Y0, X0 = bbox(R0[..., 3] > 0)[:2]
    src = np.zeros_like(L); hh, ww = min(y1 - y0, L.shape[0] - Y0), min(x1 - x0, L.shape[1] - X0); src[Y0:Y0 + hh, X0:X0 + ww] = L[y0:y0 + hh, x0:x0 + ww]
    m = src[..., 3] > 0; t = across(m); lit, shade = ss(0.5, 1, t), ss(0.45, 0, t)
    for c, k in zip(range(3), (1.2, 1.12, 1.0)): src[..., c] *= 1 + (k - 1) * lit
    src[..., :3] *= (1 - 0.18 * shade)[..., None]; return src

save = lambda a, n: Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{GEN}/{n}.png')

def cut(names):
    lay = json.load(open('art/gear.json'))
    for name in names:
        L = lay[name]; K, sfx = L['K'], L['sfx']; sheet = Image.open(f'{GEN}/gear_{name}.png').convert('RGBA').resize((W, H), Image.LANCZOS)
        for it in L['items']:
            x0, y0, x1, y1 = it['box']; ax, ay = it['at']; m = 10 * K
            reg = sheet.crop((ax - m, ay - m, ax + (x1 - x0) * K + m, ay + (y1 - y0) * K + m))
            sm = reg.resize((reg.width // K, reg.height // K), Image.LANCZOS)
            orig = source(it['src']); out = np.zeros_like(orig); oy, ox = y0 - 10, x0 - 10
            o = np.array(sm).astype(float); ys, xs = slice(max(0, oy), min(orig.shape[0], oy + o.shape[0])), slice(max(0, ox), min(orig.shape[1], ox + o.shape[1]))
            out[ys, xs] = o[ys.start - oy:ys.stop - oy, xs.start - ox:xs.stop - ox]
            # the sheet's background is not the piece: whatever matches it is cleared
            bgd = np.abs(out[..., :3] - np.array(BG[:3])).sum(-1) < 30; out[bgd, 3] = 0
            iou, a = fit(out, orig); a = clean(a); piece = it['piece']
            if piece in ('body', 'body_back'):
                full = load(f'{GEN}/hero__{piece}.png'); keep = red(full) & ((np.arange(full.shape[0])[:, None] > 110) if sfx == 'hd' else True)
                a[keep] = full[keep]
                if sfx != 'hd': hy = HEAD[piece]; a[:hy] = full[:hy]
            if piece.startswith('head'):
                v = 'body' if piece == 'head' else 'body_back'; hy = HEAD[v]; full = load(f'{GEN}/hero__{v}.png')
                a[hy + 6:] = 0; a[hy:hy + 6] = np.where(a[hy:hy + 6, :, 3:] > 0, a[hy:hy + 6], full[hy:hy + 6])   # the collar under the chin stays the body's
                save(a, f'hero__{piece}_{sfx[1:]}'); print(f'{name}: {piece} fit {iou:.2f}'); continue
            save(a, f'hero__{piece}_{sfx}'); print(f'{name}: {piece} fit {iou:.2f}')
            if piece.endswith('L'): save(near(a, piece[:-1]), f'hero__{piece[:-1]}R_{sfx}')
            if piece in ('body', 'body_back'):
                nh = a.copy(); nh[:HEAD[piece]] = 0; save(nh, f'hero__{piece}_{sfx}_nh')
    for v in ('body', 'body_back'):   # the plate armour (the hero as drawn) without its head, under a helmet
        nh = load(f'{GEN}/hero__{v}.png'); nh[:HEAD[v]] = 0; save(nh, f'hero__{v}_nh')

if __name__ == '__main__':
    if sys.argv[1] == 'make': make()
    else: cut(sys.argv[2:] or [n for n in SETS])
