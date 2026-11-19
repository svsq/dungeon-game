"""crop the hero out of a qashot contact sheet (cells of BOX·zoom px, the hero at the cell's centre, 0.7 down) into one strip
  python3 tools/measure/crop_hero_2146.py SHEET OUT [--w 300] [--h 360] [--n 6] [--k 1]"""
import argparse
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('--cell', type=int, default=780)
ap.add_argument('--w', type=int, default=300); ap.add_argument('--h', type=int, default=380); ap.add_argument('--n', type=int, default=12); ap.add_argument('--k', type=float, default=1)
a = ap.parse_args(); im = Image.open(a.sheet).convert('RGB'); cols = im.width // a.cell; rows = im.height // a.cell; cells = []
for i in range(min(a.n, cols * rows)):
    cx, cy = (i % cols) * a.cell + a.cell // 2, (i // cols) * a.cell + int(a.cell * 0.7)
    cells.append(im.crop((cx - a.w // 2, cy - a.h + 40, cx + a.w // 2, cy + 40)))
out = Image.new('RGB', (a.w * len(cells), a.h)); [out.paste(c, (i * a.w, 0)) for i, c in enumerate(cells)]
if a.k != 1: out = out.resize((round(out.width * a.k), round(out.height * a.k)), Image.NEAREST)
out.save(a.out)
