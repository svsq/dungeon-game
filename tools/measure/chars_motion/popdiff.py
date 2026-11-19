# python3 tools/measure/chars_motion/popdiff.py <sheet.png>... : frame-by-frame qashot sheets (--n N --from 0 --to N-1, 6 columns, the
# tile centred on the hero's feet): per step the count of pixels that change by more than 60 (sum of |dRGB|), and a spike ratio, that
# step against the larger of its two neighbours; a pop of a layer (an arm or a weapon over or under the body in one frame) is a step
# that changes many pixels while the steps around it change few. Prints steps with ratio >= 2 and count >= 40.
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB'); W, H = im.size; tw = W // 6; rows = H // tw; px = im.load()
    tiles = [(c * tw, r * tw) for r in range(rows) for c in range(6)]
    def diff(a, b):
        n = 0
        for y in range(tw):
            for x in range(tw):
                p, q = px[a[0] + x, a[1] + y], px[b[0] + x, b[1] + y]
                if abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2]) > 60: n += 1
        return n
    d = [diff(tiles[i - 1], tiles[i]) for i in range(1, len(tiles))]
    spikes = []
    for i, v in enumerate(d):
        nb = max(d[i - 1] if i > 0 else 0, d[i + 1] if i + 1 < len(d) else 0)
        if v >= 40 and v >= 2 * max(nb, 1): spikes.append(f'f{i}->f{i + 1}: {v} (x{v / max(nb, 1):.1f})')
    print(f.split('/')[-1].ljust(26), 'steps', ' '.join(str(v) for v in d))
    print(' ' * 26, 'spikes', '; '.join(spikes) or 'none')
