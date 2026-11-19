# python3 tools/measure/chars_assets/backhair.py: (r2) the hair cap's colour seen from the front and from behind for each hero and helmless
# back texture: mean Lab of the opaque pixels in the top 30 rows of each texture (scalp and hair, above the face), and ΔE front→back
import os; import numpy as np; from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T / [0.9505, 1, 1.089]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def cap(n, rows=30):
    a = np.array(Image.open(f'live/assets/{n}.png').convert('RGBA')).astype(float)[:rows]; op = a[..., 3] > 128
    return lab(a[..., :3][op]).mean(0)
if __name__ == '__main__':
  for rig, front, back in [('hero', 'hero__body', 'hero__body_back'), ('archer', 'archer__body', 'archer__body_back'), ('mage', 'mage__body', 'mage__body_back'),
                         ('mage circlet', 'mage__head_ci', 'mage__head_back_ci')]:
    f, b = cap(front), cap(back)
    print(f'{rig:13s} front {front:16s} Lab {f.round(1)}  back {back:20s} Lab {b.round(1)}  dE {np.linalg.norm(f - b):.1f}')
