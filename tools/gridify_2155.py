#!/usr/bin/env python3
"""TASKS 2155 (study/critique/chars_assets_r1.md finding 3): the hero's world parts repainted in flat cells of the world grid.

The scene snaps a hero part to the world grid (snapTex in live/lib.js: 4×4 samples per world pixel, the largest group of samples
within 0.13 RGB wins). A world pixel is a cell of RIGS.<rig>.h / 42 canvas px, anchored at the canvas origin (drawHero keeps the
near eye's cell on a world pixel, so the whole upright canvas lies on the grid). The new clothes are fine pixel art, about one
canvas px per detail, and each cell's vote picked one of several near-equal tones at random: the torso rippled. Here every cell
gets one colour the vote cannot get wrong:
  1. a cell already flat (the head painted from the small ref, its eye, the mage's beard) is kept as it is, and so is a face
     drawn at full size under a helm or a hood (FACE; the helms and the _hd bodies);
  2. any other cell takes the area mean of its opaque px in OKLab (the part downscaled to the grid), pushed a little away from
     its neighbours' mean (SHARP);
  3. the part's cells are reduced to PAL tones; each cell takes the tone nearest to it, unless its neighbours' tone costs less
     (SMOOTH), which keeps flat regions flat and a belt row a row;
  4. a cell still differing from 3 or 4 neighbours (the speckle the critic counts, tools/measure/chars_assets/speckle.py) is
     repainted by the smallest change that leaves no stray around it (see clean).
The alpha is not touched: the silhouette, the joints and the ink outline are as they were. The menu's arch (×3.2) shows a part
nearly 1:1, so every front part without a drawn _menu copy gets one, the source as drawn (drawHero's fine() picks it in the arch). The first run keeps each source in
art/old/<name>-20261117-2155.png and every later run starts from it, so the step can be tuned and run again.
  python3 tools/gridify_2155.py preview OUT.png <name…>    before/after on the world grid ×8, with the numbers
  python3 tools/gridify_2155.py run [<rig|name>…] [--rig R] [--fresh]   write art/gen (then tools/prep.py --only the printed names)
A rig or a part of a new look (hero_b, mage_c__body) is worked on when named (tools/rigarg.py); --fresh takes art/gen as the drawn
source again (a new cut) instead of the frozen 2155 copy."""
import glob, json, os, re, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigarg

ROWS = 42
TAG = '20261117-2155'
RIGS = ('hero', 'archer', 'mage')
PAL = 10                    # tones per part: k-means of its cells (below) in OKLab, so a tone is what a cell averages to, not a
                            # px colour a blend of steel and red would snap to
DIST = 10                   # cost of a tone by its OKLab distance from the cell
SMOOTH = 0.3                # cost of each neighbour of another tone: two tones a step apart do not alternate cell by cell
SHARP = 0.3                 # a cell pushed this far from its neighbours' mean: a belt or trim one cell wide keeps its contrast
DOM = 0.6                   # a cell whose largest group of like px covers this share is that group's colour, crisp (a face's skin, a
                            # plate's face); a cell with no such majority is its area mean
SKIN = (0.6, 0.86, 0.02, 0.13, 0.02, 0.14)   # OKLab L, a, b ranges of the heroes' skin
FACE = 0.25                 # a cell of the head rows with this share of skin is a face drawn at full size (under a helm or a hood):
FACE_ROWS = 14              # it is left to the shader's vote as before, which keeps a dark eye or brow that the cell mean melts
EQUAL = 0.04                # OKLab distance under which two tones count as one for SMOOTH
STRAY = 90                  # a neighbour differs at a summed |dRGB| above this (the critic's speckle threshold)
FLAT = 9                    # a cell whose opaque px all lie within this summed |dRGB| is already painted on the grid

def oklab(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = c @ np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]]).T
    l = np.cbrt(l)
    return l @ np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]]).T

def srgb(lab):
    l = lab @ np.array([[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]]).T
    l = l ** 3
    c = l @ np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]]).T
    c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255

def grid(h, w):
    C = h / ROWS; W = int(np.ceil(w / C))
    cy = np.minimum(((np.arange(h) + 0.5) / C).astype(int), ROWS - 1); cx = np.minimum(((np.arange(w) + 0.5) / C).astype(int), W - 1)
    return C, W, cy, cx

def shown(a, C, W):
    """the cells the snap draws: the centre px opaque and at least half of the 16 samples"""
    h, w = a.shape[:2]; f = (np.arange(4) + 0.5) / 4; on = np.zeros((ROWS, W), bool)
    for y in range(ROWS):
        ys = np.clip(((y + f) * C).astype(int), 0, h - 1)
        for x in range(W):
            xs = np.clip(((x + f) * C).astype(int), 0, w - 1)
            on[y, x] = a[min(h - 1, int((y + 0.5) * C)), min(w - 1, int((x + 0.5) * C)), 3] >= 128 and (a[np.ix_(ys, xs)][..., 3] >= 128).sum() >= 8
    return on

