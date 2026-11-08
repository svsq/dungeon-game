# a limb must not tear away from the body at its joint: turn the part about its pivot through its working range and check that
# what is covered around the joint at rest (body ∪ part, within R rig px) stays covered (body ∪ turned part)
#   python3 tools/jointgap.py NAME "PART:PIVOTKEY:R:A0,A1" ...   (angles in rig rad, positive clockwise; exit 2 on a gap)
import json, re, sys; import numpy as np; from PIL import Image
name = sys.argv[1]; RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))[name]
op = lambda n: np.array(Image.open(f'art/gen/{name}__{n}.png').convert('RGBA'))[..., 3] > 60
B, bad = op('body'), 0
for arg in sys.argv[2:]:
    part, key, R, rng = arg.split(':'); px, py = RG[key]; R = float(R); a0, a1 = map(float, rng.split(','))
    P = op(part); yy, xx = np.mgrid[:B.shape[0], :B.shape[1]]; near = np.hypot(xx - px, yy - py) < R; want = near & (B | P)
    worst, at = 0, 0
    for a in np.linspace(a0, a1, 25):
        # inverse map: a pixel is covered by the turned part if turning it back by −a lands on the part
        c, s = np.cos(-a), np.sin(-a); sx = px + (xx - px) * c - (yy - py) * s; sy = py + (xx - px) * s + (yy - py) * c
        ix, iy = np.round(sx).astype(int), np.round(sy).astype(int); ok = (ix >= 0) & (iy >= 0) & (ix < B.shape[1]) & (iy < B.shape[0])
        T = np.zeros_like(B); T[ok] = P[iy[ok], ix[ok]]
        gap = int((want & ~(B | T)).sum())
        if gap > worst: worst, at = gap, a
    lim = max(4, int(0.03 * want.sum())); fail = worst > lim; bad += fail
    print(f"{'FAIL' if fail else 'ok  '} {name} {part}: worst gap {worst} px at {at:+.2f} rad (limit {lim}, joint area {int(want.sum())} px)")
sys.exit(2 if bad else 0)
