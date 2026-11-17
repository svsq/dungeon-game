"""the mage's heads under every outfit and helm (TASKS 2151): in the world his head is the small reference's on the grid (regen_2146.py),
so a helm there is that grid head with the helm in grid cells, drawn over a headless body like every class's helm; the drawn heads
the cut wrote (gear.py cut mage_circlet mage_helm_le) stay for the arch as head_<h>_menu, over body*_nh(_menu)
  python3 tools/gear.py cut mage_circlet mage_helm_le && python3 tools/measure/mageheads_2151.py   (it reads the drawn heads the cut just wrote)
The grid beard hangs below the body's head row onto the chest, where the leather armour was painted over it: it comes back on body_le."""
import os; import numpy as np; from PIL import Image
G = os.environ.get('GEN', 'art/gen') + '/mage__'
C, HEAD = 360 / 42, 64
BEARD = {7: [5, 6, *range(9, 15)], 8: [5, 6, *range(9, 15)], 9: range(10, 15), 10: range(12, 15)}   # grid cells of the ponytail, chin and beard under the head row
load = lambda n: np.array(Image.open(G + n + '.png').convert('RGBA'))
save = lambda a, n: Image.fromarray(a).save(G + n + '.png')

def cells(rows, cols, rgb, dst):
    for r, c in ((r, c) for r in rows for c in cols):
        dst[round(r * C):round((r + 1) * C), round(c * C):round((c + 1) * C)] = (*rgb, 255)

body = load('body'); head = np.zeros_like(body); head[:HEAD] = body[:HEAD]
for r, cols in BEARD.items():
    for c in cols:
        ys, xs = slice(max(HEAD, round(r * C)), round((r + 1) * C)), slice(round(c * C), round((c + 1) * C)); head[ys, xs] = body[ys, xs]
beard = head.copy(); beard[:HEAD] = 0

nh = body.copy(); nh[:HEAD] = 0; save(nh, 'body_nh')
le = load('body_le'); m = beard[..., 3] > 0; le[m] = beard[m]; save(le, 'body_le')

def on_grid(a):
    g = a.copy()
    for r in range(int(HEAD / C) + 1):
        for c in range(int(a.shape[1] / C) + 1):
            y, x = round(r * C), round(c * C); g[y:round((r + 1) * C), x:round((c + 1) * C)] = a[min(y, a.shape[0] - 1), min(x, a.shape[1] - 1)]
    return np.array_equal(g[:HEAD], a[:HEAD])
for h in ('ci', 'le'):   # (a second run finds its own grid head there and keeps the drawn one)
    if not on_grid(load('head_' + h)): save(load('head_' + h), 'head_' + h + '_menu')
ci = head.copy()
cells([3], range(7, 13), (0xcc, 0x73, 0x27), ci); cells([3], range(8, 13, 2), (0xdf, 0x87, 0x26), ci); cells([3], [13], (0x5a, 0xa8, 0xe8), ci)
save(ci, 'head_ci')
# the leather helm in grid cells (the drawn head_le_menu's leather and brass, darker and yellower: under the torch the leather in its
# own tones read as the face's skin): a cap over the crown with a riveted strap, the brass
# brow band one cell over the eye's row, a cheek flap over the ear; the face, beard and ponytail stay the grid head's
TONE = {'o': (0x1c, 0x06, 0x06), 's': (0x38, 0x18, 0x10), 'm': (0x4c, 0x26, 0x1a), 'l': (0x66, 0x36, 0x22), 'b': (0xc0, 0x9c, 0x58), 'B': (0xec, 0xd0, 0x88)}
CAP = ['     ooo   ',
       '   osmBmlo ',
       '  osmmbllmo',
       ' ossmmBmlmo',
       ' obbBbbBbbo',
       ' osms      ',
       '  osmo     ',
       '    o      ']
le = head.copy()
for r, line in enumerate(CAP):
    for i, ch in enumerate(line):
        if ch != ' ': cells([r], [5 + i], TONE[ch], le)
save(le, 'head_le')
