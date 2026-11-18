#!/usr/bin/env python3
"""regen_2146.py — a class's new look (TASKS 2146, docs/CHAR_REGEN_2146.md): a four-part sheet (torso with head, cape, one arm,
one leg, left to right) cut onto the rig canvas, with the face of the class's small native reference put on the world's grid.

  python3 tools/regen_2146.py front RIG SHEET SMALL [--out DIR] [--cape-at dx,dy] [--head-dx N] [--head-dy N] [--neck N]
      partrig.py on the sheet without its cape (into DIR, never art/gen: partrig deletes every RIG__*.png it finds), then the cape
      behind the far shoulder, the head swapped for SMALL's head one cell per art pixel, the near limbs relit; writes DIR/RIG__*.png,
      DIR/preview.png and merges the points into live/rigs.js (RIGS.RIG). Prints the near eye's cell (look.eye) and the neck row.
      --skirt: the sheet has a fifth part at its right end, a long robe's skirt (the mage, whose robe hides his legs to the ankles):
      it is not cut by partrig but laid under the torso's hem down to --skirt-hem·H, and it replaces the thighs: thighL is the whole
      skirt, thighR its front from --skirt-split of its width (the split in the robe); the scene swings them with the legs, damped
      (look.robe), and draws them over the shins, so the boots step out under the hem
  python3 tools/regen_2146.py back RIG SHEET [--out DIR] [--head-dy N] [--back-k K] [--back-dx N]
      the back view fitted onto DIR's parts: pauldron to pauldron as wide as the front's, head top on the front's head top
  python3 tools/regen_2146.py quiver RIG ICON [--out DIR] [--q-h 0.36] [--q-at dx,dy]
      the archer's quiver (the item icon, mirrored: fletchings up to the left) on the rig canvas as its own part RIG__quiver, slanted
      across the back, its top left of the head: its box's top-left at the far shoulder + dx·its width, the head's top + dy·H
  python3 tools/regen_2146.py install RIG DIR [--tag 20261117-2146] [--rigs CUT_RIGS_JS]
      the old art/gen/RIG__<part>.png of every part DIR holds to art/old/RIG__<part>-TAG.png, then DIR's in their place;
      --rigs: RIGS.RIG of the cut's scratch rigs.js (the RIGS_JS the cut ran with) written into live/rigs.js (or $RIGS_JS)
RIG is any hero rig: the accepted looks (hero, mage, archer) or a new one (hero_b, mage_c, archer_b: docs/LOOKS_2148.md §5)
"""
import argparse, glob, json, os, re, shutil, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

GRID = 42                         # the hero is 42 world pixels tall (HERO_H 84 = 2 screen px per world px)
CAPE_TOP = 0.06                   # the cape's top sits this share of the rig height above the far shoulder, behind the body
ap = argparse.ArgumentParser(); ap.add_argument('mode'); ap.add_argument('rig'); ap.add_argument('sheet'); ap.add_argument('small', nargs='?')
ap.add_argument('--out', default='frames/hero_2146/cut'); ap.add_argument('--cape-at', default='0,0'); ap.add_argument('--head-dx', type=int, default=0)
ap.add_argument('--head-dy', type=int, default=0); ap.add_argument('--neck', type=int, default=0); ap.add_argument('--height', type=int, default=360)
ap.add_argument('--head', default='small', help='small: the small reference\'s head; vote: the drawn head on the grid'); ap.add_argument('--cape-x', type=float, default=0.8)
ap.add_argument('--back-k', type=float, default=1.0, help='the back view\'s scale on top of the pauldron fit (a back painted narrower than the front)'); ap.add_argument('--back-dx', type=int, default=0)
ap.add_argument('--q-h', type=float, default=0.36); ap.add_argument('--q-at', default='-0.45,0.1')
ap.add_argument('--cape-hem', type=float, default=0.8, help='the cape\'s hem as a share of the rig height (the reference: to the calves)')
ap.add_argument('--skirt', action='store_true', help='a fifth part, the robe\'s skirt, at the sheet\'s right end: it becomes the thighs (the mage)')
ap.add_argument('--skirt-hem', type=float, default=0.9); ap.add_argument('--skirt-split', type=float, default=0.55); ap.add_argument('--skirt-top', type=int, default=0)
ap.add_argument('--tag', default='20261117-2146'); ap.add_argument('--rigs', default='')
a = ap.parse_args()
rigs_path = os.environ.get('RIGS_JS', 'live/rigs.js')   # a scratch copy while the cut is tried out of the tree
read_rigs = lambda: json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(rigs_path).read().strip()))
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda arr, p: Image.fromarray(arr.astype(np.uint8)).save(p)

