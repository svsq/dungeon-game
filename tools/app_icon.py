#!/usr/bin/env python3
"""Desktop app icon from the hero portrait: desktop/build/icon.png (1024), icon.icns, icon.ico.

python3 tools/app_icon.py [--preview sheet.png]
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art/gen/portrait.png")
OUT = os.path.join(ROOT, "desktop/build")
# Head and collar; at 32 px and below a closer face crop, or the eyes vanish into the hair.
CROP = (200, 40, 920, 760)
CROP_SMALL = (300, 140, 840, 680)
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
ICNS = [(16, 1), (16, 2), (32, 1), (32, 2), (128, 1), (128, 2), (256, 1), (256, 2), (512, 1), (512, 2)]


def make(size, src):
    face = src.crop(CROP_SMALL if size <= 32 else CROP)
    # The source is painted, not on a true grid, so area resampling beats nearest when shrinking.
    method = Image.LANCZOS if size >= face.width else Image.BOX
    return face.resize((size, size), method)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    a = ap.parse_args()
    face = Image.open(SRC).convert("RGB")
    os.makedirs(OUT, exist_ok=True)
    make(1024, face).save(os.path.join(OUT, "icon.png"))
    make(256, face).save(os.path.join(OUT, "icon.ico"), sizes=[(s, s) for s in ICO_SIZES],
                         append_images=[make(s, face) for s in ICO_SIZES])
    if shutil.which("iconutil"):
        with tempfile.TemporaryDirectory() as tmp:
            iset = os.path.join(tmp, "icon.iconset")
            os.makedirs(iset)
            for s, k in ICNS:
                make(s * k, face).save(os.path.join(iset, f"icon_{s}x{s}{'@2x' if k == 2 else ''}.png"))
            subprocess.run(["iconutil", "-c", "icns", iset, "-o", os.path.join(OUT, "icon.icns")], check=True)
    else:
        print("iconutil not found (macOS only): icon.icns left as is", file=sys.stderr)
    if a.preview:
        sizes = [16, 32, 128, 1024]
        pad = 24
        sheet = Image.new("RGB", (sum(sizes) + pad * (len(sizes) + 1) + 3 * 128 + pad * 3, 1024 + 2 * pad), (40, 40, 48))
        x = pad
        for s in sizes:
            sheet.paste(make(s, face), (x, pad))
            x += s + pad
        for s in (16, 32):
            big = make(s, face).resize((128, 128), Image.NEAREST)
            sheet.paste(big, (x, pad + 160))
            x += 128 + pad
        sheet.save(a.preview)
    print("wrote", ", ".join(sorted(os.listdir(OUT))))


if __name__ == "__main__":
    main()
