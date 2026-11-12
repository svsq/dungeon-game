# bdiff.py a.png b.png: world-box (300-1500 x 130-880) difference of two frames of one state: share of px whose |dRGB| sum > 60, and mean |dL|.
# Flags an asset or light change in another biome between two commits (HUD outside the box).
import sys, numpy as np
from PIL import Image
a, b = (np.asarray(Image.open(f).convert('RGB')).astype(int)[130:880, 300:1500] for f in sys.argv[1:3])
d = np.abs(a - b).sum(2); print(f"{sys.argv[2].split('/')[-1]:22s} changed {(d > 60).mean() * 100:5.1f}%  mean|d| {d.mean():5.1f}")
