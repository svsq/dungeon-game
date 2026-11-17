# python3 tools/measure/chars_assets/artpixel.py: the size of one drawn "art pixel" in a texture (largest block k, at its best phase,
# whose block-mode rebuild keeps ≥ 85% of opaque pixels within |dRGB| 30), and that size on screen in the world (hero 84 px tall, a
# weapon/orb at its WEAPON/SHIELD length) and in the menu arch (×3.2)
import os, json, re; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
A = json.loads(re.sub(r'^window\.ASSETS = |;\s*$', '', open('live/assets.js').read().strip()))
# world length in px of the longest side (scene_hero.js WEAPON / SHIELD), the hero's texture by its 84 px height
L = {'it_sword_held': 42, 'it_staff_held': 42, 'it_wand_held': 40, 'orb_held_menu': 18, 'it_bow_s_h': 32, 'it_sword': 42, 'it_staff': 42, 'it_bow_s': 32, 'orb_held': 18, 'it_shield': 30, 'it_wand': 40}
def artpx(a):
    op = a[..., 3] > 128; c = a[..., :3].astype(int); best = 1
    for k in range(2, 13):
        ok = False
        for oy in range(0, k, max(1, k // 3)):
            for ox in range(0, k, max(1, k // 3)):
                H, W = (a.shape[0] - oy) // k * k, (a.shape[1] - ox) // k * k
                b = c[oy:oy + H, ox:ox + W]; o = op[oy:oy + H, ox:ox + W]
                ctr = b[k // 2::k, k // 2::k]; rb = np.repeat(np.repeat(ctr, k, 0), k, 1)
                if (np.abs(rb - b).sum(-1)[o] <= 30).mean() >= 0.85: ok = True; break
            if ok: break
        if ok: best = k
    return best
for n in [n for n in ['hero__body', 'hero__body_menu', 'archer__body_menu', 'mage__body_menu', 'mage__head_ci_menu', 'archer__quiver', 'it_sword', 'it_staff', 'it_bow_s', 'orb_held', 'it_shield', 'it_sword_held', 'it_staff_held', 'it_bow_s_h', 'orb_held_menu'] if os.path.exists(f'live/assets/{n}.png')]:
    a = np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')); k = artpx(a)
    wpt = 84 / 360 if '__' in n else L[n] / max(a.shape[:2])
    print(f'{n:22s} {a.shape[1]}x{a.shape[0]} art pixel {k} tex px = {k * wpt:.2f} world px = {k * wpt * 3.2:.1f} arch px')