def blobs(arr, n):
    lab, k = nd.label(nd.binary_closing(arr[..., 3] > 60, iterations=2)); sz = nd.sum(np.ones_like(lab), lab, range(1, k + 1))
    keep = sorted((np.argsort(-sz)[:n] + 1), key=lambda l: np.where(lab == l)[1].min()); return lab, keep

def small_figure(path):
    """the small reference's figure: background (its corner colour) cleared, cropped to the figure"""
    s = np.array(Image.open(path).convert('RGBA')).astype(int); bg = s[0, 0, :3]
    s[np.abs(s[..., :3] - bg).sum(-1) < 30, 3] = 0; ys, xs = np.where(s[..., 3] > 0)
    return s[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8)

def head_rows(fig):
    """the small figure's head: the rows above its narrowest row under the hair (the neck), before the shoulders widen"""
    w = (fig[..., 3] > 0).sum(1); top = 0
    for y in range(3, len(w) - 1):
        if w[y + 1] >= w[y] + 3: return y + 1
    return 7

def cell_paint(dst, fig, rows, ox, oy, C):
    """fig's rows [0, rows) drawn one canvas cell (C px) per art pixel, the cell grid anchored at the canvas origin like the
    scene's eye snap (scene_hero.js: a cell of RIGS.h / 42 px is one world pixel); ox, oy in cells"""
    for y in range(rows):
        for x in range(fig.shape[1]):
            if fig[y, x, 3] < 128: continue
            x0, x1 = round((ox + x) * C), round((ox + x + 1) * C); y0, y1 = round((oy + y) * C), round((oy + y + 1) * C)
            if y0 < 0 or x0 < 0: continue
            dst[y0:y1, x0:x1, :3] = fig[y, x, :3]; dst[y0:y1, x0:x1, 3] = 255

def across(m):
    t = np.zeros(m.shape)
    for y in np.where(m.any(1))[0]:
        xs = np.where(m[y])[0]; t[y, xs.min():xs.max() + 1] = (np.arange(xs.min(), xs.max() + 1) - xs.min()) / max(1, xs.max() - xs.min())
    return t
ss = lambda lo, hi, x: (lambda q: q * q * (3 - 2 * q))(np.clip((x - lo) / (hi - lo), 0, 1))
def relight_near(arr):
    """a near (R) limb is the far one's drawing: lit on its camera side, as gear.near does, so the two never read as clones"""
    out = arr.astype(float); m = out[..., 3] > 0; t = across(m); lit, shade = ss(0.5, 1, t), ss(0.45, 0, t)
    for c, k in zip(range(3), (1.2, 1.12, 1.0)): out[..., c] *= 1 + (k - 1) * lit
    out[..., :3] *= (1 - 0.18 * shade)[..., None]; return out.clip(0, 255)

def vote(arr, C, ox=0.0, oy=0.0):
    """the scene's snap (lib.js snapTex) on the world grid: 4×4 samples a cell, opaque if its centre is, painted in the colour
    most samples are within 0.13 of; returns one pixel per cell"""
    H, W = arr.shape[:2]; ny, nx = int(np.ceil((H - oy) / C)), int(np.ceil((W - ox) / C)); out = np.zeros((ny, nx, 4), np.uint8)
    f = (np.arange(4) + 0.5) / 4
    for j in range(ny):
        for i in range(nx):
            cy, cx = int(oy + (j + 0.5) * C), int(ox + (i + 0.5) * C)
            if cy >= H or cx >= W or arr[cy, cx, 3] < 128: continue
            pts = [arr[min(H - 1, int(oy + (j + v) * C)), min(W - 1, int(ox + (i + u) * C))] for v in f for u in f]
            P = np.array([p[:3] for p in pts if p[3] >= 128], float)
            if not len(P): continue
            d = np.linalg.norm(P[:, None] - P[None], axis=-1) < 0.13 * 255; k = d.sum(1).argmax()
            out[j, i, :3] = P[d[k]].mean(0); out[j, i, 3] = 255
    return out

