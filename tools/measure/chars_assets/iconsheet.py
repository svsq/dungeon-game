# python3 tools/measure/chars_assets/iconsheet.py: the nine ability icons and three portraits side by side, each at the size the HUD
# shows (icons 64 px, portraits 128 px) and at 256 px; plus the icons' opaque bbox, border share and mean Lab L of their centre
import os; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
O = os.environ.get('OUTD', 'frames/critic_chars_r2_assets/'); os.makedirs(O, exist_ok=True)
AB = ['ab_whirl', 'ab_charge', 'ab_cry', 'ab_fire', 'ab_shield', 'ab_frost', 'ab_volley', 'ab_trap', 'ab_leap']
def sheet(names, sz, out):
    S = Image.new('RGBA', (sz * len(names), sz), (32, 32, 32, 255))
    for i, n in enumerate(names): im = Image.open(f'live/assets/{n}.png').convert('RGBA').resize((sz, sz), Image.BOX); S.alpha_composite(im, (i * sz, 0))
    S.save(O + out)
sheet(AB, 64, 'icons64.png'); sheet(AB, 200, 'icons200.png'); sheet(['portrait', 'portrait_archer', 'portrait_mage'], 256, 'portraits256.png')
for n in AB:
    a = np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float); al = a[..., 3]; h, w = al.shape
    ys, xs = np.nonzero(al > 60); c = a[h // 4:3 * h // 4, w // 4:3 * w // 4, :3].mean((0, 1))
    print(f'{n:10s} {w}x{h} opaque bbox {xs.min()},{ys.min()}..{xs.max()},{ys.max()} opaque share {(al > 60).mean():.2f} centre RGB {c.round()} unique colours {len(np.unique(a.reshape(-1, 4), axis=0))}')
