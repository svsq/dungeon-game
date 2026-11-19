#!/usr/bin/env python3
"""TASKS 2191 (study/critique/chars_{assets,style,ref}_r4.md, the author's frame 25): the near shoulder of the warrior and the archer.

The torsos were cut from sheets where the near arm hung in front of them: under the arm their side was cut out (1246-1730 rig px,
up to 24 px in), and 2167 laid the resting arm into the torso from the shoulder to the armpit (the cap). Between that cap and the
torso's own lit edge two outlines and the armpit shade stood together, 4-6 px of L* 8-17 (the dark seam the author circled), and
with the arm turned out by NEAR_OUT and the breath the cut-out showed the cape or the quiver at the elbow.
Here, per row of every warrior and archer body (each outfit, with or without a head, the arch's _menu and the world copy), from
just under the shoulder joint (top) down to the hip:
  * the side of the torso is drawn from the near arm's edge to the torso's own content: the cap's sleeve right of the arm, the
    seam and the cut-out become the side strip of the sheets (STRIP: the dark red gambeson of warrior_a_v2, the olive mantle of
    archer_a, the shirt's or the cloak's shade in those outfits), the belt's rows carry the belt on to it; one outline px (INK)
    stays at the torso's content and one at the strip's arm-side edge, which the arm covers at rest; a row all dark there (the
    plate's lower rim, the belt's thick outline) is that dark only to INK where it meets the strip;
  * how far the strip reaches: OVER px under the near arm where it lies in every pose of the rest (the arch and the world, a
    breath cycle, both facings: tools/measure/shoulders2191/foot.cjs), so turned out by NEAR_OUT and the breath it never leaves
    the cape between them. The near arm is drawn over the torso in the front view (scene_hero.js), so the strip under it is
    the torso's side, not a cover over the arm.
The world copy is painted in cells of the grid (gridify_2155): each cell the change touches takes the vote of the new drawn
pixels in it (gridify_2155.dominant), snapped to the nearest tone the world part already has.
  sock   <rig>__uarmL<outfit>_sock(_menu), <rig>__farmL<outfit>_sock(_menu): the arm the 2188 copy draws under the body, its
         outline taken off (the silhouette one px in, dark px filled from their neighbours) and SOCK_DARK darker, so in the gap it
         fills it reads as the arm's shade, not as a second sleeve
Every source is kept once as art/old/<name>-20261118-2191.png and each run starts from it; gridify_2155.py run over these parts
returns their old colours, so this step runs after it.
  python3 tools/fix_2191.py run | sock      (then the printed prep line; with DRY=<dir> the canvases go there, art/ untouched)
  --rig R: a new look (its prepped parts in live/assets: foot.cjs draws it), its OUTFITS rows ({outfit: {top, belt, strip}}) from
  art/look_params.json, else its class's; --fresh: the frozen copies made again"""
import json, os, re, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import gridify_2155 as G
import rigarg

TAG = '20261118-2191'
SCRIPT, RIGS, FRESH = 'fix_2191', None, False
BODIES = {'hero': ['body', 'body_nh', 'body_cl', 'body_cl_nh', 'body_pw', 'body_pw_nh', 'body_hd', 'body_hd_nh'],
          'archer': ['body', 'body_nh', 'body_hd', 'body_hd_nh']}
# per outfit: the first row worked on (just under the shoulder joint: the cap's pauldron rim beside the arm turned out doubled the
# arm's own; rows above are left as 2167 laid them), the belt's rows, and the strip's tone (sampled from the outfit's own cloth)
OUTFITS = {('hero', ''): dict(top=89, belt=(142, 151), strip=(127, 28, 18)),
           ('hero', 'pw'): dict(top=89, belt=(147, 156), strip=(127, 28, 18)),
           ('hero', 'cl'): dict(top=89, belt=(142, 151), strip=(105, 73, 55)),
           ('hero', 'hd'): dict(top=89, belt=(143, 151), strip=(95, 52, 41)),
           ('archer', ''): dict(top=88, belt=(142, 154), strip=(74, 74, 33)),
           ('archer', 'hd'): dict(top=92, belt=(142, 154), strip=(99, 56, 33))}
# BELT_IN: a belt row's colour is taken that far inside the torso's old edge; the rows just above and below the belt carry its
# outline (BELT_INK), the belt's own thick top and bottom outlines (3-7 rows) would read as a dark block beside the arm
# INK, SHADE: the L* of the one outline px left between the strip and the torso's content and of the px before it (the strip's own tone
# that dark: an edge the eye reads, not the seam heroShoulderCheck and exposed_r4.cjs count under L* 20-22); BELT_INK the belt's outline
# rows carried on to the strip
OVER, DARK, SEAM, SMOOTH, EDGE, SOCK_DARK, BELT_IN, BELT_INK, INK, SHADE = 2, 22, 7, 2, 3, 0.85, 8, (88, 46, 32), 23, 25

