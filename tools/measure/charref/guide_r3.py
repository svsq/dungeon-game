import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
GEN2 = ROOT / "frames/char_refs_r2/gen"
GEN3 = ROOT / "frames/char_refs_r3/gen"
BG = (26, 26, 36)
FEET_Y = 51
SCALE = 16


def figure_box(a):
    ys, xs = np.where(np.abs(a - a[0, 0]).sum(-1) > 30)
    return ys.min(), ys.max(), xs.min(), xs.max()


def place(src, dst, native=False):
    a = np.asarray(Image.open(src).convert("RGB")).astype(int)
    y0, y1, x0, x1 = figure_box(a)
    out = np.zeros((64, 64, 3), np.uint8) + np.array(BG, np.uint8)
    fig = a[y0:y1 + 1, x0:x1 + 1]
    top, left = FEET_Y - (y1 - y0), 32 - (x1 - x0 + 1) // 2
    out[top:top + fig.shape[0], left:left + fig.shape[1]] = fig
    out[np.abs(out.astype(int) - BG).sum(-1) <= 30] = BG
    im = Image.fromarray(out)
    (im if native else im.resize((64 * SCALE, 64 * SCALE), Image.NEAREST)).save(dst)
    return y1 - y0 + 1


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print("archer small h", place(GEN3 / f"nat_archer_{sys.argv[1]}.png", ROOT / "art/char_refs/archer_a_small_3.png", True))
        sys.exit()
    GEN3.mkdir(parents=True, exist_ok=True)
    print("archer guide h", place(GEN2 / "h40_archer_a_3.png", GEN3 / "guide_archer_a_h40.png"))
    print("warrior scale h", place(ROOT / "art/char_refs/warrior_a_small_1.png", GEN3 / "scale_warrior_a.png"))
