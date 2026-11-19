"""Crop a frame and blow it up by nearest neighbour: python3 tools/measure/chars_style/crop.py IN.png OUT.png X0 Y0 X1 Y1 K
Paths are relative to the repo root (ROOT or three levels above this script)."""
import os
import sys
from PIL import Image

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1, k = (int(v) for v in sys.argv[3:8])
im = Image.open(os.path.join(ROOT, src)).convert('RGB').crop((x0, y0, x1, y1))
im.resize((im.width * k, im.height * k), Image.NEAREST).save(os.path.join(ROOT, out))
