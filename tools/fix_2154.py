"""TASKS 2154, the warrior's parts (study/critique/chars_menu_r1.md finding 1, chars_style_r1.md finding 3):
  1. leftover chroma-key green (the generator's background) repainted with its non-green neighbours' median;
  2. steel cooled toward the small ref (art/char_refs/warrior_a_small_r4.png: steel L 49 a 1 b -3, highlight L 74 a 0 b 5; the
     parts had L 41 a 9 b 5 and cream-gold highlights L 76 a 14 b 35), the red cloth darkened and calmed toward the ref and
     art/style_bible.txt's #73140d (ref L 26 C 47; the parts had L 34 C 62). The head's rows (skin, hair) are not touched.
  python3 tools/fix_2154.py OUT|install [--rig R] [--fresh]   R: a new warrior look (its head rows from tools/rigarg.head, its
  tones toward its own reference from art/look_params.json, else the warrior's)"""
import os, sys
import numpy as np
sys.path.insert(0, 'tools')
import labtone, rigarg
from labtone import lab, rgb, lch, source, write

STAMP = '20261117-2154'
HEAD, HEAD_BACK = 69, 60                  # tools/gear.py NEW_LOOK hero: rows above are the cell-painted head
STEEL_C = 18                              # steel is the low-chroma material; leather, red and skin all sit above C 25
STEEL_L, RED_L, RED_C = 7, -7, 0.8
SFX = ('', '_cl', '_pw', '_hd')
RIG = 'hero'
def parts(rig):
    out = [p + s for s in SFX for p in ('body', 'body_menu', 'body_nh', 'body_back', 'body_back_nh', 'uarmL', 'uarmR', 'farmL', 'farmR',
                                         'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR')]
    out += ['cape', 'head_le', 'head_back_le', 'head_kn', 'head_back_kn']
    return [p for p in dict.fromkeys(out) if os.path.exists(f'art/gen/{rig}__{p}.png')]
PARTS = parts(RIG)
steely = lambda: {'body', 'body_menu', 'body_nh', 'body_back', 'body_back_nh', 'uarmL', 'uarmR', 'head_kn', 'head_back_kn'} | \
    {p for p in PARTS if p.endswith('_pw')}    # the shirt, hood, trousers and leather hold no steel: their greys are cloth
STEELY = steely()


def keygreen(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (a[..., 3] > 100) & (g > 50) & (g > 1.6 * r) & (g > 1.8 * b)


def unkey(a):
    bad = keygreen(a); out = a.copy(); H, W = bad.shape
    for y, x in zip(*np.where(bad)):
        win = (slice(max(0, y - 2), y + 3), slice(max(0, x - 2), x + 3))
        ok = (a[win][..., 3] > 127) & ~bad[win]
        if ok.any(): out[y, x, :3] = np.median(a[win][ok][:, :3], 0)
        else: out[y, x, 3] = 0
    return out, int(bad.sum())


def near_share(m, r=3):
    p = np.pad(m.astype(float), r); c = p.cumsum(0).cumsum(1); c = np.pad(c, ((1, 0), (1, 0))); k = 2 * r + 1
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / k / k


def tone(a, head_rows, metal, highlights):
    L, A, B = lab(a[..., :3].astype(float)); C, h = lch(L, A, B); op = a[..., 3] > 127
    body = op.copy(); body[:head_rows] = False
    steel = body & (C < STEEL_C) & (L > 10) & metal
    ws = np.clip((STEEL_C - C) / 6, 0, 1) * np.clip((L - 10) / 10, 0, 1)
    nL, nA, nB = L.copy(), A.copy(), B.copy()
    nL[steel] += STEEL_L * ws[steel]; nA[steel] += (0.15 * A[steel] + 0.5 - A[steel]) * ws[steel]
    nB[steel] += (0.15 * B[steel] - 2.5 - B[steel]) * ws[steel]
    glint = body & highlights & (L > 45) & (h > 40) & (h < 100) & (C > 12) & (near_share(steel, 6) > 0.15)
    k = np.clip((L - 45) / 15, 0, 1)      # the rust-orange mid lines keep a little warmth, the cream-gold glints go to steel
    nA[glint] = (A * (1 - 0.9 * k))[glint]; nB[glint] = (B * (1 - 0.85 * k) + 2 * k)[glint]
    red = body & (C > 35) & (A > 28) & ((h < 41) | (h > 350)) & (L < 60)
    wr = np.clip((L - 10) / 10, 0, 1)
    nL[red] += RED_L * wr[red]; nA[red] *= RED_C; nB[red] *= RED_C
    m = steel | glint | red; out = a.copy(); out[m, :3] = rgb(nL, nA, nB)[m]
    return out, int(steel.sum()), int(glint.sum()), int(red.sum())


def main(out):
    for p in PARTS:
        name = f'{RIG}__' + p; a, keyed = unkey(source(name, STAMP))
        rows = 0 if p.startswith('head') else HEAD_BACK if p.startswith('body_back') else HEAD if p.startswith('body') else 0
        a, s, g, r = tone(a, rows, p in STEELY, not p.startswith('head'))
        write(name, a, STAMP, out); print(f'{name:24s} key {keyed:3d}  steel {s:6d}  glint {g:5d}  red {r:6d}')


(RIG, *more), labtone.FRESH = rigarg.take([RIG])
if more or rigarg.base(RIG) != 'hero': sys.exit(f'one warrior rig, not {[RIG, *more]}')
if not rigarg.accepted(RIG):
    HEAD, HEAD_BACK = rigarg.head(RIG)['body'], rigarg.head(RIG)['body_back']; PARTS = parts(RIG); STEELY = steely()
    for k in ('STEEL_C', 'STEEL_L', 'RED_L', 'RED_C'): globals()[k] = rigarg.param(RIG, 'fix_2154', k, globals()[k])
main(sys.argv[1])