N4 = ((0, 1), (0, -1), (1, 0), (-1, 0))
def shift(m, dy, dx, fill):
    o = np.full_like(m, fill); H, W = m.shape[:2]
    o[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = m[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]; return o

def kmeans(X, wt, k, it=25):
    q = np.quantile(X[:, 0], np.linspace(0.03, 0.97, k)); cen = np.array([X[np.argmin(np.abs(X[:, 0] - v))] for v in q])
    for _ in range(it):
        lab = ((X[:, None] - cen[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            m = lab == j
            if m.any(): cen[j] = (X[m] * wt[m, None]).sum(0) / wt[m].sum()
    return cen

def dominant(rgb, op, cid, m):
    """per cell, the largest group of its px within 0.13 RGB of one of them (the shader's vote over all px) and its share"""
    dom = np.zeros((m, 3)); share = np.zeros(m); ids = cid[op]; px = rgb[op] / 255.0
    order = np.argsort(ids, kind='stable'); ids, px = ids[order], px[order]; cuts = np.flatnonzero(np.diff(ids)) + 1
    for g, c in zip(np.split(ids, cuts), np.split(px, cuts)):
        if not len(g): continue
        if len(c) > 48: c = c[np.linspace(0, len(c) - 1, 48).astype(int)]
        d = np.linalg.norm(c[:, None] - c[None], axis=-1) <= 0.13; j = d.sum(1).argmax()
        dom[g[0]] = c[d[j]].mean(0) * 255; share[g[0]] = d[j].mean()
    return dom, share

def gridify(a, drawn_face=False):
    """a: RGBA uint8 canvas → (the same canvas with each cell's opaque px in one colour, cell colours, shown cells)"""
    h, w = a.shape[:2]; C, W, cy, cx = grid(h, w); op = a[..., 3] >= 128
    cid = (cy[:, None] * W + cx[None, :]); n = np.bincount(cid[op], minlength=ROWS * W).astype(float)
    rgb = a[..., :3].astype(float); lab = oklab(rgb)
    mean = np.stack([np.bincount(cid[op], lab[op][:, i], minlength=ROWS * W) for i in range(3)], -1) / np.maximum(n, 1)[:, None]
    lo = np.full((ROWS * W, 3), 999.0); hi = np.full((ROWS * W, 3), -999.0)
    np.minimum.at(lo, cid[op], rgb[op]); np.maximum.at(hi, cid[op], rgb[op])
    flat = ((hi - lo).sum(1) <= FLAT) & (n > 0)
    sk = op & (lab[..., 0] > SKIN[0]) & (lab[..., 0] < SKIN[1]) & (lab[..., 1] > SKIN[2]) & (lab[..., 1] < SKIN[3]) & (lab[..., 2] > SKIN[4]) & (lab[..., 2] < SKIN[5])
    face = (np.bincount(cid[sk], minlength=ROWS * W) >= FACE * np.maximum(n, 1)) & (np.arange(ROWS * W) // W < FACE_ROWS) & (n > 0)
    if drawn_face: flat |= face
    has = (n > 0).reshape(ROWS, W); fl = flat[cid]; mean = mean.reshape(ROWS, W, 3); on = shown(a, C, W)
    flat2 = flat.reshape(ROWS, W); free = has & ~flat2
    if free.sum() < PAL * 2: return a.copy(), mean, on
    ring = np.zeros_like(mean); k = np.zeros((ROWS, W))
    for dy, dx in N4:
        hm = shift(has, dy, dx, False); ring += shift(mean, dy, dx, 0) * hm[..., None]; k += hm
    soft = np.where((k > 0)[..., None], mean + SHARP * (mean - ring / np.maximum(k, 1)[..., None]), mean)
    dom, share = dominant(rgb, op, cid, ROWS * W)
    soft = np.where((share.reshape(ROWS, W) >= DOM)[..., None], oklab(dom).reshape(ROWS, W, 3), soft)
    pal = kmeans(soft[free], n.reshape(ROWS, W)[free], PAL)
    unary = DIST * np.sqrt(((soft[..., None, :] - pal) ** 2).sum(-1))
    flat = flat.reshape(ROWS, W)
    label = unary.argmin(-1); col = np.where(flat[..., None], mean, pal[label])
    free = has & ~flat
    for _ in range(8):
        changed = 0
        for y, x in zip(*np.where(free)):
            nb = [col[y + dy, x + dx] for dy, dx in N4 if 0 <= y + dy < ROWS and 0 <= x + dx < W and has[y + dy, x + dx]]
            if not nb: continue
            nb = np.array(nb); cost = unary[y, x] + SMOOTH * (np.sqrt(((pal[:, None] - nb[None]) ** 2).sum(-1)) > EQUAL).sum(1)
            j = cost.argmin()
            if j != label[y, x]: label[y, x] = j; col[y, x] = pal[j]; changed += 1
        if not changed: break
    cell = clean(col, on, flat)
    # the tones and the clean-up shift the part's mean a little (up to 7 ΔE on a small leg): the whole part is moved back onto it,
    # the steps between its cells unchanged, as 2152 and 2154 tuned those colours
    wt = (n.reshape(ROWS, W) * free)[..., None]
    cell = np.where(free[..., None], cell + ((mean - cell) * wt).sum((0, 1)) / max(1.0, wt.sum()), cell)
    out = a.copy(); paint = srgb(cell)[cy][:, cx]; keep = flat[cy][:, cx]
    out[..., :3] = np.where(keep[..., None], a[..., :3], np.round(paint)).astype(np.uint8)
    return out, cell, on

def clean(cell, on, fixed):
    """the stray cells (differing from 3–4 shown neighbours) repainted one at a time by the smallest change that leaves neither it
    nor any cell around it a stray: a neighbour's tone (the fleck joins its region), a tone between its own and a neighbour's (a
    line's end softened rather than eaten, which would leave the next cell the end), or, for a diagonal line, the corner between
    two of its cells in its tone (a stair). A cell no move clears is kept: it is a feature, not a fleck."""
    cell = cell.copy(); H, W = on.shape; rgb = srgb(cell)
    inside = lambda q: 0 <= q[0] < H and 0 <= q[1] < W and on[q]
    near = lambda p: [(p[0] + dy, p[1] + dx) for dy, dx in N4 if inside((p[0] + dy, p[1] + dx))]
    odd = lambda p: sum(np.abs(rgb[p] - rgb[q]).sum() > STRAY for q in near(p))
    for _ in range(12):
        moved = 0
        for p in zip(*np.where(on & ~fixed)):
            if odd(p) < 3: continue
            area = [(p[0] + dy, p[1] + dx) for dy in range(-2, 3) for dx in range(-2, 3) if inside((p[0] + dy, p[1] + dx))]
            before = {q: odd(q) >= 3 for q in area}
            moves = []
            for q in near(p):
                for t in (1.0, 0.5, 0.67, 0.33):
                    moves.append(((p, cell[p] + t * (cell[q] - cell[p])),))
            for dy in (-1, 1):
                for dx in (-1, 1):
                    d = (p[0] + dy, p[1] + dx)
                    if inside(d) and np.abs(rgb[p] - rgb[d]).sum() <= STRAY:
                        for b in ((p[0], d[1]), (d[0], p[1])):
                            if inside(b) and not fixed[b]: moves.append(((b, cell[p].copy()),))
            best = None
            for mv in moves:
                keep = [(c, cell[c].copy(), rgb[c].copy()) for c, _ in mv]
                for c, v in mv: cell[c] = v; rgb[c] = srgb(v)
                ok = all(not (odd(q) >= 3) or before[q] for q in area) and odd(p) < 3
                cost = sum(np.linalg.norm(v - k[1]) for (c, v), k in zip(mv, keep))
                for c, v0, r0 in keep: cell[c] = v0; rgb[c] = r0
                if ok and (best is None or cost < best[0]): best = (cost, mv)
            if best:
                for c, v in best[1]: cell[c] = v; rgb[c] = srgb(v)
                moved += 1
        if not moved: break
    return cell

def snapvote(a):
    """the shader's vote, as speckle.py does it: one RGBA (0..1) per world pixel"""
    h, w = a.shape[:2]; C = h / ROWS; W = int(np.ceil(w / C)); out = np.zeros((ROWS, W, 4)); f = (np.arange(4) + 0.5) / 4
    for y in range(ROWS):
        ys = np.clip(((y + f) * C).astype(int), 0, h - 1)
        for x in range(W):
            xs = np.clip(((x + f) * C).astype(int), 0, w - 1); s = a[np.ix_(ys, xs)].reshape(-1, 4) / 255.0; o = s[:, 3] >= 0.5
            if o.sum() < 8: continue
            c = s[o, :3]; d = np.linalg.norm(c[:, None] - c[None], axis=-1) <= 0.13; k = d.sum(1).argmax(); out[y, x, :3] = c[d[k]].mean(0); out[y, x, 3] = 1
    return out

def strays(v):
    op = v[..., 3] > 0; c = v[..., :3] * 255; cnt = np.zeros(op.shape, int)
    for dy, dx in N4: cnt += (np.abs(c - shift(c, dy, dx, 0)).sum(-1) > STRAY) & shift(op, dy, dx, False)
    return (cnt >= 3) & op

def speckle(v):
    op = v[..., 3] > 0; s = strays(v); lo = op.copy(); lo[:11] = False
    return s.sum() / max(1, op.sum()) * 100, (s & lo).sum() / max(1, lo.sum()) * 100

def meanlab(a):
    op = a[..., 3] >= 128; return oklab(a[..., :3][op].astype(float)).mean(0) * 100

drawn = lambda n: '__head_' in n or '_hd' in n
FRESH = False
src_of = lambda n: f'art/old/{n}-{TAG}.png' if os.path.exists(f'art/old/{n}-{TAG}.png') and not FRESH else f'art/gen/{n}.png'
load = lambda p: np.array(Image.open(p).convert('RGBA'))

def parts(sel):
    R = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
    out = []
    for rig in RIGS + tuple(dict.fromkeys(s.split('__')[0] for s in sel if s.split('__')[0] not in RIGS)):
        for p in sorted(glob.glob(f'art/gen/{rig}__*.png')):
            n = os.path.basename(p)[:-4]
            if n.endswith('_menu') or n.endswith('_w'): continue
            # the 188 px canvases are the old look's leftovers no outfit reaches (chars_assets_r1.md finding 4)
            if Image.open(p).size != (R[rig]['w'], R[rig]['h']): continue
            if sel and rig not in sel and n not in sel: continue
            out.append(n)
    return out

def tile(v, s=8):
    im = (np.clip(v, 0, 1) * 255).astype(np.uint8); al = im[..., 3:4] / 255.0
    comp = (im[..., :3] * al + 40 * (1 - al)).astype(np.uint8)
    return Image.fromarray(comp).resize((comp.shape[1] * s, comp.shape[0] * s), Image.NEAREST)

def preview(out, names):
    rows = []
    for n in names:
        a = load(src_of(n)); b = gridify(a, drawn(n))[0]; va, vb = snapvote(a), snapvote(b)
        sa, sb = speckle(va), speckle(vb); dl = np.linalg.norm(meanlab(b) - meanlab(a))
        print(f'{n:26s} speckle {sa[0]:5.1f} → {sb[0]:5.1f}  below head {sa[1]:5.1f} → {sb[1]:5.1f}  mean OKLab ×100 moved {dl:.2f}')
        o = Image.new('RGB', (a.shape[1], a.shape[0]), (40, 40, 40)); o.paste(Image.fromarray(a), (0, 0), Image.fromarray(a))
        m = vb.copy(); m[strays(vb)] = [1, 0, 1, 1]
        sw = o.resize((int(np.ceil(a.shape[1] * ROWS / a.shape[0])), ROWS), Image.BOX); sv = np.ones((ROWS, sw.width, 4)); sv[..., :3] = np.array(sw) / 255.0
        sv[..., 3] = va[..., 3]
        ts = [o.resize((o.width * 336 // a.shape[0], 336), Image.LANCZOS), tile(sv), tile(va), tile(vb), tile(m)]
        S = Image.new('RGB', (sum(t.width for t in ts) + 8, 336), (20, 20, 20)); x = 0
        for t in ts: S.paste(t, (x, 0)); x += t.width + 4
        rows.append(S)
    S = Image.new('RGB', (max(r.width for r in rows), 340 * len(rows)), (20, 20, 20))
    for i, r in enumerate(rows): S.paste(r, (0, i * 340))
    S.save(out)

def run(sel):
    done = []
    for n in parts(sel):
        old = f'art/old/{n}-{TAG}.png'
        if FRESH or not os.path.exists(old): Image.open(f'art/gen/{n}.png').save(old)
        a = load(old); b = gridify(a, drawn(n))[0]; Image.fromarray(b).save(f'art/gen/{n}.png')
        if '_back' not in n and not os.path.exists(f'art/gen/{n}_menu.png'):
            Image.open(old).save(f'art/gen/{n}_menu.png'); done.append(n + '_menu')
        sa, sb = speckle(snapvote(a)), speckle(snapvote(b))
        print(f'{n:26s} speckle below head {sa[1]:5.1f} → {sb[1]:5.1f}  mean OKLab ×100 moved {np.linalg.norm(meanlab(b) - meanlab(a)):.2f}')
        done.append(n)
    print('python3 tools/prep.py --only ' + ','.join(done))

if __name__ == '__main__':
    os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    rigs, FRESH = rigarg.take(())
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'preview': preview(sys.argv[2], sys.argv[3:])
    elif cmd == 'run': run(set(sys.argv[2:]) | set(rigs))
    else: print(__doc__)
