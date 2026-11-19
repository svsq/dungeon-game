# leftover chroma-key green in the heroes' parts: every opaque pixel with G > 70, G > 2.2 R, G > 2.5 B (the _w weight maps skipped)
#   python3 tools/measure/chars_menu/keygreen.py [DIR]   (DIR: live/assets by default, art/gen for the generated parts)
import glob, os, sys
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
for p in sorted(glob.glob(os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'live/assets', '*.png'))):
    n = os.path.basename(p)
    if not n.split('__')[0] in ('hero', 'mage', 'archer') or n.endswith('_w.png'): continue
    im = Image.open(p).convert('RGBA'); px = im.load(); w, h = im.size
    hits = [(x, y, px[x, y][:3]) for y in range(h) for x in range(w) if px[x, y][3] > 100 and px[x, y][1] > 70 and px[x, y][1] > 2.2 * px[x, y][0] and px[x, y][1] > 2.5 * px[x, y][2]]
    if hits: print(n, f'{w}x{h}', len(hits), hits[:16])
