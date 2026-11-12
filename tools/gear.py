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
import colorsys, json, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

W, H = 1536, 1024
GEN = 'art/gen'
HEAD = {'body': 76, 'body_back': 70}     # rows above this are the head (the collar and the cape start below)
# set → (suffix, scale, pieces in columns: each column a list of [piece, source]); source: a part name or 'head:<view>'
# a set's 4th field (TASKS 1113–1114): src — whose parts the sheet is made of, out — whose parts it writes (the mage is the hero
# repainted: the same rig, a new face, no red cape restored), base — the set paints the class itself (no suffix)
SETS = {
    'shirt': ('cl', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['farmL', 'farmL']], [['thighL', 'thighL'], ['shinL', 'shinL'], ['footL', 'footL']]]),
    'leather': ('le', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']], [['shinL', 'shinL'], ['footL', 'footL']]]),
    'hood': ('hd', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]]),
    'gauntlet': ('pl', 6, [[['farmL', 'farmL']]]),
    # the plate warmed (TASKS 1791): the same pieces as the plate, gauntlet and iron greave, browned steel instead of the cold blue-grey
    'plate': ('pw', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['farmL', 'farmL_pl']], [['thighL', 'thighL'], ['shinL', 'shinL']]]),
    'helm_le': ('hle', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]]),
    'helm_kn': ('hkn', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]]),
    'mage': ('', 3, [[['body', 'body']], [['body_back', 'body_back']], [['cape', 'cape']], [['uarmL', 'uarmL'], ['farmL', 'farmL']], [['thighL', 'thighL'], ['shinL', 'shinL'], ['footL', 'footL']]],
             {'src': 'hero', 'out': 'mage', 'base': 1}),
    'mage_leather': ('le', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]], {'src': 'mage', 'out': 'mage'}),
    'mage_hood': ('hd', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]], {'src': 'mage', 'out': 'mage'}),
    'mage_circlet': ('hci', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]], {'src': 'mage', 'out': 'mage'}),
    'archer': ('', 3, [[['body', 'body']], [['body_back', 'body_back']], [['cape', 'cape']], [['uarmL', 'uarmL'], ['farmL', 'farmL']], [['thighL', 'thighL'], ['shinL', 'shinL'], ['footL', 'footL']]],
               {'src': 'hero', 'out': 'archer', 'base': 1}),
    'archer_leather': ('le', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]], {'src': 'archer', 'out': 'archer'}),
    'archer_hood': ('hd', 3, [[['body', 'body']], [['body_back', 'body_back']], [['uarmL', 'uarmL'], ['thighL', 'thighL']]], {'src': 'archer', 'out': 'archer'}),
    'archer_helm_le': ('hle', 5, [[['head', 'head:body']], [['head_back', 'head:body_back']]], {'src': 'archer', 'out': 'archer'}),
}
opt = lambda name: (SETS[name][3] if len(SETS[name]) > 3 else {})
BG = (58, 58, 68, 255)

load = lambda p: np.array(Image.open(p).convert('RGBA')).astype(float)
def bbox(m):
    ys, xs = np.where(m); return ys.min(), xs.min(), ys.max() + 1, xs.max() + 1

def source(src, who='hero'):
    if src.startswith('head:'):
        v = src[5:]; a = load(f'{GEN}/{who}__{v}.png'); a[HEAD[v] + 14:] = 0; return a
    return load(f'{GEN}/{who}__{src}.png')

def make(names=None):
    lay = json.load(open('art/gear.json')) if names else {}
    for name in names or SETS:
        sfx, K, cols = SETS[name][:3]; who = opt(name).get('src', 'hero')
        sheet = Image.new('RGBA', (W, H), BG); items = []; widths = []
        for col in cols:
            ws = []; hs = 0
            for piece, src in col:
                a = source(src, who); y0, x0, y1, x1 = bbox(a[..., 3] > 24); ws.append((x1 - x0) * K); hs += (y1 - y0) * K
            widths.append(max(ws))
        gap = (W - sum(widths)) // (len(cols) + 1); x = gap
        for col, cw in zip(cols, widths):
            boxes = [];
            for piece, src in col:
                a = source(src, who); boxes.append((piece, src, bbox(a[..., 3] > 24)))
            th = sum((b[2] - b[0]) * K for _, _, b in boxes); vg = (H - th) // (len(boxes) + 1); y = vg
            for piece, src, (y0, x0, y1, x1) in boxes:
                a = source(src, who); crop = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.NEAREST)
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

