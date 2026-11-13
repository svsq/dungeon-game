import sys, os
from PIL import Image
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
# usage: crop.py src.png x0 y0 x1 y1 out.png [scale]
src, x0, y0, x1, y1, out = sys.argv[1:7]
k = int(sys.argv[7]) if len(sys.argv) > 7 else 2
p = lambda s: s if os.path.isabs(s) else os.path.join(ROOT, s)
im = Image.open(p(src)).convert('RGB').crop((int(x0), int(y0), int(x1), int(y1)))
im.resize((im.width * k, im.height * k), Image.NEAREST).save(p(out))
print(out, im.size)
