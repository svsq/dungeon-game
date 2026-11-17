#!/usr/bin/env python3
"""TASKS 2163, 2164, 2165 (1), 2170 for the mage (second pass of the character critics, round 2).
  heads   2163: the back of the head grey again (body_back, body_back_le: the 2155 cells of the head mapped by lightness onto the
          front head's hair tones), the leather helm's brass band dark bronze along the dome's rim only (no rib over the dome, a one
          cell nasal), the circlet a bronze row with its stone over the grey hair
  arms    2164 (1), 2165 (1), 2170: the arms shortened (upper arm and forearm rows taken out, fist and cuff kept), a closed fist on
          the near forearm (four curled fingers stacked across the shaft, the thumb over them), the far hand's fingertips as their own
          layer for the orb resting in that palm; then the 2155 grid step and the 2167 shoulder cap for the mage's torsos
  rig     the mage's elbows and hands in live/rigs.js moved with the cut rows
Every source is the drawn one before this step (art/old/<name>-20261117-2170.png, kept on the first run), so a run can be repeated.
OUT=<dir> writes there instead of art/gen (a dry run for frames)."""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); os.chdir(ROOT); sys.path.insert(0, 'tools')
import gridify_2155 as G
import fix_2167 as F

TAG = '20261117-2170'
OUT = os.environ.get('OUT') or 'art/gen'
CELL = 360 / 42
PTS = 'frames/fix_mage_2170/arm_points.json'
load = lambda p: np.array(Image.open(p).convert('RGBA'))

def keep(n, src=None):
    """the drawn source of a part before this step, saved once"""
    old = f'art/old/{n}-{TAG}.png'
    if not os.path.exists(old): shutil.copyfile(src or f'art/gen/{n}.png', old)
    return load(old)

def save(n, a):
    os.makedirs(OUT, exist_ok=True); Image.fromarray(a).save(f'{OUT}/{n}.png')

def lab_rgb(L, A, B):
    return np.round(G.srgb(np.array([L, A, B]) / 100)).astype(np.uint8)

def cells(a, rows, cols, fn):
    """fn(row, col, rgb) → new rgb or None, applied to whole cells of the 42-row grid"""
    out = a.copy()
    for r in rows:
        for c in cols:
            y0, y1, x0, x1 = int(round(r * CELL)), int(round((r + 1) * CELL)), int(round(c * CELL)), int(round((c + 1) * CELL))
            blk = out[y0:y1, x0:x1]; op = blk[..., 3] >= 128
            if not op.any(): continue
            v = fn(r, c, blk[..., :3][op].astype(float).mean(0))
            if v is not None: blk[..., :3][op] = v
    return out

# ---------------- 2163 ----------------
HAIR_ROWS = range(0, 8)
DARKER = 0.06                # the back head shows less of its dark outline than the front: one tone down keeps the two caps alike
def hair_tones():
    """the front world head's hair cells (grey, a few blue-grey): OKLab of each distinct tone"""
    a = load('art/gen/mage__body.png'); seen = {}
    def fn(r, c, rgb):
        lab = G.oklab(rgb[None])[0]
        if np.hypot(lab[1], lab[2]) < 0.05: seen[tuple(np.round(lab, 3))] = lab
    cells(a, range(0, 4), range(0, 19), fn)
    return np.array(list(seen.values()))

def back_hair(n, tones):
    """the head cells of a back view (above the collar) recoloured by lightness to the front's hair; warm cells (collar, ear) kept"""
    src = keep(n)
    def fn(r, c, rgb):
        lab = G.oklab(rgb[None])[0]
        if np.hypot(lab[1], lab[2]) > 0.1: return None
        t = tones[np.abs(tones[:, 0] - lab[0] + DARKER).argmin()]
        return np.round(G.srgb(t)).astype(np.uint8)
    return cells(src, HAIR_ROWS, range(0, 19), fn)

BRONZE, RIVET, RIB = (45, 3, 9), (52, 3, 11), (36, 4, 6)
def helm_le():
    """the world leather helm: the band along the dome's rim in dark bronze (row 4), its two rivets a step lighter, the rib over the
    dome in the dome's own darker leather, one bronze cell of nasal over the nose's root"""
    src = keep('mage__head_le')
    def fn(r, c, rgb):
        L = G.oklab(rgb[None])[0][0]
        if r in (1, 2, 3) and L > 0.6: return lab_rgb(*RIB)
        if r == 4 and L > 0.6: return lab_rgb(*(RIVET if L > 0.8 else BRONZE))
        if r == 5 and c == 11: return lab_rgb(*BRONZE)
        return None
    return cells(src, range(0, 6), range(0, 19), fn)