def clean(a, min_px=20, one=False):
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    lab, n = nd.label(a[..., 3] > 0); sz = np.bincount(lab.ravel()); sz[0] = 1 << 30; a[sz[lab] < min_px, 3] = 0
    # one: a piece is one blob (a class's own parts, TASKS 1114): a neighbour's sliver caught in the cell goes, holes are filled
    if one and n > 1: sz[0] = 0; a[lab != sz.argmax(), 3] = 0
    if one:
        m = a[..., 3] > 0; holes = nd.binary_fill_holes(m) & ~m
        if holes.any(): _, (iy, ix) = nd.distance_transform_edt(~m, return_indices=True); a[holes] = a[iy[holes], ix[holes]]; a[holes, 3] = 255
    return a

# a class whose front torso was painted with its arms on it (the mage's sleeves, TASKS 1114 critic r2): below the shoulder capelet
# and above the skirt those columns are the arm pieces' place, so they are cleared and the new flank gets its outline
ARMLESS = {'mage': {'rows': (152, 205), 'x': (79, 139), 'hem': (205, 216, 62, 152)}}
def armless(a, who):
    A = ARMLESS.get(who)
    if not A: return a
    (y0, y1), (xl, xr) = A['rows'], A['x']; band = a[y0:y1]; band[:, :xl, 3] = 0; band[:, xr + 1:, 3] = 0
    for x in (xl, xr):
        col = band[:, x]; on = col[:, 3] > 0; col[on, :3] = (35, 16, 16)
    if 'hem' in A: h0, h1, hl, hr = A['hem']; a[h0:h1, :hl, 3] = 0; a[h0:h1, hr + 1:, 3] = 0   # (the glove's tip over the skirt's top)
    return a

def red(a): r, g, b = a[..., 0], a[..., 1], a[..., 2]; return (a[..., 3] > 0) & (r > 90) & (r > 1.7 * g) & (r > 1.7 * b)

def across(m):
    t = np.zeros(m.shape)
    for y in np.where(m.any(1))[0]:
        xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); t[y, x0:x1 + 1] = (np.arange(x0, x1 + 1) - x0) / max(1, x1 - x0)
    return t
ss = lambda a, b, x: (lambda q: q * q * (3 - 2 * q))(np.clip((x - a) / (b - a), 0, 1))
def near(L, part, who='hero'):
    """the near (R) twin of a far (L) limb: moved onto the R part's box and lit as nearer the camera (herofix.py)"""
    R0 = load(f'{GEN}/{who}__{part}R.png'); y0, x0, y1, x1 = bbox(L[..., 3] > 0); Y0, X0 = bbox(R0[..., 3] > 0)[:2]
    src = np.zeros_like(L); hh, ww = min(y1 - y0, L.shape[0] - Y0), min(x1 - x0, L.shape[1] - X0); src[Y0:Y0 + hh, X0:X0 + ww] = L[y0:y0 + hh, x0:x0 + ww]
    m = src[..., 3] > 0; t = across(m); lit, shade = ss(0.5, 1, t), ss(0.45, 0, t)
    for c, k in zip(range(3), (1.2, 1.12, 1.0)): src[..., c] *= 1 + (k - 1) * lit
    src[..., :3] *= (1 - 0.18 * shade)[..., None]; return src

save = lambda a, n: Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{GEN}/{n}.png')

def archer_tone(a, name, skip=None):
    """the archer's colours (TASKS 1124): the generator drifted the cloth to hue ~31 where the brief asks for ochre at 40, the legs came out
    near black and the cream scarf as light as the face. Legs: value x1.55 (the cloth rule darkened the trousers first); cloth: hue 40,
    saturation x0.95, value x0.7 (under the hero's lantern ochre went pale yellow); scarf (saturation under 0.45): value x0.8.
    Applied once, to a freshly cut part as it is saved, so a repeat cut never scales a colour twice; skip marks pixels restored from
    the archer's own (already toned) body."""
    a = a.clip(0, 255).astype(np.uint8).astype(float); leg = re.search(r'__(thigh|shin|foot)', name) is not None
    todo = a[..., 3] > 0
    if skip is not None: todo &= ~skip
    for y, x in zip(*np.where(todo)):
        h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255)); H = h * 360
        if leg: v = min(1, v * 1.55) if v > 0.08 else v
        elif 18 <= H <= 48 and s > 0.5 and v > 0.25: h, s, v = 40 / 360, min(1, s * 0.95), v * 0.7
        elif 30 <= H <= 62 and s < 0.45 and v > 0.65: v *= 0.8
        a[y, x, :3] = np.array(colorsys.hsv_to_rgb(h, s, v)) * 255
    return a

