"""Small ref beside the in-game crop at one figure height: python3 tools/measure/chars_style/refpair.py OUT.png ZOOMDIR
For each class: the 64x64 small ref of art/char_refs/ blown up by nearest neighbour so its figure (rows 12..51, 40 px) is as tall
as the hero in ZOOMDIR/<state>.png (qashot --focus hero --zoom 4), then the crop itself."""
import os
import sys
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
out, zdir = sys.argv[1], sys.argv[2]
PAIRS = [('warrior_a_small_r4', 'mage_warrior'), ('archer_a_small_r4', 'archer_front'), ('mage_a_small_noorb_r4', 'mage_front')]
FIG = 40
tiles = []
for ref, state in PAIRS:
    crop = Image.open(os.path.join(ROOT, zdir, state + '.png')).convert('RGB')
    k = float(os.environ.get('HERO_PX', 336)) / FIG
    r = Image.open(os.path.join(ROOT, 'art/char_refs', ref + '.png')).convert('RGBA')
    bg = Image.new('RGBA', r.size, (26, 26, 36, 255)); bg.alpha_composite(r)
    r = bg.convert('RGB').resize((round(64 * k), round(64 * k)), Image.NEAREST)
    tiles += [r, crop]
H = max(t.height for t in tiles)
sheet = Image.new('RGB', (sum(t.width for t in tiles), H), (34, 34, 34))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0)); x += t.width
sheet.save(os.path.join(ROOT, out))
