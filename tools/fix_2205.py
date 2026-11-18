#!/usr/bin/env python3
"""TASKS 2205 (2): the mage's torso side under the near arm, by the recipe of tools/fix_2203.py (read its docstring).

tools/fix_2194.py drew that side as one flat tone of the robe (STRIP, 40/54/103; the hood outfit 38/50/95) from the silhouette to the
robe's lit cloth, from the shoulder to the hip, and carried the belt on to it as one flat colour per row. In the arch heroShoulderCheck's
flat measure found 4.9-13 world px² of it at rest (57 % of the strip's px sit in a flat 3×3 against 0.9 % of the rest of the torso);
mage_a_v4 draws robe folds there up to the sleeve. Here, per row of every mage body (robe, leather, cloak; with and without a head;
the arch's _menu and the world copy), over the px 2194 drew (the strip's tone or the belt's rows, changed against its source
art/old/<name>-20261118-2194.png):
  * shadow: from the silhouette to VIS px past where the near arm lies in every pose of the rest of both holds (the staff's hanging
    arm, fix_2191.reach, and the orb's raised one, foot.cjs <name>_o: below its elbow the side is open, there only the outline), a
    dark tone of the strip at SHADOW_L, then one outline px at INK_L;
  * the rest up to the robe is the robe itself mirrored about the strip's end every MIRROR px (fix_2203: SIDE darker, the axis TURN
    darker, highlights over HIGH_L taken from a neighbour, above the belt nothing darker than LIFT_L), so its folds run on to the arm;
  * the rows under the belt (the pouch's: mirrored, the pouch would read twice) take the side's own rows just over the belt again,
    every PY rows, so the folds run on down under the hand.
The world copy: the grid-42 cells this touches vote again (fix_2191.revote) on the arch's px scaled to the world robe's lightness
(fix_2194: SIDE_K of it, nothing under WORLD_INK). Sources kept once as art/old/<name>-20261119-2205.png; after fix_2194.py run or
gridify_2155.py run over these bodies, run this again with --fresh.
  python3 tools/fix_2205.py run        (then the printed prep line; DRY=<dir> writes the canvases there, art/ untouched)
  --rig R: a mage look (mage_b, mage_c), its OUTFITS rows from art/look_params.json under fix_2205; --fresh: the frozen copies made again"""
import os, shutil, sys, tempfile, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_2191 as F
import fix_2203 as S
import numpy as np
import rigarg

TAG, SRC_TAG, SCRIPT, RIG, FRESH = '20261119-2205', '20261118-2194', 'fix_2205', 'mage', False
BODIES = ['body', 'body_nh', 'body_le', 'body_le_nh', 'body_hd', 'body_hd_nh']
OUTFITS = {'': dict(strip=(40, 54, 103), top=89, belt=(160, 171)), 'le': dict(strip=(40, 54, 103), top=108, belt=(160, 171)),
           'hd': dict(strip=(38, 50, 95), top=112, belt=(160, 171))}
# LEFT: the near side only; GAP: mask px of a row up to GAP apart are one strip; PY: the rows over the belt repeated under it; BLUE: over
# the belt a mirrored px whose blue is not BLUE over its red (the gold cord, the clasp) takes the nearest robe px of the row (a row
# with none, by the clasp, takes the row over it one px further in)
VIS, SHADOW_L, INK_L, SIDE, TURN, MIRROR, HIGH_L, LIFT_L, LIFT_UP, LEFT, GAP, PY, BLUE = 1, 11, 5, 0.88, 0.7, 24, 20, 21, 4, 100, 2, 10, 20
# WORLD_LUMA: a new blue px of the world lighter than this takes the nearest world tone under it (heroHoodCheck holds the world robe's
# blue at mean luminance 52; the cells voted on the folds went to 40/51/93, 52.3, and the robe to 52.2). A world cell is 8.6 px of the
# canvas, wider than a fold: the world's side stays one tone with the shadow at the arm
SIDE_K, WORLD_INK, WORLD_LUMA = 0.8, 22.5, 52
NOWHERE = np.array([999.0, 0, 0])


def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if F.DRY: return F.load(old if os.path.exists(old) and not FRESH else f'art/gen/{n}.png')
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return F.load(old)


def outfit_of(rig, sfx):
    own = rigarg.param(rig, SCRIPT, 'OUTFITS', {}) if rig != RIG else {}
    return dict(OUTFITS[sfx], **own.get(sfx, {}))


