import os, sys
from PIL import Image, ImageDraw
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
REF = os.path.join(ROOT, 'study/refs/ref_town.png')
# same-scale pairs (ref hero ~81 px, game hero ~84 px): ref box | game box on zone_town, each blown up 2x with hard pixels
PAIRS = [('merchant', (400, 270, 600, 420), (640, 205, 820, 365)), ('stairs', (680, 200, 850, 360), (920, 190, 1180, 340)),
  ('forge', (890, 230, 1090, 380), (1330, 200, 1510, 350)), ('enchanter', (950, 390, 1140, 530), (1310, 370, 1510, 530)),
  ('altar', (920, 570, 1160, 700), (1280, 610, 1480, 730)), ('portal', (400, 570, 580, 710), (590, 560, 790, 730)),
  ('adit', (1270, 450, 1470, 610), (1570, 550, 1790, 730)), ('fire_tree', (680, 380, 960, 560), (930, 360, 1230, 560))]
frame = sys.argv[1]; out = sys.argv[2]; os.makedirs(out, exist_ok=True)
ref = Image.open(REF).convert('RGB'); g = Image.open(frame).convert('RGB')
for k, rb, gb in PAIRS:
  a = ref.crop(rb); b = g.crop(gb); a = a.resize((a.width * 2, a.height * 2), Image.NEAREST); b = b.resize((b.width * 2, b.height * 2), Image.NEAREST)
  s = Image.new('RGB', (a.width + b.width + 20, max(a.height, b.height)), (60, 60, 60)); s.paste(a, (0, 0)); s.paste(b, (a.width + 20, 0)); s.save(os.path.join(out, k + '.png'))
