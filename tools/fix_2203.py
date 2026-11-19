#!/usr/bin/env python3
"""TASKS 2203 (critic round 5, items 8-10; the author's frames 34, 35): the near side of the warrior's and the archer's torso under the arm.

tools/fix_2191.py drew that side as STRIP: one flat tone of the cape's cloth (the warrior's red, the archer's olive) from under the arm
to the torso's content, 9-24 px wide. In the arch it read as the cape seen through a cut in the torso (frame 34: from the pauldron to
the hip), and its top beside the pauldron as the cut-out itself. The sheets (warrior_a_v2, archer_a) draw there the torso's own
material up to the sleeve with only a narrow dark gap (0.013 H, L* ~12) and an outline between.
Here, per row of every warrior and archer body (each outfit, with or without a head, the arch's _menu and the world copy), over the px
2191 changed (its source art/old/<name>-20261118-2191.png against art/gen):
  * shadow: from the strip's arm-side end to VIS px past where the near arm lies in every pose of the rest (fix_2191.reach), a dark
    tone of the outfit's own cloth at SHADOW_L, then one outline px at INK_L: at most VIS + 1 px of it ever shows;
  * the rest up to the torso's content is the content itself, mirrored about its edge and back again every MIRROR px (the plate, the
    jerkin, the belt, the tassets run on to the sleeve), SIDE darker (the side turning away) and the mirror's axis TURN darker still
    (the plate's turn, the jerkin's side seam); its px HIGH_L over the row's median lightness (the archer's dagger guard, a highlight)
    take the nearest other's tone; a px within RUST_DE of the class's cape cloth (the plate's rust) takes the row's nearest other
    content px; above the belt (to BELT_LIFT rows into it: its top outline) none is darker than LIFT_L (the plate's rim run on to the
    sleeve read as the 2191 seam: heroShoulderCheck's dark): such a px takes the lit px above it (else the row's nearest lit content
    px) at LIFT_L + LIFT_UP, so it stays steel or leather, not a dark red, and keeps the texture of the rows above, not a flat line;
  * the joint of the pauldron and the chest by the arm (notch()): its thick dark runs, the cut-out the author saw over the strip's
    top, keep a one-px outline and take the steel (the jerkin) under them;
  * the rows of a pouch (tile: rows y0..y1) take the cloth from under the pouch instead (rows Y0 + (y - Y0) mod PY, DX px further in):
    a pouch mirrored to the sleeve would read as a second pouch; the gambeson's diamonds and the tunic carry on behind it.
The world copy: the grid-42 cells this touches vote again (fix_2191.revote), above the belt snapped to the world's tones but those
within RUST_DE of the cape (the 2191 strip's red and olive are among them); a cell voted darker than LIFT_L whose new px are mostly
lit content takes the world tone nearest their mean (the vote of a cell over the gap and the plate's rim went to the outline). Sources kept once as art/old/<name>-20261119-2203.png
(the 2191 result) and each run starts from them; after fix_2191.py run or gridify_2155.py run over these bodies, run this again
with --fresh.
  python3 tools/fix_2203.py run        (then the printed prep line; DRY=<dir> writes the canvases there, art/ untouched)
  --rig R: a new look, its OUTFITS rows from art/look_params.json under fix_2203; --fresh: the frozen copies made again"""
import os, shutil, sys, tempfile, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_2191 as F
import numpy as np
import rigarg

TAG, SRC_TAG, SCRIPT = '20261119-2203', '20261118-2191', 'fix_2203'
RIGS, FRESH = None, False
BODIES = F.BODIES
# per outfit: the cloth the shadow is a dark tone of (the jerkin's brown, not the archer's olive mantle; the warrior's gambeson red
# darkened to the sheet's gap, Lab ~12/25/15), and the pouch rows (y0, y1, Y0, PY, DX) whose cloth comes from under the pouch
OUTFITS = {('hero', ''): dict(cloth=(110, 30, 22), tile=(152, 188, 189, 11, 11)),
           ('hero', 'pw'): dict(cloth=(110, 30, 22), tile=None),
           ('hero', 'cl'): dict(cloth=(105, 73, 55), tile=(152, 188, 186, 12, 26)),
           ('hero', 'hd'): dict(cloth=(95, 52, 41), tile=(152, 188, 189, 11, 11)),
           ('archer', ''): dict(cloth=(99, 56, 33), tile=None),
           ('archer', 'hd'): dict(cloth=(99, 56, 33), tile=None)}
