import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mage_small_r4 import ORB_AT  # noqa: E402
from sheet_r2 import BG, FG, FONT, arch_hero, big, nearest  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
OUT = ROOT / "frames/char_refs_r4/sheet_r4.png"
FACE = {"warrior": (22, 10, 40, 24), "mage": (24, 13, 42, 27), "archer": (25, 10, 43, 24)}
ORB_V2 = (601, 318)
ORB_CROP = 150
PICK = 4

ROWS = [
    ("warrior", "warrior_a_small", "warrior_a_small_r4", "warrior_a_v2", "menu"),
    ("mage", "mage_a_small", "mage_a_small_orb_r4", "mage_a_v4", "menu_continue_mage"),
    ("archer", "archer_a_small", "archer_a_small_r4", "archer_a", "menu_continue_archer"),
]


def rgb(name):
    return Image.open(REFS / f"{name}.png").convert("RGB")


def on_bg(name, colour=(26, 26, 36)):
    im = Image.open(REFS / f"{name}.png").convert("RGBA")
    base = Image.new("RGBA", im.size, colour + (255,))
    base.alpha_composite(im)
    return base.convert("RGB")


def class_cells(cls, r2, r4, std, arch):
    a, b = rgb(r2), rgb(r4)
    hero = arch_hero(arch)
    return [
        ("round 2 x1", a),
        ("round 2 x4", nearest(a, 4)),
        ("r4 x1", b),
        ("r4 x4", nearest(b, 4)),
        ("r4 face x8", nearest(b.crop(FACE[cls]), 8)),
        (f"standard: {std}", big(REFS / f"{std}.png")),
        ("in-game x1", hero),
        ("in-game x4", nearest(hero, 4)),
    ]


def orb_box(c):
    return (c[0] - ORB_CROP, c[1] - ORB_CROP, c[0] + ORB_CROP, c[1] + ORB_CROP)


def orb_cells():
    off = on_bg("mage_a_small_noorb_r4")
    on = rgb("mage_a_small_orb_r4")
    pair = Image.new("RGB", (2 * ORB_CROP * 2 + 10, ORB_CROP * 2), BG)
    pair.paste(rgb("mage_a_v2").crop(orb_box(ORB_V2)), (0, 0))
    pair.paste(rgb("mage_a_v4").crop(orb_box(ORB_V2)), (ORB_CROP * 2 + 10, 0))
    return [
        ("orb off x1", off),
        ("orb off x4", nearest(off, 4)),
        ("orb on x1", on),
        ("orb on x4", nearest(on, 4)),
        ("orb layer x8", nearest(on_bg("mage_orb_small_r4"), 8)),
        ("noorb alpha x4", nearest(on_bg("mage_a_small_noorb_r4", (60, 60, 70)), 4)),
        ("standard orb: v2 | v4 (x0.6)", pair),
    ]


def archer_cells():
    cells = []
    for n in range(1, 7):
        im = rgb(f"archer_a_small_r4_{n}")
        tag = " (picked)" if n == PICK else ""
        cells.append((f"cand {n}{tag} x4", nearest(im.crop((12, 8, 52, 56)), 4)))
    return cells


def archer_faces():
    cells = []
    for n in range(1, 7):
        im = rgb(f"archer_a_small_r4_{n}")
        cells.append((f"cand {n} x1", im))
        cells.append(("face x8", nearest(im.crop(FACE["archer"]), 8)))
    return cells


def main():
    rows = [(t, class_cells(t, r2, r4, std, arch)) for t, r2, r4, std, arch in ROWS]
    rows.insert(2, (f"mage: orb layer at {ORB_AT} (64x64), off/on; standard orb v2 vs v4", orb_cells()))
    rows.append(("archer: all r4 candidates (1-3 prompt a, 4-6 prompt b)", archer_cells()))
    rows.append(("archer candidates x1 and faces x8", archer_faces()))
    pad, lab = 14, 22
    cw = lambda label, im: max(im.width, round(FONT.getlength(label)))
    widths = [sum(cw(l, im) for l, im in cells) + pad * (len(cells) + 1) for _, cells in rows]
    heights = [max(im.height for _, im in cells) + lab * 2 + pad for _, cells in rows]
    sheet = Image.new("RGB", (max(widths), sum(heights) + pad), BG)
    d = ImageDraw.Draw(sheet)
    y = pad
    for (title, cells), h in zip(rows, heights):
        d.text((pad, y), title, fill=FG, font=FONT)
        x = pad
        for label, im in cells:
            d.text((x, y + lab), label, fill=FG, font=FONT)
            sheet.paste(im, (x, y + lab * 2))
            x += cw(label, im) + pad
        y += h
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(OUT, sheet.size)


if __name__ == "__main__":
    main()
