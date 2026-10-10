# the generator's soft glow around pixel-art props (semi-transparent haze) cleared: alpha snapped to 0 / 255 at a threshold
#   python3 tools/hardalpha.py [--t 120] art/gen/a.png ...
import sys; import numpy as np; from PIL import Image
args = sys.argv[1:]; t = 120
if args[:1] == ['--t']: t, args = int(args[1]), args[2:]
for p in args:
    a = np.array(Image.open(p).convert('RGBA')); a[..., 3] = np.where(a[..., 3] >= t, 255, 0); Image.fromarray(a).save(p); print(p)
