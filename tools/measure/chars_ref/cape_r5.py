# ref critic r5, remark 7 / task 2202: the warrior's cloak per direction from cape_r5.mjs: the cape layer alone against the empty scene,
# its height (rows), area, lowest row against the ground, mean Lab, and ΔE76 against the rest pose; also the visible cape (all vs no-cape)
import os, glob, json, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
import sys
D = os.path.join(ROOT, os.environ.get('REF_FRAMES', 'frames/critic_chars_r5_ref') + '/' + (sys.argv[1] if len(sys.argv) > 1 else 'cape'))
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = c @ M.T / np.array([0.9505, 1, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def load(n, k): return np.asarray(Image.open(os.path.join(D, f'{n}__{k}.png')).convert('RGB')).astype(float)
def meas(n):
    none, cape, al = load(n, 'none'), load(n, 'cape'), load(n, 'all')
    m = np.abs(cape - none).sum(2) > 24; vis = m & (np.abs(al - cape).sum(2) < 6)
    if not m.any(): return None
    ys, xs = np.where(m); L = lab(cape[m]).mean(0); vy = np.where(vis)[0]
    return dict(area=int(m.sum()), top=int(ys.min()), bot=int(ys.max()), h=int(ys.max() - ys.min() + 1), w=int(xs.max() - xs.min() + 1), vis=int(vis.sum()), visbot=int(vy.max()) if len(vy) else -1, lab=[round(v, 1) for v in L])
if __name__ == '__main__':
    res = {}
    for f in sorted(glob.glob(os.path.join(D, '*__cape.png'))):
        n = os.path.basename(f)[:-10]; res[n] = meas(n)
    for kit in ['def', 'plate']:
        r0 = res[f'{kit}_rest']; print(f'== {kit} rest', r0); print(f'   rest_l', res[f'{kit}_rest_l'])
        for d in ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur']:
            for ph, fr in [('walk', [3, 6, 9]), ('run', [30, 34, 38, 42, 46])]:
                rs = [res.get(f'{kit}_{ph}_{d}_{f}') for f in fr]; rs = [r for r in rs if r]
                if not rs: print(kit, d, ph, 'no cape'); continue
                dE = [float(np.linalg.norm(np.array(r['lab']) - np.array(r0['lab']))) for r in rs]
                print(f'{kit:5} {d:2} {ph:4} h {min(r["h"] for r in rs)}-{max(r["h"] for r in rs)} (rest {r0["h"]}) bot {min(r["bot"] for r in rs)}-{max(r["bot"] for r in rs)} (rest {r0["bot"]}) area {min(r["area"] for r in rs)}-{max(r["area"] for r in rs)} (rest {r0["area"]}) vis {min(r["vis"] for r in rs)}-{max(r["vis"] for r in rs)} (rest {r0["vis"]}) dE {min(dE):.1f}-{max(dE):.1f} lab {rs[-1]["lab"]}')
    json.dump(res, open(os.path.join(D, 'cape_r5.json'), 'w'), indent=1)
