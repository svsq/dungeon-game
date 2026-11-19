# python3 tools/measure/chars_assets/halo_r5b.py BASE_REV names...: for each live/assets texture changed since BASE_REV: semi-alpha px
# (0 < a < 255), orphan opaque px (no opaque 4-neighbour), interior holes (transparent px with >= 3 opaque 4-neighbours), old vs new.
import sys, io, subprocess, numpy as np
from PIL import Image
def stat(b):
    a = np.asarray(Image.open(io.BytesIO(b)).convert('RGBA'))[..., 3].astype(int); o = a > 127
    p = np.pad(o, 1); n = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
    return ((a > 0) & (a < 255)).sum(), (o & (n == 0)).sum(), (~o & (n >= 3)).sum()
rev = sys.argv[1]
for f in sys.argv[2:]:
    try: old = stat(subprocess.run(['git', 'show', f'{rev}:{f}'], capture_output=True, check=True).stdout)
    except subprocess.CalledProcessError: old = ('-',) * 3
    new = stat(open(f, 'rb').read())
    flag = '  <<' if old[0] != '-' and (new[1] > old[1] or new[2] > old[2] or new[0] > old[0] + 20) else ''
    print(f'{f.split("/")[-1]:34s} semi {old[0]}->{new[0]}  orphan {old[1]}->{new[1]}  holes {old[2]}->{new[2]}{flag}')