def unstub(blob):
    """the torso's sleeve stubs (the cut ends of the arms, drawn as open cylinders at the shoulders) cleared: the far arm is drawn
    under the body and its pauldron has to show where the stub was. The stubs are the rows wider than the chest under them; the
    shoulder pivots go at each stub's middle, a quarter down its band (the pauldron's top sits a little above the pivot)"""
    al = blob[..., 3] > 60; h = al.shape[0]; ext = [(np.where(r)[0].min(), np.where(r)[0].max()) if r.any() else None for r in al]
    wd = np.array([e[1] - e[0] if e else 0 for e in ext]); top = int(0.2 * h); ymax = top + int(np.argmax(wd[top:int(0.65 * h)]))
    chest = next(y for y in range(ymax, int(0.75 * h)) if wd[y] < 0.85 * wd[ymax]); cy = min(h - 1, chest + int(0.02 * h)); cl, cr = ext[cy]
    band0 = next(y for y in range(top, ymax + 1) if ext[y] and (ext[y][0] < cl - 0.02 * wd[ymax] or ext[y][1] > cr + 0.02 * wd[ymax]))
    out = blob.copy(); sh = {}
    for side, sel in (('L', lambda xs: xs < cl), ('R', lambda xs: xs > cr)):
        yy, xx = [], []
        for y in range(band0, chest + 1):
            xs = np.where(al[y])[0]; xs = xs[sel(xs)]
            if len(xs): out[y, xs, 3] = 0; yy += [y] * len(xs); xx += list(xs)
        if xx: sh[side] = (float(np.mean(xx)) / al.shape[1], (min(yy) + 0.25 * (max(yy) - min(yy))) / h)
    return out, sh, (band0, chest, cl, cr)

def collar_row(b):
    """the first row under the head where the body widens (the collar and shoulders)"""
    w = (b[..., 3] > 0).sum(1); ys = np.where(w > 0)[0]; top = ys.min(); ref = np.median(w[top + 5:top + 30])
    for y in range(top + 20, len(w)):
        if w[y] > 1.6 * ref: return y
    return top + 60

