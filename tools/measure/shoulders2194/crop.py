#!/usr/bin/env python3
"""python3 tools/measure/shoulders2194/crop.py OUT.png BEFORE.png AFTER.png [x0,y0,x1,y1] [K]: the arch's near shoulder of two frames
side by side, blown up K times (default the mage in the 1920x1080 arch, x9)"""
import sys
from PIL import Image
out, a, b = sys.argv[1:4]
box = tuple(int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '815,540,905,680').split(',')); K = int(sys.argv[5]) if len(sys.argv) > 5 else 9
ims = [Image.open(p).convert('RGB').crop(box) for p in (a, b)]
ims = [i.resize((i.width * K, i.height * K), Image.NEAREST) for i in ims]
o = Image.new('RGB', (ims[0].width * 2 + 12, ims[0].height), (255, 0, 255)); o.paste(ims[0], (0, 0)); o.paste(ims[1], (ims[0].width + 12, 0)); o.save(out)
