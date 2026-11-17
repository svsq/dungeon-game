import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
OUT = ROOT / "frames/char_refs_r2/sheet_r2.png"
BG = (20, 20, 28)
FG = (225, 220, 205)
BIG_H = 300
GAME_H = 38
ARCH_BOX = (790, 455, 1010, 750)
ARCH_FIG_H = 280
FONT = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)

ROWS = [
    ("warrior", "warrior_a", "warrior_a_v2", "warrior_a", "menu"),
    ("mage", "mage_a", "mage_a_v2", "mage_a", "menu_continue_mage"),
    ("archer", "archer_a", None, "archer_a", "menu_continue_archer"),
    ("archer_b (2148)", "archer_b", "archer_b_v2", None, None),
]


def big(path):
    im = Image.open(path).convert("RGB")
    return im.resize((round(im.width * BIG_H / im.height), BIG_H), Image.LANCZOS)


def nearest(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def arch_hero(name):
    crop = Image.open(ROOT / f"frames/char_refs_current/{name}.png").convert("RGB").crop(ARCH_BOX)
    s = GAME_H / ARCH_FIG_H
    return crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)


def row_cells(r1, v2, small, arch, picks):
    refs = ROOT / "art/char_refs"
    cells = [(f"round 1: {r1}", big(refs / f"{r1}.png"))]
    if v2:
        cells.append((f"round 2: {v2}", big(refs / f"{v2}.png")))
    if small:
        for i in (1, 2):
            p = refs / f"{small}_small_{i}.png"
            if not p.exists():
                continue
            im = Image.open(p).convert("RGB")
            tag = " (picked)" if picks.get(small) == i else ""
            cells.append((f"small {i}{tag}: x1", im))
            cells.append((f"small {i}{tag}: x4", nearest(im, 4)))
    if arch:
        hero = arch_hero(arch)
        cells.append(("current hero x1", hero))
        cells.append(("current, x4", nearest(hero, 4)))
    return cells


def main():
    picks = dict(a.split("=") for a in sys.argv[1:])
    picks = {k: int(v) for k, v in picks.items()}
    rows = [(title, row_cells(r1, v2, small, arch, picks)) for title, r1, v2, small, arch in ROWS]
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