load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)
rigs = lambda: json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))

def lstar(rgb):
    c = rgb.astype(float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4); Y = c @ [0.2126, 0.7152, 0.0722]
    return np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)

DRY = os.environ.get('DRY')
gen = lambda n: os.path.join(DRY, n + '.png') if DRY else f'art/gen/{n}.png'

def dim(rgb, L):
    """the colour scaled in linear light to the lightness L*"""
    c = np.array(rgb, float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    Y = ((L + 16) / 116) ** 3; c = c * Y / (c @ [0.2126, 0.7152, 0.0722])
    return np.round(np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255).clip(0, 255).astype(np.uint8)

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if DRY: return load(old if os.path.exists(old) and not FRESH else f'art/gen/{n}.png')
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

def outfit(b):
    return b.replace('_nh', '')[5:]

def arm_at_rest(rig, sfx):
    out = None
    for p in ('uarm', 'farm'):
        n = f'art/gen/{rig}__{p}L_{sfx}_menu.png' if sfx and os.path.exists(f'art/gen/{rig}__{p}L_{sfx}_menu.png') else f'art/gen/{rig}__{p}L_menu.png'
        a = load(n)
        if out is None: out = a.copy()
        else: m = a[..., 3] > 0; out[m] = a[m]
    return out

def reach(feet, rig, sfx):
    """per row, the rightmost px the near arm covers in every pose of the rest (upper arm or forearm), the tighter of the arch and the
    world, its running minimum over SMOOTH rows either side so the strip's edge does not follow every link of the mail"""
    lim = None
    for k in (f'{rig}__body{"_" + sfx if sfx else ""}_menu', f'{rig}__body{"_" + sfx if sfx else ""}'):
        u, f = load(os.path.join(feet, k + '.png'))[..., 0] > 127, load(os.path.join(feet, k + '_f.png'))[..., 0] > 127
        m = u | f; r = np.array([np.nonzero(row)[0].max() if row.any() else -1 for row in m])
        lim = r if lim is None else np.where((lim < 0) | (r < 0), -1, np.minimum(lim, r))
    out = lim.copy()
    for y in range(len(lim)):
        w = lim[max(0, y - SMOOTH):y + SMOOTH + 1]; out[y] = -1 if (w < 0).any() else w.min()
    return out

def side(a, cap, lim, O, bottom):
    """the torso's near side drawn: returns the new canvas and the count of px changed"""
    out = a.copy(); L = lstar(a[..., :3]); op = a[..., 3] > 127; b0, b1 = O['belt']; rows = {}
    lit = lambda y, x: op[y, x:x + 3].all() and (L[y, x:x + 3] >= DARK).all()
    for y in range(O['top'], bottom):
        xs = np.nonzero(op[y])[0]
        if not len(xs) or lim[y] < 0: continue
        e = xs[0]; cx = np.nonzero(cap[y])[0]; start = cx.max() + 1 if len(cx) else e
        P = next((x for x in range(start, start + SEAM) if lit(y, x)), None)
        T = min(e, lim[y] - OVER)
        if T >= e and (y >= b0 - 1 or P is None): continue
        rows[y] = (e, T, P)
    # the torso's content edge, a running median over EDGE rows either side: row by row the plate's dark rim rows left a comb
    ps = {y: int(np.median([rows[k][2] for k in range(y - EDGE, y + EDGE + 1) if k in rows and rows[k][2] is not None] or [-1])) for y in rows}
    for y, (e, T, P) in rows.items():
        belt = b0 - 1 <= y <= b1; Pn = P if belt or P is None or ps[y] < 0 else ps[y]
        end = Pn if Pn is not None and not belt else (P if P is not None else e)
        ink = not belt and Pn is not None
        if end - (1 if ink else 0) - T < 2: continue
        fill = a[y, e + BELT_IN, :3] if b0 <= y < b1 and L[y, e + BELT_IN] >= INK else np.array(BELT_INK if belt else O['strip'])
        out[y, T:end, :3] = fill; out[y, T:end, 3] = 255
        if ink: out[y, end - 1, :3] = dim(O['strip'], INK); out[y, end - 2, :3] = dim(O['strip'], min(SHADE, lstar(np.array([O['strip']]))[0]))
        out[y, T, :3] = (np.array(fill) * 0.35).astype(np.uint8)
        if P is None:
            band = [x for x in range(e, e + SEAM) if op[y, x] and L[y, x] < INK]
            out[y, band, :3] = BELT_INK if belt else dim(O['strip'], INK)
    return out, int((out != a).any(-1).sum())

def revote(world, menu0, menu1, Y0, Y1):
    """the world copy: every grid cell where the drawn canvas changed takes the vote of its new px, snapped to the world part's
    own tones in the rows worked on"""
    out = world.copy(); h, w = world.shape[:2]; C, W, cy, cx = G.grid(h, w)
    ch = (menu0 != menu1).any(-1); ch[:Y0] = False
    op0 = world[..., 3] > 127; band = op0.copy(); band[:Y0 - 10] = False; band[Y1 + 10:] = False
    pal = np.unique(world[band][:, :3], axis=0).astype(float); plab = G.oklab(pal)
    for (r, c) in set(zip(cy[np.nonzero(ch)[0]], cx[np.nonzero(ch)[1]])):
        m = (cy[:, None] == r) & (cx[None, :] == c); out[m & ch, 3] = menu1[m & ch, 3]
        o1 = m & (menu1[..., 3] > 127); o2 = m & (out[..., 3] > 127)
        if not o1.any(): continue
        dom, _ = G.dominant(menu1[..., :3].astype(float), o1, np.zeros(o1.shape, int), 1)
        k = np.linalg.norm(plab - G.oklab(dom[0][None]), axis=-1).argmin(); out[o2, :3] = pal[k].astype(np.uint8)
    return out

def body_sets():
    """{rig: its torsos}: BODIES as they are, or the --rig looks with their class's torsos they have"""
    if not RIGS: return BODIES
    return {r: [b for b in BODIES[rigarg.base(r)] if os.path.exists(f'art/gen/{r}__{b}.png')] for r in RIGS}

def outfit_of(rig, sfx):
    """the outfit's row of OUTFITS: a new look's own from art/look_params.json, else its class's"""
    if (rig, sfx) in OUTFITS: return OUTFITS[(rig, sfx)]
    own = rigarg.param(rig, SCRIPT, 'OUTFITS', {})
    return dict(OUTFITS[(rigarg.base(rig), sfx)], **own.get(sfx, {}))

def outfit_keys():
    return list(OUTFITS) if not RIGS else [(r, sfx) for r in RIGS for b, sfx in OUTFITS if b == rigarg.base(r)]

def run():
    R = rigs(); names = []; feet = tempfile.mkdtemp(prefix='foot2191')
    subprocess.run(['node', 'tools/measure/shoulders2191/foot.cjs', feet] + ([','.join(RIGS)] if RIGS else []), check=True, stdout=subprocess.DEVNULL)
    for rig, bodies in body_sets().items():
        bottom = int(R[rig]['hipL'][1]) + 8
        for b in bodies:
            n, sfx = f'{rig}__{b}', outfit(b); O = outfit_of(rig, sfx)
            m0, w0 = keep(n + '_menu'), keep(n); arm = arm_at_rest(rig, sfx)
            cap = (m0[..., 3] > 127) & (arm[..., 3] > 127) & (np.abs(m0[..., :3].astype(int) - arm[..., :3]).sum(-1) == 0)
            m1, k = side(m0, cap, reach(feet, rig, sfx), O, bottom)
            w1 = revote(w0, m0, m1, O['top'], bottom)
            save(m1, gen(n + '_menu')); save(w1, gen(n)); names += [n, n + '_menu']
            print(f'{n:22s} {k:4d} px of the near side redrawn, world {int((w1 != w0).any(-1).sum()):4d} px')
    shutil.rmtree(feet)
    print('python3 tools/prep.py --only ' + ','.join(names))

def unline(a):
    """the silhouette one px in, the dark px left inside filled from their lit neighbours, the whole SOCK_DARK darker"""
    op = a[..., 3] > 127; inner = op.copy()
    for dy, dx in G.N4: inner &= G.shift(op, dy, dx, False)
    out = a.copy(); out[~inner] = 0; L = lstar(a[..., :3]); dark = inner & (L < DARK)
    for _ in range(8):
        if not dark.any(): break
        lit = inner & ~dark; acc = np.zeros(a.shape[:2] + (3,)); k = np.zeros(a.shape[:2])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                s = G.shift(lit, dy, dx, False); acc += G.shift(out[..., :3].astype(float), dy, dx, 0) * s[..., None]; k += s
        fix = dark & (k > 0); out[fix, :3] = (acc[fix] / k[fix, None]).astype(np.uint8); dark &= ~fix
    out[..., :3] = (out[..., :3] * SOCK_DARK).astype(np.uint8)
    return out

def sock():
    names = []
    for (rig, sfx), p in [(k, p) for k in outfit_keys() for p in ('uarmL', 'farmL')]:
        n = f'{rig}__{p}' + (f'_{sfx}' if sfx and os.path.exists(f'art/gen/{rig}__{p}_{sfx}.png') else '')
        if n + '_sock' in names: continue
        for m in ('', '_menu'):
            save(unline(load(f'art/gen/{n}{m}.png')), gen(f'{n}_sock{m}'))
        names += [n + '_sock', n + '_sock_menu']; print(n + '_sock')
    print('python3 tools/prep.py --only ' + ','.join(names))

if __name__ == '__main__':
    RIGS, FRESH = rigarg.take(())
    {'run': run, 'sock': sock}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
