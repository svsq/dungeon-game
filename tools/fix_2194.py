#!/usr/bin/env python3
"""TASKS 2194: the mage's near shoulder, by the recipe of tools/fix_2191.py (read its docstring).

The mage's torsos were cut like the warrior's: under the near arm the robe's side is cut out and a dark seam (the bell sleeve's
inner outline and the robe's own edge, L* 1-6, x 70-75, y 99-141 of the 162x360 canvas) stands between the sleeve laid into the
torso by 2167 and the lit robe. mage_a_v4 draws the robe's side under the arm in the robe's blue (leather and cloak outfits: their
own cloth), so the strip here is that tone; the belt (rows 159-171) is carried on to it. The pouch under the hand stays.
  run    the six mage bodies (robe, leather, cloak; with and without a head; world and _menu)
  sock   mage__uarmL{,_le,_hd}_sock, mage__farmL_sock (+ _menu)
  drape  mage__uarmL{,_le,_hd}_drape_menu: the arch's upper arm holding the orb, its bell's foot wider (drape() below)
Sources kept once as art/old/<name>-20261118-2194.png; after gridify_2155.py run over the mage's parts, run this again.
  python3 tools/fix_2194.py run | sock | drape      (then the printed prep line; DRY=<dir> as in fix_2191)
  --rig R: a new mage look (mage_b, mage_c), its rows from art/look_params.json under fix_2194 (OUTFITS as in fix_2191, FLARE…)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_2191 as F
import numpy as np
import rigarg

F.TAG, F.SCRIPT = '20261118-2194', 'fix_2194'
RIG = 'mage'
F.OVER = 8
F.BODIES = {'mage': ['body', 'body_nh', 'body_le', 'body_le_nh', 'body_hd', 'body_hd_nh']}
F.OUTFITS = {('mage', ''): dict(top=89, belt=(160, 171), strip=(40, 54, 103), cool=True),
             ('mage', 'le'): dict(top=108, belt=(160, 171), strip=(40, 54, 103)),
             ('mage', 'hd'): dict(top=112, belt=(160, 171), strip=(38, 50, 95))}

# the bell sleeve laid into the torso by 2167 reaches from the shoulder to the elbow and the leather and cloak outfits put their pad
# and hood over it: a flat strip over those rows read as a blue board wherever the breath moves the arm off them, so here only the
# cut-out and the dark seam take the strip, the lit px of the cap and the robe stay
# BUF: from where the sleeve lies in every moment of the rest to BUF px past the farthest it reaches in any (arch or world) the robe's
# own dark lines (the gold trim's and the clasp's outlines, the fold shade) ran on into the sleeve's outline and read as the seam; they
# take the tone of the first lit cloth px (L* to CLOTH: not the gold trim or clasp) of their row within NEXT px towards the torso
# (leather stays leather; on the plain robe (cool) only blue: the clasp's brown rim is not the robe), else the strip's at LIFT, so a
# line ends on cloth short of the sleeve. Rows from top to ELBOW px under the elbow joint
BUF, LIFT, ELBOW, NEXT, CLOTH = 4, 24, 4, 8, 45
_side, _reach, ANY = F.side, F.reach, {}
def reach(feet, rig, sfx):
    r = None
    for k in [b + o for b in (f'{rig}__body{"_" + sfx if sfx else ""}_menu', f'{rig}__body{"_" + sfx if sfx else ""}') for o in ('', '_o')]:
        if not os.path.exists(os.path.join(feet, k + '.png')): continue
        g = F.load(os.path.join(feet, k + '.png'))[..., 1] > 127
        q = np.array([np.nonzero(row)[0].max() if row.any() else -1 for row in g]); r = q if r is None else np.maximum(r, q)
    ANY['r'] = r
    return _reach(feet, rig, sfx)
def side(a, cap, lim, O, bottom):
    out, _ = _side(a, cap, lim, O, bottom)
    lit = (a[..., 3] > 127) & (F.lstar(a[..., :3]) >= F.DARK); out[lit] = a[lit]
    L, r, y1 = F.lstar(out[..., :3]), ANY['r'], int(F.rigs()[RIG]['elbowL'][1]) + ELBOW
    for y in range(O['top'], y1):
        if r[y] < 0: continue
        for x in range(max(0, lim[y] - F.OVER) if lim[y] >= 0 else r[y] + 1, min(r[y] + 1 + BUF, a.shape[1])):
            if out[y, x, 3] > 127 and L[y, x] < F.INK:
                k = next((k for k in range(x + 1, min(x + NEXT, a.shape[1])) if out[y, k, 3] > 127 and F.DARK <= L[y, k] <= CLOTH and (not O.get('cool') or out[y, k, 2] > out[y, k, 0])), None)
                out[y, x, :3] = out[y, k, :3] if k is not None else F.dim(O['strip'], LIFT)
    return out, int((out != a).any(-1).sum())
F.side, F.reach = side, reach

def scale_l(rgb, k):
    c = rgb.astype(float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    L = F.lstar(rgb); Y = ((np.clip(np.maximum(L * k, np.minimum(L, WORLD_INK)), 0, 100) + 16) / 116) ** 3; Y0 = np.maximum(c @ [0.2126, 0.7152, 0.0722], 1e-6); c = np.clip(c * (Y / Y0)[..., None], 0, 1)
    return np.round(np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255).astype(np.uint8)

# the world's robe is darker than the arch's (2184, heroHoodCheck: its blue at most luminance 52): the arch's new px snapped to the
# nearest world tone took the world's lightest blues, so they vote scaled by the world's share of the arch's lightness first, a lit px
# no darker than WORLD_INK (under L* 20 heroShoulderCheck counts it as the seam, under 22 exposed_r4.cjs); SIDE_K more, the side under the arm in its shade
SIDE_K, WORLD_INK = 0.8, 22.5
# the world's robe has its lit blue and shade under L* 20 (which heroShoulderCheck counts as the seam): the side takes a tone between,
# duller than the lit blue (heroHoodCheck: spread at most 60); every blue px the vote changed takes it
WORLD_STRIP = (40, 51, 88)
_revote = F.revote
def revote(world, menu0, menu1, Y0, Y1):
    lum = lambda a: (a[..., 3] > 127) & (F.lstar(a[..., :3]) >= F.DARK)
    k = SIDE_K * F.lstar(world[..., :3])[lum(world)].mean() / F.lstar(menu0[..., :3])[lum(menu0)].mean()
    sc = lambda a: np.concatenate([scale_l(a[..., :3], k), a[..., 3:]], -1)
    out = _revote(world, sc(menu0), sc(menu1), Y0, Y1)
    r, g, b = (out[..., i].astype(int) for i in range(3)); new = (out != world).any(-1) & (out[..., 3] > 127) & (b > r + 30) & (b > g + 10)
    out[new, :3] = WORLD_STRIP
    return out
F.revote = revote

# the bell of the upper arm held out with the orb (arch only: the world's gap there is under its limit): from the arch's ×3.2 a slot of
# 1.2-1.7 world px² opened between the sleeve's lower outer corner, the orb's rim and the cup (2190, not touched); mage_a_v4 hangs the
# bell wider there. FLARE px more at the bell's foot, nothing at FLARE_Y0, the outline band moved out and the gap filled with the
# row's first lit px; the foot's own outline rows (FOOT) carried out as outline. CAP px more over the rows CAP_Y of the shoulder's
# round, where the orb's rim left a notch of 5 texels under the robe's shoulder
FLARE, FLARE_Y0, FOOT, BAND, CAP, CAP_Y = 8, 122, 2, 12, 3, (86, 95)
def drape():
    names = []
    for sfx in ('', '_le', '_hd'):
        n = f'{RIG}__uarmL{sfx}_drape_menu'; a = F.load(f'art/gen/{RIG}__uarmL{sfx}_menu.png'); out = a.copy()
        op = a[..., 3] > 127; L = F.lstar(a[..., :3]); ys = np.nonzero(op.any(1))[0]; y1 = ys.max()
        for y in list(range(*CAP_Y)) + list(range(FLARE_Y0 + 1, y1 + 1)):
            xs = np.nonzero(op[y])[0]
            if not len(xs): continue
            xl, ext = xs[0], CAP if y < CAP_Y[1] else round(FLARE * (y - FLARE_Y0) / (y1 - FLARE_Y0))
            if ext < 1: continue
            if y > y1 - FOOT: out[y, xl - ext:xl] = a[y, xl]; continue
            k = next((i for i in range(xl, xs[-1]) if L[y, i] >= BAND), xl + 1) - xl
            out[y, xl - ext:xl - ext + k] = a[y, xl:xl + k]; out[y, xl - ext + k:xl + k] = a[y, xl + k]
        F.save(out, F.gen(n)); names.append(n); print(n)
    print('python3 tools/prep.py --only ' + ','.join(names))

if __name__ == '__main__':
    F.RIGS, F.FRESH = rigarg.take(())
    (RIG, *more) = F.RIGS or [RIG]
    if more or rigarg.base(RIG) != 'mage': sys.exit(f'one mage rig, not {F.RIGS}')
    for k in ('BUF', 'LIFT', 'ELBOW', 'NEXT', 'CLOTH', 'SIDE_K', 'WORLD_INK', 'WORLD_STRIP', 'FLARE', 'FLARE_Y0', 'FOOT', 'BAND', 'CAP', 'CAP_Y'): globals()[k] = rigarg.param(RIG, 'fix_2194', k, globals()[k])
    {'run': F.run, 'sock': F.sock, 'drape': drape}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
