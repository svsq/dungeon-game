# a row of the same box cut from several frames, side by side, k× with hard pixels: sheet.py <out.png> <x0> <y0> <x1> <y1> <k> <in.png>...
import sys
from PIL import Image
out, x0, y0, x1, y1, k, ins = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7:]
w, h = (x1 - x0) * k, (y1 - y0) * k
S = Image.new('RGB', (w * len(ins), h), (20, 20, 20))
for i, p in enumerate(ins):
    S.paste(Image.open(p).convert('RGB').crop((x0, y0, x1, y1)).resize((w, h), Image.NEAREST), (i * w, 0))
S.save(out)