def front():
    os.makedirs(a.out, exist_ok=True); S = load(a.sheet); lab, keep = blobs(S, 5 if a.skirt else 4)
    if len(keep) < (5 if a.skirt else 4): sys.exit(f'{a.sheet}: {len(keep)} parts, {5 if a.skirt else 4} wanted (torso, cape, arm, leg[, skirt])')
    skirt = None
    if a.skirt:
        sk_l = keep[-1]; keep = keep[:4]; ys_, xs_ = np.where(lab == sk_l)
        skirt = S[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1] * (lab[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1] == sk_l)[..., None]
        S = S.copy(); S[lab == sk_l] = 0
    part = lambda l: (lambda ys, xs: (S[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * (lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1] == l)[..., None]))(*np.where(lab == l))
    body_l, cape_l, arm_l, leg_l = keep; cape = part(cape_l)
    rest = S.copy(); rest[lab == cape_l] = 0
    ys_, xs_ = np.where(lab == body_l); y0_, x0_ = ys_.min(), xs_.min(); bb = rest[y0_:ys_.max() + 1, x0_:xs_.max() + 1]
    bb2, shf, band = unstub(bb * (lab[y0_:ys_.max() + 1, x0_:xs_.max() + 1] == body_l)[..., None]); keep_ = (lab[y0_:ys_.max() + 1, x0_:xs_.max() + 1] == body_l)
    bb[keep_] = bb2[keep_]; print('stubs cleared, band', band, 'shoulders', shf)
    tmp = os.path.join(a.out, 'sheet_nocape.png'); save(rest, tmp)
    subprocess.run([sys.executable, 'tools/partrig.py', a.rig, '--sheet', tmp, '--order', 'body,arm,leg', '--height', str(a.height),
                    '--bodyreg0', '0.38', '--face', 'right', *sum((['--sh', f'{k}={v[0]:.4f},{v[1]:.4f}'] for k, v in shf.items()), []), '--src', a.out, '--preview', os.path.join(a.out, 'partrig_preview.png')], check=True)
    R = read_rigs(); rg = R[a.rig]; W, H = rg['w'], rg['h']; C = H / GRID
    body = load(os.path.join(a.out, f'{a.rig}__body.png')); by, bx = np.where(body[..., 3] > 60)
    sc = (by.max() - by.min() + 1) / part(body_l).shape[0]
    # the cape: same scale as the sheet; its top right behind the far shoulder, hanging down the back
    cw = round(cape.shape[1] * sc); cy0 = round(rg['shL'][1] - CAPE_TOP * H); ch = max(round(cape.shape[0] * sc), round(a.cape_hem * H) - cy0); cimg = np.array(Image.fromarray(cape).resize((cw, ch), Image.LANCZOS))
    dx, dy = (int(v) for v in a.cape_at.split(',')); cx = round(rg['shL'][0] + a.cape_x * (rg['shR'][0] - rg['shL'][0]) - cw) + dx; cy = round(rg['shL'][1] - CAPE_TOP * H) + dy
    pad = max(0, -cx)
    if pad:                       # the cape hangs past the canvas's left edge: the canvas grows and every point moves right
        for k, v in rg.items():
            if isinstance(v, list) and len(v) == 2 and all(isinstance(q, (int, float)) for q in v): rg[k] = [v[0] + pad, v[1]]
        rg['gap'] += pad; rg['w'] = W = W + pad; cx += pad
    capeC = np.zeros((H, W, 4), np.uint8); y1 = min(H, cy + ch); capeC[cy:y1, cx:cx + cw] = cimg[:y1 - cy]
    parts = {}
    for f in glob.glob(os.path.join(a.out, f'{a.rig}__*.png')):
        n = os.path.basename(f)[len(a.rig) + 2:-4]; p = load(f)
        if pad: q = np.zeros((H, W, 4), np.uint8); q[:, pad:] = p; p = q
        parts[n] = p
    parts['cape'] = capeC
    for n in list(parts):
        p = parts[n]; p[..., 3] = np.where(p[..., 3] > 110, 255, 0)
        if n.endswith('R') and n[:-1] in ('uarm', 'farm', 'thigh', 'shin', 'foot'): parts[n] = relight_near(p)
    if skirt is not None:
        b = parts['body']; top = a.skirt_top or int(rg['crotch']) - 4; row = np.where(b[top, :, 3] > 0)[0]
        sw = round(skirt.shape[1] * sc); sh_ = round(a.skirt_hem * H) - top
        sk = np.array(Image.fromarray(skirt).resize((sw, sh_), Image.LANCZOS)); sk[..., 3] = np.where(sk[..., 3] > 110, 255, 0)
        skx = np.where(sk[2, :, 3] > 0)[0]; x0 = round((row.min() + row.max()) / 2 - (skx.min() + skx.max()) / 2)
        far = np.zeros((H, W, 4), np.uint8); y1 = min(H, top + sh_); xs = slice(max(0, x0), min(W, x0 + sw))
        far[top:y1, xs] = sk[:y1 - top, xs.start - x0:xs.stop - x0]
        near = far.copy(); cut = x0 + round(a.skirt_split * sw); near[:, :cut] = 0
        parts['thighL'], parts['thighR'] = far, near; print('skirt', [x0, top, sw, sh_], 'split at', cut)
    # the head on the world's grid: the small reference's, one cell per art pixel, chin on the collar (the drawn head's rows cleared
    # first), or the drawn head voted onto the grid as the scene would
    parts['body_menu'] = parts['body'].copy()   # the drawn head, for the menu's arch (×3.2 on the smooth HUD, no world grid)
    fig = small_figure(a.small); hr = head_rows(fig); b = parts['body']; ys, xs = np.where(b[..., 3] > 0); top = ys.min()
    col = a.neck or collar_row(b); hx = xs[ys < col]; mid = (hx.min() + hx.max()) / 2; best = None
    if a.head == 'small':
        oy = round(col / C) - hr + a.head_dy
        fx = np.where(fig[:hr, :, 3].any(0))[0]; ox = round(mid / C - (fx.min() + fx.max() + 1) / 2) + a.head_dx
        b[:round((oy + hr) * C)] = 0; cell_paint(b, fig, hr, ox, oy, C)
        fh = fig[:hr].astype(int); lum = fh[..., :3] @ np.array([0.3, 0.55, 0.15]); skin = (fh[..., 0] > 120) & (fh[..., 3] > 0)
        for y in [y for y in range(hr) if skin[y].any()]:
            for x in range(fh.shape[1]):
                if fh[y, x, 3] and not skin[y, x] and x > 0 and (skin[y, :x].any() and skin[y, x + 1:].any()):
                    if best is None or lum[y, x] < best[0]: best = (lum[y, x], x, y)
    else:
        nyc = int(np.ceil(col / C)); g = vote(b[:round(nyc * C)], C); b[:round(nyc * C)] = 0; cell_paint(b, g, nyc, 0, 0, C); ox = oy = 0
    neck = int(col)
    eye = [ox + best[1] + 0.5, oy + best[2] + 0.5] if best else None
    for n, p in parts.items(): save(p, os.path.join(a.out, f'{a.rig}__{n}.png'))
    R[a.rig] = rg; open(rigs_path, 'w').write('window.RIGS = ' + json.dumps(R) + ';\n')
    order = ['cape', 'thighL', 'shinL', 'footL', 'uarmL', 'farmL', 'thighR', 'shinR', 'footR', 'body', 'uarmR', 'farmR']
    if skirt is not None: order = ['cape', 'shinL', 'footL', 'thighL', 'uarmL', 'farmL', 'shinR', 'footR', 'thighR', 'body', 'uarmR', 'farmR']
    whole = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n in order: whole.alpha_composite(Image.fromarray(parts[n].astype(np.uint8)))
    whole.save(os.path.join(a.out, f'{a.rig}.png'))
    pv = Image.new('RGBA', (W * 2, H * 2), (70, 70, 80, 255)); pv.alpha_composite(whole.resize((W * 2, H * 2), Image.NEAREST)); pv.save(os.path.join(a.out, 'preview.png'))
    menu = Image.new('RGBA', (W, H), (70, 70, 80, 255))
    for n in order: menu.alpha_composite(Image.fromarray(parts['body_menu' if n == 'body' else n].astype(np.uint8)))
    menu.save(os.path.join(a.out, 'preview_menu.png'))
    g = vote(np.array(whole), C); gi = Image.new('RGBA', (g.shape[1], g.shape[0]), (70, 70, 80, 255)); gi.alpha_composite(Image.fromarray(g))
    gi.resize((g.shape[1] * 8, g.shape[0] * 8), Image.NEAREST).save(os.path.join(a.out, 'grid42_x8.png'))
    print(json.dumps({'w': W, 'pad': pad, 'scale': round(sc, 4), 'cape': [cx, cy, cw, ch], 'head_rows': hr, 'neck': neck, 'eye': eye,
                      'sh': [rg['shL'], rg['shR']], 'hip': [rg['hipL'], rg['hipR']], 'hand': [rg['handL'], rg['handR']]}))

