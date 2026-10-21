# hero tone (TASKS 166): the concept's hero is steel with dark brown hair and a deep crimson cape, red nowhere else: the plate
# torso's red tabard flap becomes dark steel, the orange hair dark brown (#5a3220) and the bright red cape and scarf deep crimson.
# Rebuilds from art/old/herotone/ so it can be re-run
import os, shutil, numpy as np; from PIL import Image
SRC, DST = 'art/old/herotone', 'art/gen'
# the *_w files are the soft-bone weight maps of the same parts, not art: they keep their values
NAMES = [n[:-4] for n in os.listdir(DST) if n.endswith('.png') and not n.endswith('_w.png') and (n.startswith('hero__body') or n.startswith('hero__cape'))]
for n in NAMES:
    if not os.path.exists(f'{SRC}/{n}.png'): shutil.copy(f'{DST}/{n}.png', f'{SRC}/{n}.png')
for n in NAMES:
    a = np.array(Image.open(f'{SRC}/{n}.png').convert('RGBA')).astype(float); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    f = a[..., :3] / 255; mx, mn = f.max(-1), f.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    H, W = al.shape; ys, xs = np.mgrid[0:H, 0:W]; lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
    top = np.where((al > 0).any(1))[0][0]
    red = (al > 0) & (r > 60) & (r > g * 2.0) & (r > b * 2.0)
    if n in ('hero__body', 'hero__body_nh'):
        flap = red & (ys > 155) & (ys < 222) & (xs > 84) & (xs < 138)
        a[flap, :3] = np.array([0.36, 0.38, 0.46])[None] * np.clip(0.5 + 1.6 * lum[flap], 0.3, 1.5)[:, None] * 255
        red &= ~flap
    # crimson in hue and chroma only: the concept's cape is as light as the painted one (p50 0.39)
    deep = a[red, :3] * np.array([0.7, 0.55, 0.6])[None]; l0 = lum[red] * 255; l1 = deep @ np.array([0.3, 0.59, 0.11])
    a[red, :3] = deep * np.clip(l0 / np.maximum(l1, 1), 1, 2.2)[:, None]
    if n.startswith('hero__body') and '_nh' not in n and '_hd' not in n:
        hair = (al > 0) & (ys < top + (80 if 'back' in n else 46)) & (r > g * 1.15) & (r < g * 3.2) & (g > b * 0.95) & (s > 0.25)
        a[hair, :3] = np.array([0x5a, 0x32, 0x20], float)[None] / 255 * np.clip(0.45 + 1.2 * lum[hair], 0.3, 1.6)[:, None] * 255
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{DST}/{n}.png')
print('toned', len(NAMES), 'parts')
