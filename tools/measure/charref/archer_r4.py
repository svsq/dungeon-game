import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from guide_r3 import place  # noqa: E402
from snap_small import snap  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
GEN = ROOT / "frames/char_refs_r4/gen"
REFS = ROOT / "art/char_refs"
GRID = 16
HEIGHT = 40


def native(n):
    raw = GEN / f"charref4_archer_a_small_{n}.png"
    nat = GEN / f"nat_archer_{n}.png"
    k, _ = snap(raw, nat)
    forced = abs(k - GRID) > 0.25
    if forced:
        k, _ = snap(raw, nat, HEIGHT)
    h = place(nat, REFS / f"archer_a_small_r4_{n}.png", True)
    return k, forced, h


if __name__ == "__main__":
    for n in range(1, 7):
        k, forced, h = native(n)
        print(n, "grid", round(k, 3), "forced to 40" if forced else "on grid", "height", h)