def back():
    """the back view on the rig canvas: as wide across the pauldrons as the front's two pauldrons (the outer edges of uarmL and
    uarmR), the head's top on the front head's top, centred on the shoulders' midpoint. The cape keeps its painted mid-thigh hem
    (TASKS 2011: drawn over the legs, any longer hid the stride). No face, so the head is left to the scene's own snap"""
    R = read_rigs(); rg = R[a.rig]; W, H = rg['w'], rg['h']; C = H / GRID
    fy, _ = np.where(load(os.path.join(a.out, f'{a.rig}__body.png'))[..., 3] > 110)
    ul = np.where(load(os.path.join(a.out, f'{a.rig}__uarmL.png'))[..., 3] > 110)[1].min(); ur = np.where(load(os.path.join(a.out, f'{a.rig}__uarmR.png'))[..., 3] > 110)[1].max()
    im = Image.open(a.sheet).convert('RGBA'); arr = np.array(im); lab, keep = blobs(arr, 1); m = lab == keep[0]; arr[~m] = 0
    ys, xs = np.where(m); arr = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h0 = arr.shape[0]; band = range(int(0.1 * h0), int(0.4 * h0)); wrow = max(band, key=lambda y: np.ptp(np.where(m[y])[0]) if m[y].any() else 0)
    row = np.where(m[wrow])[0]; mid = (row.min() + row.max()) / 2; S_ = (ur - ul + 1) / (row.max() - row.min() + 1) * a.back_k
    small = np.array(Image.fromarray(arr).resize((round(arr.shape[1] * S_), round(h0 * S_)), Image.LANCZOS))
    ox = round((rg['shL'][0] + rg['shR'][0]) / 2 - mid * S_) + a.back_dx; oy = fy.min() + a.head_dy
    out = np.zeros((H, W, 4), np.uint8); sh, sw = small.shape[:2]
    y1, x1 = min(H, oy + sh), min(W, ox + sw); out[oy:y1, max(0, ox):x1] = small[:y1 - oy, max(0, -ox):x1 - ox]
    out[..., 3] = np.where(out[..., 3] > 110, 255, 0)
    save(out, os.path.join(a.out, f'{a.rig}__body_back.png'))
    pv = Image.new('RGBA', (W * 2, H), (70, 70, 80, 255)); fr = Image.open(os.path.join(a.out, 'preview_menu.png')).convert('RGBA'); pv.paste(fr, (0, 0))
    bk = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n in ('thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'uarmL', 'farmL', 'uarmR', 'farmR'): bk.alpha_composite(Image.open(os.path.join(a.out, f'{a.rig}__{n}.png')))
    bk.alpha_composite(Image.fromarray(out)); pv.alpha_composite(bk, (W, 0)); pv.resize((W * 4, H * 2), Image.NEAREST).save(os.path.join(a.out, 'preview_back.png'))
    print(json.dumps({'back_scale': round(S_, 4), 'at': [int(ox), int(oy)], 'hem': int(np.where(out[..., 3] > 0)[0].max())}))

def quiver():
    R = read_rigs(); rg = R[a.rig]; W, H = rg['w'], rg['h']; ic = Image.open(a.sheet).convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT)
    ic = ic.crop(ic.getbbox()); qh = round(a.q_h * H); qw = round(ic.width * qh / ic.height); q = np.array(ic.resize((qw, qh), Image.LANCZOS))
    q[..., 3] = np.where(q[..., 3] > 110, 255, 0); fx, fy = (float(v) for v in a.q_at.split(','))
    x0, y0 = round(rg['shL'][0] + fx * qw), round(rg['top'][1] + fy * H); out = np.zeros((H, W, 4), np.uint8)
    xs, ys = slice(max(0, x0), min(W, x0 + qw)), slice(max(0, y0), min(H, y0 + qh)); out[ys, xs] = q[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0]
    save(out, os.path.join(a.out, f'{a.rig}__quiver.png'))
    order = ['cape', 'quiver', 'thighL', 'shinL', 'footL', 'uarmL', 'farmL', 'thighR', 'shinR', 'footR', 'body', 'uarmR', 'farmR']
    for nm_, body in (('preview_quiver.png', 'body'), ('preview_quiver_menu.png', 'body_menu')):
        pv = Image.new('RGBA', (W, H), (70, 70, 80, 255))
        for n in order: pv.alpha_composite(Image.open(os.path.join(a.out, f'{a.rig}__{body if n == "body" else n}.png')).convert('RGBA'))
        pv.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(a.out, nm_))
    print(json.dumps({'quiver': [x0, y0, qw, qh]}))

def install():
    src = a.sheet
    for f in sorted(glob.glob(os.path.join(src, f'{a.rig}__*.png'))):
        n = os.path.basename(f)[:-4]; g = f'art/gen/{n}.png'
        if os.path.exists(g) and not os.path.exists(f'art/old/{n}-{a.tag}.png'): shutil.copy(g, f'art/old/{n}-{a.tag}.png')
        shutil.copy(f, g); print('installed', n)
    if a.rigs:
        cut = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(a.rigs).read().strip()))[a.rig]; R = read_rigs(); R[a.rig] = cut
        open(rigs_path, 'w').write('window.RIGS = ' + json.dumps(R) + ';\n'); print(f'RIGS.{a.rig} → {rigs_path}')

{'front': front, 'back': back, 'quiver': quiver, 'install': install}[a.mode]()
