#!/usr/bin/env python3
"""TASKS 2196, 2197: the mage from the front read as two cloths and a torn-off leg. A cloak (mage__cape) hung from the shoulders to
the knee on the near side with its own orange zigzag hem over the robe's hem; the skirt's front slit showed both its trims and, in the
world, a two-cell brown band like a leg; the shins' dark navy tops read as a knee block under the robe. The author: the cloak is not
drawn with the robe. The scene draws both skirt halves over both legs (scene_hero.js).
  cape   <rig>__cape, _menu, _w move to art/old/<name>-<tag>.png and leave art/gen, live/assets, art/softbones.json and live/rigs.js
  hem    the skirt is one cloth closed at the front with one trim line: <rig>__thighL{,_menu} keep the slit's left trim (TRIM_W px in the
         arch, TRIM_CELL of its world cell) and take the cloth right of it (shifted by the slit's width) over the slit, its far trim and the hem
         notch; <rig>__thighR{,_menu}, the near half that swings with the near leg, is the closed thighL where it was opaque, its inner edge
         a fold shade (no trim); the shins' navy tops are recoloured into the boot's own leather by lightness (the boot goes up under the hem)
Every source is kept once as art/old/<name>-<tag>.png and each run of hem starts from it.
  python3 tools/fix_2196.py preview OUT.png   the parts before and after, ×3, nothing written
  python3 tools/fix_2196.py cape | hem        (then the printed prep line)
  --rig R: a new mage look, its numbers from art/look_params.json, else the mage's; --fresh"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

os.chdir(os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, 'tools')
import rigarg

TAG = '20261118-2196'
RIG, FRESH = 'mage', False
load = lambda p: np.array(Image.open(p).convert('RGBA'))
save = lambda a, p: Image.fromarray(a).save(p)

SLIT_TOP = 230          # canvas row where the skirt's front trim starts to split (mage__thighL_menu)
WIN = (100, 136)        # canvas columns the slit lies in
TRIM_W = 6              # the one trim line's width in the arch (the trim above the slit)
CELL_SLIT = 13          # the world skirt's trim column (cells of the 42 grid): kept; the column right of it was the slit's far trim
CELL_ROWS = (22, 37)    # the world skirt's rows
TRIM_CELL = 0.5         # (TASKS 2201) the share of its cell the world trim keeps, from its left: a whole cell (2 world px) read 3 px wide
                        # where the swinging skirt turned it off the pixel grid; the rest of the cell takes the cloth beside it
FOLD = 0.75             # the near half's inner edge: the cloth's own tone times this

def keep(n):
    old = f'art/old/{n}-{TAG}.png'
    if FRESH or not os.path.exists(old): shutil.copyfile(f'art/gen/{n}.png', old)
    return load(old)

orange = lambda p: p[0] > 90 and p[0] > p[2] + 30
navy = lambda p: p[2] > p[0] + 8 and p[2] > p[1] + 5

def runs(a, y):
    out, x = [], WIN[0]
    while x < WIN[1]:
        if a[y, x, 3] > 127 and orange(a[y, x]):
            s = x
            while x < WIN[1] and a[y, x, 3] > 127 and orange(a[y, x]): x += 1
            out.append((s, x - 1))
        x += 1
    return out

def close_menu(src):
    a, H = src.copy(), src.shape[0]
    last = None
    for y in range(SLIT_TOP, H):
        r = runs(src, y)
        if not r: continue
        t = min(r[0][1], r[0][0] + TRIM_W - 1)
        proper = len(r) >= 2 and r[1][1] < WIN[1] - 1 and src[y, r[1][1] + 1, 3] > 127 and navy(src[y, r[1][1] + 1]) or len(r) >= 2 and r[1][1] < WIN[1] - 1 and src[y, r[1][1] + 2, 3] > 127 and navy(src[y, r[1][1] + 2])
        if proper: R = r[1][1]; last = R - t
        elif last is not None: R = t + last
        elif r[0][1] > t: R = r[0][1]
        else: continue
        d = R - t
        for x in range(t + 1, R + 1): a[y, x] = src[y, x + d] if x + d < src.shape[1] else 0
    return a

def close_world(src):
    a, C = src.copy(), src.shape[0] / 42
    cell = lambda c, r: src[int((r + 0.5) * C), int((c + 0.5) * C)]
    for r in range(*CELL_ROWS):
        y0, y1, x0, x1 = round(r * C), round((r + 1) * C), round((CELL_SLIT + 1) * C), round((CELL_SLIT + 2) * C)
        nb, me = cell(CELL_SLIT + 2, r), cell(CELL_SLIT, r)
        a[y0:y1, x0:x1] = nb
        if me[3] > 127 and not orange(me) and r > CELL_ROWS[0] + 1:
            up = next((cell(CELL_SLIT, q) for q in range(r - 1, CELL_ROWS[0], -1) if orange(cell(CELL_SLIT, q))), None)
            if up is not None: a[y0:y1, round(CELL_SLIT * C):x0] = up
        side = cell(CELL_SLIT - 1, r)
        if orange(a[int((r + 0.5) * C), int((CELL_SLIT + 0.5) * C)]) and not (side[3] > 127 and orange(side)): a[y0:y1, round((CELL_SLIT + TRIM_CELL) * C):x0] = nb
    return a

def near_half(closed, orig):
    a = np.zeros_like(closed); m = orig[..., 3] > 127
    a[m] = closed[m]
    for y in range(a.shape[0]):
        xs = np.nonzero(a[y, :, 3] > 127)[0]
        if len(xs) and navy(a[y, xs[0]]): a[y, xs[0], :3] = (a[y, xs[0], :3] * FOLD).astype(np.uint8)
    return a

def boot_top(src):
    a = src.copy(); m = (a[..., 3] > 127)
    px = a[m][:, :3].astype(int)
    lum = lambda q: 0.299 * q[..., 0] + 0.587 * q[..., 1] + 0.114 * q[..., 2]
    leather = px[(px[:, 0] > 90) & (px[:, 0] > px[:, 2] + 30)]
    if not len(leather): return a
    leather = leather[np.argsort(lum(leather))][: max(1, len(leather) // 2)]
    ys, xs = np.nonzero(m)
    nv = [(y, x) for y, x in zip(ys, xs) if navy(a[y, x])]
    if not nv: return a
    ls = np.array([lum(a[y, x, :3].astype(float)) for y, x in nv]); lo, hi = ls.min(), max(ls.max(), ls.min() + 1)
    for (y, x), l in zip(nv, ls): a[y, x, :3] = leather[int((l - lo) / (hi - lo) * (len(leather) - 1))]
    return a

def build(fine):
    s = '_menu' if fine else ''
    L0, R0 = keep(f'{RIG}__thighL{s}'), keep(f'{RIG}__thighR{s}')
    Lc = close_menu(L0) if fine else close_world(L0)
    out = {f'{RIG}__thighL{s}': Lc, f'{RIG}__thighR{s}': near_half(Lc, R0)}
    for side in 'LR': out[f'{RIG}__shin{side}{s}'] = boot_top(keep(f'{RIG}__shin{side}{s}'))
    return out

def hem():
    names = []
    for fine in (0, 1):
        for n, a in build(fine).items(): save(a, f'art/gen/{n}.png'); names.append(n)
    print('python3 tools/prep.py --only ' + ','.join(names))

def cape():
    names = [f'{RIG}__cape', f'{RIG}__cape_menu', f'{RIG}__cape_w']
    for n in names:
        if os.path.exists(f'art/gen/{n}.png'):
            if not os.path.exists(f'art/old/{n}-{TAG}.png'): shutil.copyfile(f'art/gen/{n}.png', f'art/old/{n}-{TAG}.png')
            os.remove(f'art/gen/{n}.png')
        if os.path.exists(f'live/assets/{n}.png'): os.remove(f'live/assets/{n}.png')
    sb = open('art/softbones.json').read().split('\n')
    open('art/softbones.json', 'w').write('\n'.join(l for l in sb if not l.lstrip().startswith(f'"{RIG}__cape"')))
    rigs = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
    if rigs.pop(f'{RIG}__cape', None) is not None: open('live/rigs.js', 'w').write('window.RIGS = ' + json.dumps(rigs) + ';\n')
    print('python3 tools/prep.py --only ' + ','.join(names[:2]) + '   (drops their manifest entries)')

def preview(out):
    rows = []
    for fine in (0, 1):
        s = '_menu' if fine else ''
        before = [keep(f'{RIG}__{n}{s}') for n in ('thighL', 'thighR', 'shinL', 'shinR')]
        b = build(fine); after = [b[f'{RIG}__{n}{s}'] for n in ('thighL', 'thighR', 'shinL', 'shinR')]
        for set_ in (before, after):
            bg = Image.new('RGBA', (162, 160), (60, 50, 45, 255))
            for k in (2, 3, 0, 1): bg.alpha_composite(Image.fromarray(set_[k]).crop((0, 186, 162, 346)))
            rows.append(bg)
    sh = Image.new('RGBA', (162 * 4, 160), (20, 20, 20, 255))
    for i, im in enumerate(rows): sh.paste(im, (i * 162, 0))
    sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save(out)

if __name__ == '__main__':
    (RIG, *more), FRESH = rigarg.take([RIG])
    if more or rigarg.base(RIG) != 'mage': sys.exit(f'one mage rig, not {[RIG, *more]}')
    for k in ('SLIT_TOP', 'WIN', 'TRIM_W', 'CELL_SLIT', 'CELL_ROWS', 'TRIM_CELL', 'FOLD'): globals()[k] = rigarg.param(RIG, 'fix_2196', k, globals()[k])
    cmd = [a for a in sys.argv[1:] if not a.startswith('--')]
    if cmd[:1] == ['preview']: preview(cmd[1])
    elif cmd[:1] == ['hem']: hem()
    elif cmd[:1] == ['cape']: cape()
    else: sys.exit(__doc__)
