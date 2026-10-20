# TASKS 128: the trap spikes drawn on the art grid (saved ×8). A generated spike shrunk to 5–7 art px wide came out a smooth
# cone with no outline; at this size every pixel is a decision, so they are placed by hand: a stepped pyramid, lit left face,
# dark right face, a cream tip and a 1-px ink outline
import numpy as np; from PIL import Image
INK, HI, LT, MD, DK, BL = (20, 18, 26), (238, 214, 138), (176, 172, 168), (112, 110, 120), (58, 56, 72), (115, 20, 13)

def spike(w, h, name, blood):
    c = w // 2; a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        hw = round(y * (c - 1) / (h - 2)) if y < h - 1 else c - 1
        for x in range(c - hw - 1, c + hw + 2):
            col = INK if abs(x - c) > hw or y == h - 1 else HI if y < 3 and x <= c else LT if x < c else MD if x == c else DK
            a[y, x] = (*col, 255)
    for (x, y) in blood: a[y, x, :3] = BL
    # the tip pixel gets its own outline above it, so it doesn't fade into a lit floor
    top = np.zeros((1, w, 4), np.uint8); top[0, c] = (*INK, 255); a = np.vstack([top, a])
    Image.fromarray(a).resize((w * 8, (h + 1) * 8), Image.NEAREST).save(f'art/gen/{name}.png'); print(name, w, h + 1)

spike(7, 11, 'trap_spike', [(4, 4), (4, 5)])
spike(5, 8, 'trap_spike_s', [(2, 4)])