# VIS: shadow px past the arm's tightest reach (with the outline px: the gap the sheets draw, 0.013 H ~ 4.7 px at most);
# SHADOW_L, INK_L: the gap's and the outline's lightness (the sheet's gap L* ~12, its outlines ~5); SIDE, TURN: the content's lightness
# share on the side and on the mirror's axis; LEFT: only px left of this column are the strip (the far side's are not touched)
VIS, SHADOW_L, INK_L, SIDE, TURN, LEFT, RUST_DE, LIFT_L, LIFT_UP, CLOTH_L, BELT_LIFT, MIRROR, HIGH_L = 1, 11, 5, 0.88, 0.7, 100, 11, 21, 4, 15, 3, 24, 20
# the notch (the critics' r5 «cut-out» under the pauldron, 15 px of L* < 12 in the arch's 9×10 box at the joint): rows NOTCH_Y about the
# strip's top, NOTCH_W px past the arm's reach, dark runs NOTCH_RUN..NOTCH_MAX px tall
NOTCH_Y, NOTCH_W, NOTCH_L, NOTCH_RUN, NOTCH_MAX, NOTCH_K = (-6, 9), 20, 12, 2, 12, 0.85


def lab(rgb):
    c = rgb.astype(float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    X, Y, Z = c @ [0.4124, 0.3576, 0.1805] / 0.95047, c @ [0.2126, 0.7152, 0.0722], c @ [0.0193, 0.1192, 0.9505] / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)


def cape_cloth(rig):
    """the class's cape: the mean Lab of its lit px, as heroShoulderCheck's sideFill takes it"""
    a = F.load(f'live/assets/{rig}__cape.png'); q = lab(a[..., :3])[(a[..., 3] >= 128)]
    return q[q[:, 0] >= CLOTH_L].mean(0)