CIRCLET, GEM = (55, 3, 14), None
def circlet():
    """the world circlet: its row over the grey hair in bronze-gold, darker and yellower than the skin it read as; the stone kept"""
    src = keep('mage__head_ci')
    def fn(r, c, rgb):
        lab = G.oklab(rgb[None])[0]
        if r == 3 and lab[0] > 0.55 and lab[2] > 0.05: return lab_rgb(*CIRCLET)
        return None
    return cells(src, [3], range(0, 19), fn)

def heads():
    tones = hair_tones(); names = []
    for n in ('mage__body_back', 'mage__body_back_le'):
        save(n, back_hair(n, tones)); names.append(n)
    save('mage__head_le', helm_le()); save('mage__head_ci', circlet()); names += ['mage__head_le', 'mage__head_ci']
    print('python3 tools/prep.py --only ' + ','.join(names))

# ---------------- 2164 (1), 2165 (1), 2170 ----------------
RIG = 'mage'
CUT_U = 18                  # rows out of the upper arm (71 → 53 px, 0.15 H as on mage_a_v4)
CUT_F = ((1, 23, 14), (33, 46, 6))   # forearm bands below the elbow (sleeve, wraps) and the rows each loses: 73 → 53 px with the cuff and
                            # the hand whole; the hand then hangs 0.46 H over the soles, the shoulder to hand 0.30 H (refs 0.29–0.32)
FIST = (20, 22)             # the closed fist, canvas px wide and tall, its top at the wrist
UARMS = ['uarmL', 'uarmR', 'uarmL_le', 'uarmR_le', 'uarmL_hd', 'uarmR_hd']
CLASP = ((101, 102), 9, 28)  # the arch robe's round clasp, its radius, and how far right its twin goes at the end of the bar (mage_a_v4)

def rigs():
    return json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))

def drawn_src(n):
    """the part as drawn, before the 2155 grid and before this step"""
    old = f'art/old/{n}-{TAG}.png'
    if os.path.exists(old): return load(old)
    a = load(f'art/old/{n}-20261117-2155.png'); Image.fromarray(a).save(old); return a

def cut_rows(a, bands):
    """delete rows: bands of (y0, y1, k), k rows spread evenly inside [y0, y1); the rows below move up"""
    gone = set()
    for y0, y1, k in bands:
        gone |= set(np.round(np.linspace(y0, y1 - 1, k)).astype(int).tolist())
    keep_rows = [y for y in range(a.shape[0]) if y not in gone]
    out = np.zeros_like(a); out[:len(keep_rows)] = a[keep_rows]; return out

def shift_up(a, k):
    out = np.zeros_like(a); out[:a.shape[0] - k] = a[k:]; return out

def skin_ramp(hand):
    op = hand[..., 3] >= 128; px = hand[..., :3][op].astype(float); lum = px @ [0.3, 0.59, 0.11]
    warm = px[(px[:, 0] - px[:, 2] > 60) & (lum > 70)]; wl = warm @ [0.3, 0.59, 0.11]; o = np.argsort(wl)
    pick = lambda q: warm[o[int(q * (len(o) - 1))]].astype(np.uint8)
    dark = px[lum < 60]; ink = np.median(dark, 0).astype(np.uint8) if len(dark) else px[lum.argmin()].astype(np.uint8)
    return pick(0.92), pick(0.65), pick(0.35), pick(0.08), ink

def fist(a, cx, top):
    """a closed fist round a shaft upright through it, seen from its knuckles' side: the back of the hand under the wrist, four
    curled fingers stacked down the shaft with their knuckles bulging forward, the thumb laid across the top one, palm to the body.
    The open hand below the wrist goes; returns the canvas and the fist's centre"""
    hi, mid, sh, deep, ink = skin_ramp(a[top - 30:]); out = a.copy(); out[top:] = 0
    W, H = FIST; x0, y0 = int(round(cx - W / 2)), top - 1
    BACK, FING = 6, 4
    # the outline: rounded at the back (body side, left), each finger's knuckle a bump on the forward side (right)
    right = [W - 3 if y < 2 else W - 2 for y in range(H)]
    for y in range(BACK, H):
        f = (y - BACK) % FING
        right[y] = W - (2 if f in (0, 3) else 1)
    left = [2 if y < 2 or y > H - 3 else 1 if y < 4 or y > H - 5 else 0 for y in range(H)]
    body = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(left[y], right[y] + 1):
            edge = x in (left[y], right[y]) or y in (0, H - 1) or x < left[y - 1] or x > right[y - 1] or (y + 1 < H and (x < left[y + 1] or x > right[y + 1]))
            if edge: c = ink
            elif y < BACK: c = hi if x < W * 0.45 and y < 3 else mid if y < BACK - 1 else sh
            else:
                f = (y - BACK) % FING; tip = x > W - 6
                c = deep if f == FING - 1 and x > W * 0.4 else (hi if f == 0 and not tip else sh if f == FING - 2 or tip else mid)
            body[y, x] = [*c, 255]
    for k, y in enumerate(range(BACK - 1, BACK + 3)):
        for x in range(1 + k * 2, 6 + k * 2):
            if left[y] < x < right[y]: body[y, x, :3] = hi if x < 4 + k * 2 else mid
    view = out[y0:y0 + H, x0:x0 + W]; sel = body[..., 3] > 0; view[sel] = body[sel]
    return out, (x0 + W / 2, y0 + H / 2)

