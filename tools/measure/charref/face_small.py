import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
PREVIEW = ROOT / "frames/char_refs_r3/face"
BG = (0x1A, 0x1A, 0x24)

SKIN = {
    "S": "d9a26e",
    "s": "b06a3c",
    "d": "6e3522",
    "n": "8e4a2c",
    "e": "160806",
}

HEADS = {
    "warrior": {
        "src": "warrior_a_small_1.png",
        "at": (26, 12),
        "colors": {"o": "220b0b", "H": "3a1c14", "h": "633120", "j": "84452a", "b": "4a2418",
                   "B": "3a1c14", "c": "6a3520"},
        "map": [
            "..ooooo..",
            ".ohjjjho.",
            "oHhjhhhHo",
            "oHhSSSSso",
            "oHsSbSbso",
            "oHsSeSeso",
            "ocsSSSnso",
            "oBBScccBo",
            "..oBBBBo.",
        ],
    },
    "mage": {
        "src": "mage_a_small_2.png",
        "at": (27, 15),
        "colors": {"o": "210909", "H": "2e2228", "h": "4b3436", "g": "7a6a70", "b": "3a2932",
                   "G": "aaa4a6", "q": "776f74"},
        "map": [
            "..ooooo..",
            ".ohghhho.",
            "oHhhghhho",
            "oHhSSSSso",
            "oHsSbSbso",
            "oHsSeSeso",
            "oHsSSSnso",
            "oHqGqqGqo",
            ".oqGGGGqo",
            "..oqGGqo.",
        ],
        "patches": [((38, 30), [
            ".____.",
            ".oooo_",
        ])],
    },
    "archer": {
        "src": "archer_a_small_3.png",
        "at": (29, 12),
        "colors": {"o": "220c0b", "H": "4a2414", "h": "7a3a1e", "j": "9a522a", "b": "4a2414",
                   "B": "5a2a16", "c": "7a3a1e"},
        "map": [
            "..ooooo..",
            ".ohjjjho.",
            "oHhjhhhHo",
            "oHhSSSSso",
            ".HsSbSbso",
            ".HsSeSeso",
            ".csSSSnso",
            ".BcScccBo",
            "..oBccBo.",
        ],
    },
}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def paint(cls, base=None):
    spec = HEADS[cls]
    im = base or Image.open(REFS / spec["src"]).convert("RGB")
    a = np.array(im)
    pal = {k: hexrgb(v) for k, v in {**SKIN, **spec["colors"]}.items()}
    pal["_"] = BG
    for (x0, y0), rows in [(spec["at"], spec["map"]), *spec.get("patches", [])]:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ".":
                    a[y0 + j, x0 + i] = pal[ch]
    return Image.fromarray(a)


ORB_BOX = (36, 22, 47, 32)


def strip_orb(im):
    a = np.array(im).astype(int)
    x0, y0, x1, y1 = ORB_BOX
    sub = a[y0:y1, x0:x1]
    orb = sub[..., 2] > sub[..., 0] + 20
    sub[orb] = BG
    a[y0:y1, x0:x1] = sub
    return Image.fromarray(a.astype(np.uint8))


def to_alpha(im):
    a = np.array(im.convert("RGBA"))
    a[(a[..., :3] == BG).all(-1), 3] = 0
    return Image.fromarray(a)


def preview(im, cls):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    x0, y0 = HEADS[cls]["at"]
    face = im.crop((x0 - 3, y0 - 2, x0 + 12, y0 + 13)).resize((15 * 16, 15 * 16), Image.NEAREST)
    x4 = im.resize((256, 256), Image.NEAREST)
    sheet = Image.new("RGB", (64 + 256 + 240 + 40, 256), BG)
    sheet.paste(im, (8, 8))
    sheet.paste(x4, (80, 0))
    sheet.paste(face, (350, 8))
    sheet.save(PREVIEW / f"{cls}.png")


if __name__ == "__main__":
    for cls in sys.argv[1:] or HEADS:
        out = paint(cls)
        if cls == "mage":
            out = paint(cls, strip_orb(Image.open(REFS / HEADS[cls]["src"]).convert("RGB")))
            to_alpha(out).save(REFS / "mage_a_small_noorb_v3.png")
        out.save(REFS / f"{cls}_a_small_v3.png")
        preview(out, cls)
        print(cls, REFS / f"{cls}_a_small_v3.png")
