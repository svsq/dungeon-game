# clip.py png...: channel clipping on an actor crop (act_*.png from actors.js): among saturated red px (R > G + 40), the share with R >= 250
# (detail flattened by a strong tint) and the number of distinct colours among them (shading steps left).
import sys, numpy as np
from PIL import Image
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB')).astype(int).reshape(-1, 3); m = a[:, 0] > a[:, 1] + 40
    r = a[m]; print(f"{f.split('/')[-1]:28s} red px {m.sum():5d}  R>=250 {(r[:,0]>=250).mean()*100:5.1f}%  colours {len({tuple(x) for x in r})}")
