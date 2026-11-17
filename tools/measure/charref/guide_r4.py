import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from guide_r3 import GEN2, place  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
GEN4 = ROOT / "frames/char_refs_r4/gen"

if __name__ == "__main__":
    GEN4.mkdir(parents=True, exist_ok=True)
    print("guide a (r2 shrink) h", place(GEN2 / "h40_archer_a_3.png", GEN4 / "guide_archer_shrink.png"))
    print("guide b (r3 raw) h", place(REFS / "archer_a_small_3.png", GEN4 / "guide_archer_r3raw.png"))
    print("warrior scale h", place(REFS / "warrior_a_small.png", GEN4 / "scale_warrior_a.png"))