def lim_of(feet, rig, sfx):
    """per row the tighter of the staff's arm (fix_2191.reach) and the orb's upper arm in every moment of the rest; -1 where the
    orb's arm leaves the side open"""
    staff = F.reach(feet, rig, sfx); orb = None
    for k in (f'{rig}__body_menu_o', f'{rig}__body_o'):
        m = F.load(os.path.join(feet, k + '.png'))[..., 0] > 127
        r = np.array([np.nonzero(row)[0].max() if row.any() else -1 for row in m])
        orb = r if orb is None else np.where((orb < 0) | (r < 0), -1, np.minimum(orb, r))
    return np.where((staff < 0) | (orb < 0), -1, np.minimum(staff, orb))


def side(a, src, lim, O, donor=None):
    out = a.copy(); op = a[..., 3] > 127; b0, b1 = O['belt']
    blue = a[..., 2].astype(int) > a[..., 0].astype(int) + BLUE
    mask = (a != src).any(-1) & op & ((a[..., :3] == O['strip']).all(-1) | blue | (np.arange(a.shape[0])[:, None] >= b0 - 1) & (np.arange(a.shape[0])[:, None] <= b1))
    mask[:, LEFT:] = False; mask[:O['top']] = False
    shadow, ink = F.dim(O['strip'], SHADOW_L), F.dim(O['strip'], INK_L); spans = {}
    for y in range(a.shape[0]):
        xs = np.nonzero(mask[y])[0]
        if not len(xs): continue
        T, end = xs[0], xs[0] + 1
        for x in xs[1:]:
            if x - end > GAP: break
            end = x + 1
        edge = T == np.nonzero(op[y])[0][0]
        g = max(T, min(lim[y] + 1 + VIS, end - 1)) if lim[y] >= 0 else T if edge else T - 1
        if g > T: out[y, T:g, :3] = shadow
        if g >= T: out[y, g, :3] = ink
        spans[y] = (g + 1, end)
        if y > b1 or g + 1 >= end: continue
        xr = np.arange(g + 1, end)
        xr = xr[mask[y, xr]]
        if donor is not None and y < b0 - 1: out[y, xr, :3] = donor[y, xr, :3]; continue
        if not len(xr): continue
        sx = end + (end - 1 - xr) % MIRROR; col = S.scale_l(a[y, sx, :3], SIDE)
        blue = col[:, 2].astype(int) > col[:, 0].astype(int) + BLUE; nb = np.nonzero(blue)[0]
        if not len(nb) and y < b0 - 1:
            up = out[y - 1, np.minimum(xr + 1, a.shape[1] - 1), :3]
            ok = up[:, 2].astype(int) > up[:, 0].astype(int) + BLUE; out[y, xr[ok], :3] = up[ok]; continue
        if y < b0 - 1:
            for i in np.nonzero(~blue)[0]: col[i] = col[nb[np.abs(nb - i).argmin()]]
        Lc = F.lstar(col); hi = Lc > np.median(Lc) + HIGH_L; lo = np.nonzero(~hi)[0]
        if len(lo):
            for i in np.nonzero(hi)[0]: col[i] = col[lo[np.abs(lo - i).argmin()]]
        if xr[-1] == end - 1: col[-1] = S.scale_l(a[y, end, :3][None], TURN)[0]
        L = F.lstar(col); lit = np.nonzero(L >= LIFT_L)[0]
        if y < b0 - 1:
            up = out[y - 1, xr, :3]; upL = F.lstar(up)
            for i in np.nonzero(L < LIFT_L)[0]:
                c = up[i] if upL[i] >= LIFT_L else col[lit[np.abs(lit - i).argmin()]] if len(lit) else None
                if c is not None: col[i] = F.dim(c, LIFT_L + LIFT_UP)
        out[y, xr, :3] = col
    for y, (x0, end) in spans.items():
        if y <= b1: continue
        for x in range(x0, end):
            if not mask[y, x]: continue
            sy = b0 - 2 - (y - b1 - 1) % PY
            row = np.nonzero(mask[sy] & (np.arange(a.shape[1]) >= spans.get(sy, (0, 0))[0]))[0]
            if len(row): out[y, x, :3] = out[sy, row[np.abs(row - x).argmin()], :3]
    stray = mask & (out == a).all(-1)
    for y, x in zip(*np.nonzero(stray)):
        nb = [out[y + dy, x + dx, :3] for dy, dx in ((0, 1), (0, -1), (-1, 0), (1, 0)) if op[y + dy, x + dx] and not stray[y + dy, x + dx]]
        if nb: out[y, x, :3] = nb[0]
    return out, int((out != a).any(-1).sum())