def tips(a, hx, hy):
    """the far hand's curled fingers alone (the hand's px on the body's side of its centre, below the palm): drawn over the orb's
    lower edge when the palm is turned up under it"""
    out = np.zeros_like(a); ys, xs = np.mgrid[:a.shape[0], :a.shape[1]]
    sel = (a[..., 3] > 0) & (xs > hx + 2) & (ys > hy - 6); out[sel] = a[sel]; return out

def clasp(a):
    (cx, cy), r, dx = CLASP; out = a.copy(); ys, xs = np.mgrid[-r:r + 1, -r:r + 1]
    for y, x in zip(ys.ravel(), xs.ravel()):
        if x * x + y * y <= r * r and a[cy + y, cx + x, 3] > 0: out[cy + y, cx + x + dx] = a[cy + y, cx + x]
    return out

def arms():
    R = rigs()[RIG]; done = []; real = OUT == 'art/gen'; parts = {}
    for side in 'LR':
        sh, el, hd = R['sh' + side], R['elbow' + side], R['hand' + side]
        for n in [u for u in UARMS if u[4] == side]:
            parts[n] = cut_rows(drawn_src(f'{RIG}__{n}'), [(int(sh[1] + 12), int(el[1] - 9), CUT_U)])
        f = shift_up(drawn_src(f'{RIG}__farm{side}'), CUT_U)
        e = el[1] - CUT_U; f = cut_rows(f, [(int(e + y0), int(e + y1), k) for y0, y1, k in CUT_F])
        lost = CUT_U + sum(k for *_, k in CUT_F); wrist = int(round(e + CUT_F[1][1] - sum(k for *_, k in CUT_F)))
        if side == 'R': f, c = fist(f, hd[0], wrist); R['handR'] = [hd[0], c[1]]
        else:
            R['handL'] = [hd[0], hd[1] - lost]; parts['farmL_tips'] = tips(f, *R['handL'])
        R['elbow' + side] = [el[0], el[1] - CUT_U]; parts['farm' + side] = f
    for n, a in parts.items():
        name = f'{RIG}__{n}'; save(name + '_menu', a); save(name, G.gridify(a)[0] if 'tips' not in n else a); done += [name, name + '_menu']
        if real and 'tips' not in n: Image.fromarray(a).save(f'art/old/{name}-20261117-2155.png')
    # the torsos: the arch robe's clasp gets its twin, then the 2167 shoulder cap is laid again with the shorter far arm
    src = lambda n: f'{OUT}/{n}_menu.png'
    for b in F.BODIES[RIG]:
        n = f'{RIG}__{b}'; arm = [f'{RIG}__{p}L' + (b[4:].replace('_nh', '') if os.path.exists(f'art/gen/{RIG}__{p}L{b[4:].replace("_nh", "")}.png') else '') for p in ('uarm', 'farm')]
        world0, menu0 = load(f'art/old/{n}_drawn-20261117-2167.png'), load(f'art/old/{n}_menu-20261117-2167.png')
        if b in ('body', 'body_nh'): menu0 = clasp(menu0)
        world, _ = F.cap(world0, F.arm_at_rest(arm, False, src), R); menu, _ = F.cap(menu0, F.arm_at_rest(arm, True, src), R)
        grid = G.gridify(world)[0]; grid, _ = F.cap(grid, F.arm_at_rest(arm, False, lambda m: f'{OUT}/{m}.png'), R)
        save(n, grid); save(n + '_menu', menu); done += [n, n + '_menu']
        if real: Image.fromarray(world).save(f'art/old/{n}-20261117-2155.png')
    json.dump({k: R[k] for k in ('elbowL', 'elbowR', 'handL', 'handR')}, open(PTS, 'w'))
    print('python3 tools/prep.py --only ' + ','.join(done))

def rig():
    """the mage's elbows and hands in live/rigs.js, as arms wrote them"""
    pts = json.load(open(PTS)); s = open('live/rigs.js').read()
    i = s.index('"mage": {'); j = s.index('"parts"', i); seg = s[i:j]
    for k, v in pts.items(): seg = re.sub(rf'"{k}": \[[^\]]*\]', f'"{k}": [{v[0]}, {v[1]}]', seg, count=1)
    open('live/rigs.js', 'w').write(s[:i] + seg + s[j:]); print('rigs.js mage', pts)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'heads': heads()
    elif cmd == 'arms': arms()
    elif cmd == 'rig': rig()
    else: print(__doc__)
