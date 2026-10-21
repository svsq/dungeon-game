# TASKS 127, rebuilt from art/old/bonefix/ so it can be re-run: the skeleton's bone was tan (p98 L 0.39 in game against floor 0.35)
# and goes light and cool so it stays the brightest thing near it under warm light; the spider's lilac shell goes cold blue-violet
# and darker, since orange light × lilac read as pink. Then run tools/rig_skeleton.sh and tools/rig_spider.py.
import numpy as np; from PIL import Image
SRC, DST = 'art/old/bonefix', 'art/gen'
load = lambda n: np.array(Image.open(f'{SRC}/{n}.png').convert('RGBA')).astype(float)
save = lambda a, n: Image.fromarray(a.clip(0, 255).round().astype(np.uint8)).save(f'{DST}/{n}.png')

def hls(a):
    rgb = a[..., :3] / 255; r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; mx, mn = rgb.max(-1), rgb.min(-1); L = (mx + mn) / 2
    S = np.where(mx > mn, (mx - mn) / (1 - abs(2 * L - 1) + 1e-6), 0); H = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    return H, L, S.clip(0, 1)

def rgb(H, L, S):
    C = (1 - abs(2 * L - 1)) * S; h = H / 60; X = C * (1 - abs(h % 2 - 1)); z = np.zeros_like(C); i = (h.astype(int) % 6)[..., None]
    lut = np.stack([np.stack(t, -1) for t in [(C, X, z), (X, C, z), (z, C, X), (z, X, C), (X, z, C), (C, z, X)]], 0)
    out = np.take_along_axis(lut.transpose(1, 2, 0, 3), i[..., None].repeat(3, -1), 2)[..., 0, :]; return (out + (L - C / 2)[..., None]) * 255

# skeleton: bone is the tan family outside the sword, bracer, shoulder pad and shield (their boxes from tools/rig_skeleton.sh)
a = load('en_skeleton'); H, L, S = hls(a); yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
seg = lambda x0, y0, x1, y1: np.abs((x1 - x0) * (y0 - yy) - (x0 - xx) * (y1 - y0)) / np.hypot(x1 - x0, y1 - y0)
sword = (seg(5, 78, 95, 176) < 15) & (xx < 112) & (yy < 200)
gear = sword | ((xx > 98) & (xx < 146) & (yy > 122) & (yy < 196)) | ((xx > 232) & (xx < 300) & (yy > 58) & (yy < 132)) \
       | (((xx - 338) / 54) ** 2 + ((yy - 190) / 80) ** 2 < 1)
bone = (a[..., 3] > 0) & ~gear & (H > 18) & (H < 52) & (S < 0.6) & (L > 0.24)
Lb = np.interp(L, [0.24, 0.32, 0.45, 0.6, 0.75], [0.36, 0.55, 0.74, 0.86, 0.92])
Hb = np.full_like(H, 42.0); Sb = np.interp(L, [0.24, 0.6, 0.75], [0.16, 0.22, 0.5])
a[..., :3] = np.where(bone[..., None], rgb(Hb, Lb, Sb), a[..., :3]); print('skeleton bone px', int(bone.sum())); save(a, 'en_skeleton')

for n in ['spider_parts_sheet', 'en_spider']:
    a = load(n); H, L, S = hls(a); shell = (a[..., 3] > 0) & ((H > 270) | (H < 4)) & (S > 0.08)
    a[..., :3] = np.where(shell[..., None], rgb((np.where(H < 4, H + 360, H) - 55) % 360, L * 0.82, S), a[..., :3])
    print(n, 'shell px', int(shell.sum())); save(a, n)
