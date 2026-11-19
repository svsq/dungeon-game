import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from face_small import HEADS  # noqa: E402
from orb_r3 import V2_ORB  # noqa: E402
from sheet_r2 import BG, FG, FONT, arch_hero, big, nearest  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
OUT = ROOT / "frames/char_refs_r3/sheet_r3.png"
ORB_AT = (37, 23)
ORB_CROP = 150

ROWS = [
    ("warrior", "warrior_a_small_1", "warrior_a_v2", "menu"),
    ("mage", "mage_a_small_2", "mage_a_v3", "menu_continue_mage"),
    ("archer", "archer_a_small_1", "archer_a", "menu_continue_archer"),
]


def rgb(name):
    return Image.open(REFS / f"{name}.png").convert("RGB")


def face_crop(im, cls):
    x0, y0 = HEADS[cls]["at"]
    return nearest(im.crop((x0 - 2, y0 - 2, x0 + 11, y0 + 12)), 8)


def class_cells(cls, r2, std, arch):
    v3 = rgb(f"{cls}_a_small_v3")
    return [
        (f"round 2 ({r2[-1]}) x4", nearest(rgb(r2), 4)),
        ("v3 x1", v3),
        ("v3 x4", nearest(v3, 4)),
        ("v3 face x8", face_crop(v3, cls)),
        (f"standard: {std}", big(REFS / f"{std}.png")),
        ("current hero x1", arch_hero(arch)),
        ("current x4", nearest(arch_hero(arch), 4)),
    ]


def orb_cells():
    off = rgb("mage_a_small_v3")
    orb = Image.open(REFS / "mage_orb_small.png").convert("RGBA")
    on = off.convert("RGBA")
    on.alpha_composite(orb, ORB_AT)
    on = on.convert("RGB")
    bgimg = Image.new("RGBA", orb.size, BG + (255,))
    bgimg.alpha_composite(orb)
    noorb = Image.open(REFS / "mage_a_small_noorb_v3.png").convert("RGBA")
    checker = Image.new("RGBA", noorb.size, (60, 60, 70, 255))
    checker.alpha_composite(noorb)
    ox, oy, _ = V2_ORB
    box = (ox - ORB_CROP, oy - ORB_CROP, ox + ORB_CROP, oy + ORB_CROP)
    return [
        ("orb off x4", nearest(off, 4)),
        ("orb on x4", nearest(on, 4)),
        ("orb on x1", on),
        ("orb layer x8", nearest(bgimg.convert("RGB"), 8)),
        ("noorb alpha x4", nearest(checker.convert("RGB"), 4)),
        ("v2 orb", rgb("mage_a_v2").crop(box)),
        ("v3 orb (x0.6)", rgb("mage_a_v3").crop(box)),
    ]


def main():
    rows = [(t, class_cells(t, r2, std, arch)) for t, r2, std, arch in ROWS]
    rows.insert(2, ("mage: orb layer, v2 vs v3 standard orb", orb_cells()))
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