def tone(a, strip):
    """the robe body's side as the donor of the other outfits': its blue px kept, each other px of a row the row's nearest blue"""
    out = a.copy()
    for y in range(a.shape[0]):
        blue = (a[y, :, 2].astype(int) > a[y, :, 0].astype(int) + BLUE) & (a[y, :, 3] > 127); nb = np.nonzero(blue)[0]
        if len(nb):
            for x in np.nonzero(~blue)[0]: out[y, x] = a[y, nb[np.abs(nb - x).argmin()]]
    return out


def revote(world, menu0, menu1, Y0, Y1):
    lum = lambda a: (a[..., 3] > 127) & (F.lstar(a[..., :3]) >= F.DARK)
    k = SIDE_K * F.lstar(world[..., :3])[lum(world)].mean() / F.lstar(menu0[..., :3])[lum(menu0)].mean()
    def sc(a):
        c = a[..., :3].astype(float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4); L = F.lstar(a[..., :3])
        Y = ((np.clip(np.maximum(L * k, np.minimum(L, WORLD_INK)), 0, 100) + 16) / 116) ** 3; Y0_ = np.maximum(c @ [0.2126, 0.7152, 0.0722], 1e-6)
        c = np.clip(c * (Y / Y0_)[..., None], 0, 1)
        return np.concatenate([np.round(np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255).astype(np.uint8), a[..., 3:]], -1)
    out = F.revote(world, sc(menu0), sc(menu1), Y0, Y1)
    luma = lambda c: c.astype(float) @ [0.3, 0.59, 0.11]
    band = (world[..., 3] > 127); band[:Y0 - 10] = False; band[Y1 + 10:] = False
    pal = np.unique(world[band][:, :3], axis=0); pal = pal[luma(pal) <= WORLD_LUMA]
    r, g, b = (out[..., i].astype(int) for i in range(3))
    hot = (out != world).any(-1) & (out[..., 3] > 127) & (b > r + 30) & (b > g + 10) & (luma(out[..., :3]) > WORLD_LUMA)
    if hot.any() and len(pal):
        k = np.linalg.norm(F.G.oklab(pal.astype(float))[None] - F.G.oklab(out[hot][:, :3].astype(float))[:, None], axis=-1).argmin(1); out[hot, :3] = pal[k]
    return out


def run(rigs):
    R = F.rigs(); names = []; feet = tempfile.mkdtemp(prefix='foot2205')
    subprocess.run(['node', 'tools/measure/shoulders2191/foot.cjs', feet] + ([','.join(rigs)] if rigs != [RIG] else []), check=True, stdout=subprocess.DEVNULL)
    for rig in rigs:
        bottom = int(R[rig]['hipL'][1]) + 8
        robe = {}
        for b in [b for b in BODIES if os.path.exists(f'art/gen/{rig}__{b}.png')]:
            n, sfx = f'{rig}__{b}', F.outfit(b); O = outfit_of(rig, sfx)
            m0, w0 = keep(n + '_menu'), keep(n); src = F.load(f'art/old/{n}_menu-{SRC_TAG}.png')
            m1, k = side(m0, src, lim_of(feet, rig, sfx), O, robe.get(b.endswith('_nh')) if sfx else None)
            if not sfx: robe[b.endswith('_nh')] = tone(m1, O['strip'])
            w1 = revote(w0, m0, m1, int(np.nonzero((m0 != m1).any(-1).any(1))[0].min()), bottom)
            F.save(m1, F.gen(n + '_menu')); F.save(w1, F.gen(n)); names += [n, n + '_menu']
            print(f'{n:22s} {k:4d} px of the near side repainted, world {int((w1 != w0).any(-1).sum()):4d} px')
    shutil.rmtree(feet)
    print('python3 tools/prep.py --only ' + ','.join(names))


if __name__ == '__main__':
    rigs, FRESH = rigarg.take(())
    rigs = rigs or [RIG]
    if any(rigarg.base(r) != 'mage' for r in rigs): sys.exit(f'mage rigs only, not {rigs}')
    {'run': lambda: run(rigs)}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
