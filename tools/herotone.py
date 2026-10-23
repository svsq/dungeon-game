# hero tone (TASKS 166): the concept's hero is steel with dark brown hair and a deep crimson cape, red nowhere else: the plate
# torso's red tabard flap becomes dark steel, the orange hair dark brown (#5a3220) and the bright red cape and scarf deep crimson.
# Rebuilds from art/old/herotone/ so it can be re-run, which silently overwrites any later hand edit of art/gen/hero__body*
# and hero__cape*: edit the originals in art/old/herotone/ instead, or delete them there to make the current art the new source
import os, shutil, numpy as np; from PIL import Image
SRC, DST = 'art/old/herotone', 'art/gen'
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
def oklab(c): c = c / 255; return np.cbrt(np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92) @ M1.T) @ M2.T
def srgb(lab): c = np.clip((lab @ np.linalg.inv(M2).T) ** 3 @ np.linalg.inv(M1).T, 0, 1); return 255 * np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
# the *_w files are the soft-bone weight maps of the same parts, not art: they keep their values
NAMES = [n[:-4] for n in os.listdir(DST) if n.endswith('.png') and not n.endswith('_w.png') and (n.startswith('hero__body') or n.startswith('hero__cape'))] + ['hero__head_kn']
# the face on the world's art grid (TASKS 197): the hero is 42 art px tall, so one cell of the 360-px rig is 360 / 42 px and draws
# as one world pixel (scene.js keeps the cells on it). Painted 1-2 px eyes melted into the skin there; here each cell of the face
# is one flat skin tone (lit, or the shade on the ear side) and the two eyes are a whole dark cell each, either side of the nose
CELL = 360 / 42
SKIN, SHADE, EYE = np.array([0xe8, 0xc8, 0xa8], float), np.array([0xb8, 0x84, 0x66], float), np.array([0x1c, 0x10, 0x0c], float)
FIX = {(6, 13): EYE, (6, 14): SKIN, (6, 15): EYE}   # the eyes and the bridge of the nose between them, whatever the paint there
def face(a):
    for r in (6, 7, 8):
        for c in range(11, 17):
            y0, y1, x0, x1 = round(r * CELL), round((r + 1) * CELL), round(c * CELL), round((c + 1) * CELL)
            q = a[y0:y1, x0:x1]; f = q[..., :3] / 255; mx, mn = f.max(-1), f.min(-1)
            skin = (q[..., 3] > 128) & (mx > 0.55) & (f[..., 0] > f[..., 2] * 1.2) & ((mx - mn) / np.maximum(mx, 1e-6) > 0.15)
            if (r, c) in FIX and skin.mean() > 0.2: q[..., :3] = FIX[r, c]; q[..., 3] = 255
            elif skin.mean() > 0.5: q[..., :3] = SHADE if c <= 12 else SKIN; q[..., 3] = 255
# the knight's helm on the same grid (TASKS 197): under the light its silver dome read as a white cap and its visor slit, painted
# across a cell border, was lost. Each cell is one flat tone: brass stays brass, steel takes three steps, the slit is one row of
# ink and the face plate below it is the dark steel
STEEL = [np.array(v, float) for v in ((0x25, 0x25, 0x34), (0x6b, 0x5c, 0x56), (0xc8, 0xc8, 0xd0))]
BRASS, INK = [np.array(v, float) for v in ((0x6e, 0x4c, 0x1e), (0xa8, 0x7c, 0x34))], np.array([6, 5, 6], float)
def helm(a):
    for r in range(0, 10):
        for c in range(5, 20):
            y0, y1, x0, x1 = round(r * CELL), round((r + 1) * CELL), round(c * CELL), round((c + 1) * CELL)
            q = a[y0:y1, x0:x1]; on = q[..., 3] > 128
            if on.mean() < 0.5: continue
            lab = oklab(q[..., :3][on]).mean(0); L, C, h = lab[0], np.hypot(lab[1], lab[2]), np.degrees(np.arctan2(lab[2], lab[1])) % 360
            if C > 0.08 and (h < 40 or h > 340): continue                       # the cape at the collar
            if L < 0.25: col = INK
            elif C > 0.05 and 50 < h < 110: col = BRASS[int(L > 0.62)]
            elif r == 5 and 11 <= c <= 16: col = INK
            elif r >= 6: col = STEEL[0]
            else: col = STEEL[0 if L < 0.5 else 1 if L < 0.78 else 2]
            q[on, :3] = col
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
    # crimson in OKLab: chroma × 0.78 at 27°, and darker by L × 0.72 (TASKS 196, 197): the hero's lantern lifts the cape as much as
    # his steel, and at its painted lightness it read salmon in the frame (L 0.53 against the concept's 0.37, now 0.41)
    lab = oklab(a[red, :3]); C = 0.78 * np.hypot(lab[:, 1], lab[:, 2]); h = np.radians(27)
    a[red, :3] = srgb(np.stack([0.72 * lab[:, 0], C * np.cos(h), C * np.sin(h)], -1))
    if n.startswith('hero__body') and '_nh' not in n and '_hd' not in n:
        hair = (al > 0) & (ys < top + (80 if 'back' in n else 46)) & (r > g * 1.15) & (r < g * 3.2) & (g > b * 0.95) & (s > 0.25)
        a[hair, :3] = np.array([0x5a, 0x32, 0x20], float)[None] / 255 * np.clip(0.45 + 1.2 * lum[hair], 0.3, 1.6)[:, None] * 255
    if n.startswith('hero__body') and 'back' not in n and '_nh' not in n: face(a)
    if n == 'hero__head_kn': helm(a)
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'{DST}/{n}.png')
print('toned', len(NAMES), 'parts')