def scale_l(rgb, k):
    c = rgb.astype(float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    c = np.clip(c * (k ** 3), 0, 1)
    return np.round(np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255).astype(np.uint8)


def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if F.DRY: return F.load(old if os.path.exists(old) and not FRESH else f'art/gen/{n}.png')
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return F.load(old)


def outfit_of(rig, sfx):
    if (rig, sfx) in OUTFITS: return OUTFITS[(rig, sfx)]
    own = rigarg.param(rig, SCRIPT, 'OUTFITS', {})
    return dict(OUTFITS[(rigarg.base(rig), sfx)], **own.get(sfx, {}))


def side(a, src, lim, O, cape):
    """the strip 2191 drew (a != src) repainted: returns the canvas and the px changed"""
    out = a.copy(); ch = (a != src).any(-1); ch[:, LEFT:] = False
    shadow, ink = F.dim(O['cloth'], SHADOW_L), F.dim(O['cloth'], INK_L)
    tile, belt0 = O.get('tile'), O['belt'][0] - 1
    for y in range(a.shape[0]):
        xs = np.nonzero(ch[y])[0]
        if not len(xs) or lim[y] < 0: continue
        T, end = xs[0], xs[-1] + 1
        g = max(T, min(lim[y] + 1 + VIS, end - 1))
        out[y, T:g, :3] = shadow; out[y, g, :3] = ink; out[y, T:g + 1, 3] = 255
        if g + 1 >= end: continue
        xr = np.arange(g + 1, end)
        if tile and tile[0] <= y < tile[1]:
            y0, y1, Y0, PY, DX = tile; sy = Y0 + (y - Y0) % PY
            col = src[sy, xr + DX, :3]
            turn = []
        else:
            sx = end + (end - 1 - xr) % MIRROR; col = a[y, sx, :3]
            turn = [end - 1]
        col = scale_l(col, SIDE); Lc = F.lstar(col); hi = (Lc > np.median(Lc) + HIGH_L) & bool(turn); lo = np.nonzero(~hi)[0]
        if len(lo):
            for i in np.nonzero(hi)[0]: col[i] = col[lo[np.abs(lo - i).argmin()]]
        for t in turn: col[t - g - 1] = scale_l(a[y, end, :3][None], TURN)[0]
        rust = np.linalg.norm(lab(col) - cape, axis=-1) < RUST_DE; ok = np.nonzero(~rust)[0]
        if len(ok):
            for i in np.nonzero(rust)[0]: col[i] = col[ok[np.abs(ok - i).argmin()]]
        L = F.lstar(col); lit = np.nonzero(L >= LIFT_L)[0]
        if y < belt0 + BELT_LIFT:
            up = out[y - 1, xr, :3]; upL = F.lstar(up)
            for i in np.nonzero(L < LIFT_L)[0]:
                c = up[i] if upL[i] >= LIFT_L else col[lit[np.abs(lit - i).argmin()]] if len(lit) else None
                if c is not None: col[i] = F.dim(c, LIFT_L + LIFT_UP)
        out[y, xr, :3] = col; out[y, xr, 3] = 255
    notch(out, lim, O['top'])
    return out, int((out != a).any(-1).sum())


def notch(out, lim, top):
    """the joint of the pauldron (or the mantle) and the chest beside the arm: per column, a dark run (L* under NOTCH_L) over NOTCH_RUN
    px keeps its top px (the pauldron's outline) and the rest takes the first lit px under it, NOTCH_K darker"""
    L = F.lstar(out[..., :3]); op = out[..., 3] > 127; y0, y1 = top + NOTCH_Y[0], top + NOTCH_Y[1]
    xs = [lim[y] for y in range(y0, y1) if lim[y] >= 0]
    if not xs: return
    for x in range(min(xs) + 1 + VIS + 1, max(xs) + 1 + NOTCH_W):
        y = y0
        while y < y1:
            if not (op[y, x] and L[y, x] < NOTCH_L) or x <= lim[y] + 1 + VIS: y += 1; continue
            e = y
            while e < out.shape[0] and op[e, x] and L[e, x] < NOTCH_L: e += 1
            if e - y > NOTCH_RUN and e < out.shape[0] and op[e, x] and e - y <= NOTCH_MAX:
                out[y + 1:e, x, :3] = scale_l(np.repeat(out[e, x, :3][None], e - y - 1, 0), NOTCH_K)
            y = e


def revote(world, menu0, menu1, Y0, Y1, cape, belt0):
    out = F.revote(world, menu0, menu1, Y0, Y1)
    h, w = world.shape[:2]; C, W, cy, cx = F.G.grid(h, w); op = world[..., 3] > 127
    band = op.copy(); band[:Y0 - 10] = False; band[Y1 + 10:] = False
    pal = np.unique(world[band][:, :3], axis=0); pal = pal[np.linalg.norm(lab(pal) - cape, axis=-1) >= RUST_DE].astype(float)
    ch = (menu0 != menu1).any(-1) & (out[..., 3] > 127); ch[belt0 + BELT_LIFT:] = False
    L1, palL = F.lstar(menu1[..., :3]), F.lstar(pal.astype(np.uint8)); lit = pal[palL >= LIFT_L]
    for (r, c) in set(zip(cy[np.nonzero(ch)[0]], cx[np.nonzero(ch)[1]])):
        cell = (cy[:, None] == r) & (cx[None, :] == c) & (out[..., 3] > 127)
        drawn = cell & (menu1[..., 3] > 127)
        if F.lstar(out[cell][:1, :3])[0] < LIFT_L and (L1[drawn] >= LIFT_L).mean() > 0.5 and len(lit):
            v = menu1[drawn & (L1 >= LIFT_L)][:, :3].astype(float).mean(0)
            out[cell, :3] = lit[np.linalg.norm(F.G.oklab(lit) - F.G.oklab(v[None]), axis=-1).argmin()].astype(np.uint8)
        for v in np.unique(out[cell][:, :3], axis=0):
            if np.linalg.norm(lab(v[None])[0] - cape) >= RUST_DE: continue
            m = cell & (out[..., :3] == v).all(-1)
            k = np.linalg.norm(F.G.oklab(pal) - F.G.oklab(v[None].astype(float)), axis=-1).argmin(); out[m, :3] = pal[k].astype(np.uint8)
    return out


def body_sets():
    if not RIGS: return BODIES
    return {r: [b for b in BODIES[rigarg.base(r)] if os.path.exists(f'art/gen/{r}__{b}.png')] for r in RIGS}


def run():
    R = F.rigs(); names = []; feet = tempfile.mkdtemp(prefix='foot2203')
    subprocess.run(['node', 'tools/measure/shoulders2191/foot.cjs', feet] + ([','.join(RIGS)] if RIGS else []), check=True, stdout=subprocess.DEVNULL)
    for rig, bodies in body_sets().items():
        bottom = int(R[rig]['hipL'][1]) + 8
        for b in bodies:
            n, sfx = f'{rig}__{b}', F.outfit(b); O = dict(outfit_of(rig, sfx), belt=F.outfit_of(rig, sfx)['belt'], top=F.outfit_of(rig, sfx)['top'])
            m0, w0 = keep(n + '_menu'), keep(n); src = F.load(f'art/old/{n}_menu-{SRC_TAG}.png')
            m1, k = side(m0, src, F.reach(feet, rig, sfx), O, cape_cloth(rig))
            w1 = revote(w0, m0, m1, int(np.nonzero((m0 != m1).any(-1).any(1))[0].min()), bottom, cape_cloth(rig), O['belt'][0] - 1)
            F.save(m1, F.gen(n + '_menu')); F.save(w1, F.gen(n)); names += [n, n + '_menu']
            print(f'{n:22s} {k:4d} px of the near side repainted, world {int((w1 != w0).any(-1).sum()):4d} px')
    shutil.rmtree(feet)
    print('python3 tools/prep.py --only ' + ','.join(names))


if __name__ == '__main__':
    RIGS, FRESH = rigarg.take(())
    F.RIGS = RIGS
    {'run': run}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
