"""Count the slot between the near arm and the torso in an owner composite of shoulder_owner.cjs (left half colour, right half owner):
python3 tools/measure/chars_style/slot_count.py OWNER.png ARM_RGB,... BODY_RGB BEHIND_RGB,... [Y0]
A slot pixel is owned by a behind part (cape, quiver) or by nothing, with an arm pixel within 16 owner px to its left and a body pixel
within 16 to its right in its row. Prints the count in world px² (owner px are 1/4 world px) and the rows it spans."""
import sys
import numpy as np
from PIL import Image
im = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int); W = im.shape[1] // 2; own = im[:, W:]
col = lambda s: [tuple(int(v) for v in c.split('/')) for c in s.split(',')]
arm, body, behind = col(sys.argv[2]), col(sys.argv[3]), col(sys.argv[4]) + [(0, 0, 0)]
isin = lambda px, cs: any(tuple(px) == c for c in cs)
Y0 = int(sys.argv[5]) if len(sys.argv) > 5 else 0
n, rows = 0, []
for y in range(Y0, own.shape[0]):
    for x in range(own.shape[1]):
        if not isin(own[y, x], behind): continue
        if any(isin(own[y, x - k], arm) for k in range(1, 17) if x - k >= 0) and any(isin(own[y, x + k], body) for k in range(1, 17) if x + k < W):
            n += 1; rows.append(y)
print(f'slot {n / 16:.1f} world px2, rows {min(rows) if rows else "-"}..{max(rows) if rows else "-"} of {own.shape[0]} (owner px, 4 per world px)')