def cut(names):
    lay = json.load(open('art/gear.json'))
    for name in names:
        O = opt(name); who, out_, base = O.get('src', 'hero'), O.get('out', 'hero'), O.get('base', 0)
        put = lambda a, n: save(archer_tone(a, n, skip) if out_ == 'archer' else a, n)
        nm = lambda piece, sx: f'{out_}__{piece}' + (f'_{sx}' if sx else '')
        L = lay[name]; K, sfx = L['K'], L['sfx']; sheet = Image.open(f'{GEN}/gear_{name}.png').convert('RGBA').resize((W, H), Image.LANCZOS)
        for it in L['items']:
            x0, y0, x1, y1 = it['box']; ax, ay = it['at']; m = 10 * K
            reg = sheet.crop((ax - m, ay - m, ax + (x1 - x0) * K + m, ay + (y1 - y0) * K + m))
            sm = reg.resize((reg.width // K, reg.height // K), Image.LANCZOS)
            orig = source(it['src'], who); out = np.zeros_like(orig); oy, ox = y0 - 10, x0 - 10
            o = np.array(sm).astype(float); ys, xs = slice(max(0, oy), min(orig.shape[0], oy + o.shape[0])), slice(max(0, ox), min(orig.shape[1], ox + o.shape[1]))
            out[ys, xs] = o[ys.start - oy:ys.stop - oy, xs.start - ox:xs.stop - ox]
            # the sheet's background is not the piece: whatever matches it and reaches the cell's edge is cleared; a dark grey inside
            # the piece (the mage's trousers, TASKS 1114) stays
            bgd = np.abs(out[..., :3] - np.array(BG[:3])).sum(-1) < 30
            lab, _ = nd.label(bgd | (out[..., 3] < 24)); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            out[np.isin(lab, list(edge)), 3] = 0
            skip = None; iou, a = fit(out, orig); a = clean(a, one=out_ != 'hero'); piece = it['piece']
            if piece == 'body': a = clean(armless(a, out_), one=out_ != 'hero')
            if piece in ('body', 'body_back') and not base:
                full = load(f'{GEN}/{who}__{piece}.png'); keep = red(full) & ((np.arange(full.shape[0])[:, None] > 110) if sfx == 'hd' else True)
                a[keep] = full[keep]; skip = keep.copy()
                if sfx != 'hd': hy = HEAD[piece]; a[:hy] = full[:hy]; skip[:hy] = True
            if piece.startswith('head'):
                v = 'body' if piece == 'head' else 'body_back'; hy = HEAD[v]; full = load(f'{GEN}/{who}__{v}.png')
                a[hy + 6:] = 0; a[hy:hy + 6] = np.where(a[hy:hy + 6, :, 3:] > 0, a[hy:hy + 6], full[hy:hy + 6])   # the collar under the chin stays the body's
                put(a, nm(piece, sfx[1:])); print(f'{name}: {piece} fit {iou:.2f}'); continue
            put(a, nm(piece, sfx)); print(f'{name}: {piece} fit {iou:.2f}')
            if piece.endswith('L'): put(near(a, piece[:-1], who), nm(piece[:-1] + 'R', sfx))
            if piece in ('body', 'body_back'):
                nh = a.copy(); nh[:HEAD[piece]] = 0; put(nh, nm(piece, (sfx + '_nh') if sfx else 'nh'))
    if all(opt(n).get('out', 'hero') == 'hero' for n in names):   # (a class's sets leave the hero's parts alone)
        for v in ('body', 'body_back'):   # the plate armour (the hero as drawn) without its head, under a helmet
            nh = load(f'{GEN}/hero__{v}.png'); nh[:HEAD[v]] = 0; save(nh, f'hero__{v}_nh')

if __name__ == '__main__':
    if sys.argv[1] == 'make': make(sys.argv[2:] or None)
    else: cut(sys.argv[2:] or [n for n in SETS])
