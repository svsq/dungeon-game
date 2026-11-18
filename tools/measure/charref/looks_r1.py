import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from guide_r3 import BG, place  # noqa: E402
from sheet_r2 import FG, FONT, nearest  # noqa: E402
from snap_small import snap  # noqa: E402

ROOT = Path(os.environ.get("ROOT", Path(__file__).resolve().parents[3]))
REFS = ROOT / "art/char_refs"
GEN = ROOT / "frames/char_refs_looks/gen"
OUT = ROOT / "frames/char_refs_looks/sheet.png"
HEIGHT = 40
MIN_H, MAX_H = 36, 43
FIG_X = 700
CANDS = 15
BASE_B = {("warrior", "b"): 1, ("warrior", "c"): 2, ("mage", "b"): 2, ("mage", "c"): 2, ("archer", "b"): 1, ("archer", "c"): 2}
PICK = {("warrior", "b"): 1, ("warrior", "c"): 7, ("mage", "b"): 7, ("mage", "c"): 8, ("archer", "b"): 7, ("archer", "c"): 12}
BASE_C = {("mage", "c"): 6, ("archer", "c"): 5}
CLASSES = ("warrior", "mage", "archer")
STD = {
    ("warrior", "a"): "warrior_a_v2", ("warrior", "b"): "warrior_b", ("warrior", "c"): "warrior_c",
    ("mage", "a"): "mage_a_v4", ("mage", "b"): "mage_b", ("mage", "c"): "mage_c",
    ("archer", "a"): "archer_a", ("archer", "b"): "archer_b_v3", ("archer", "c"): "archer_c",
}
SMALL_A = {"warrior": "warrior_a_small_r4", "mage": "mage_a_small_orb_r4", "archer": "archer_a_small_r4"}
SCALE_A = {"warrior": "warrior_a_small_r4", "mage": "mage_a_small_noorb_r4", "archer": "archer_a_small_r4"}
ORB_LAYER = "mage_orb_small_r4"
ORB_AT = {"b": (37, 25), "c": (38, 27)}
LOOKS = [(c, k) for c in CLASSES for k in ("b", "c")]
STD_H = 300
READ_H = 36
READ_K = 4


def on_bg(path):
    im = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", im.size, BG + (255,))
    base.alpha_composite(im)
    return base.convert("RGB")


def main_run(counts, gap=12):
    on = counts > 2
    x0 = x1 = int(counts.argmax())
    while x0 > 0 and on[max(0, x0 - gap):x0].any():
        x0 -= 1
    while x1 < len(on) - 1 and on[x1 + 1:x1 + 1 + gap].any():
        x1 += 1
    return x0, x1


def shrink(std, dst):
    a = np.asarray(Image.open(REFS / f"{std}.png").convert("RGB")).astype(int)
    left = a[:, :FIG_X].copy()
    mask = np.abs(left - a[0, 0]).sum(-1) > 30
    x0, x1 = main_run(mask.sum(0))
    mask[:, :x0] = mask[:, x1 + 1:] = False
    left[~mask] = a[0, 0]
    ys, xs = np.where(mask)
    fig = Image.fromarray(left[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8))
    k = HEIGHT / fig.height
    small = fig.resize((max(1, round(fig.width * k)), HEIGHT), Image.BOX)
    small = small.quantize(24, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    pad = Image.new("RGB", (64, 64), BG)
    pad.paste(small, (2, 2))
    tmp = GEN / f"_shrink_{std}.png"
    pad.save(tmp)
    return place(tmp, dst)


def guides():
    GEN.mkdir(parents=True, exist_ok=True)
    for cls in CLASSES:
        src = GEN / f"_scale_{cls}.png"
        on_bg(REFS / f"{SCALE_A[cls]}.png").save(src)
        print("scale", cls, place(src, GEN / f"scale_{cls}_a.png"))
    for cls, look in LOOKS:
        print("guide", cls, look, shrink(STD[(cls, look)], GEN / f"guide_{cls}_{look}.png"))


def period(a, axis, lo=12, hi=26):
    p = np.abs(np.diff(a, axis=axis)).sum(-1).sum(1 - axis)
    idx = np.arange(len(p))
    best = (0, 0, 0)
    for k in np.arange(lo, hi, 0.02):
        z = (p * np.exp(-2j * np.pi * idx / k)).sum()
        if abs(z) > best[0]:
            best = (abs(z), k, (1 - np.angle(z) / (2 * np.pi) * k) % k)
    return best[1], best[2]


def grid_snap(src, dst):
    a = np.asarray(Image.open(src).convert("RGB")).astype(int)
    q = np.asarray(Image.fromarray(a.astype(np.uint8)).quantize(128, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")).astype(int)
    kx, px = period(a, 1)
    ky, py = period(a, 0)
    if abs(kx - ky) > 0.6:
        kx, px = period(a, 1, ky - 0.4, ky + 0.4)
    rows = np.arange(py, a.shape[0] - ky + 1e-6, ky)
    cols = np.arange(px, a.shape[1] - kx + 1e-6, kx)
    out = np.zeros((len(rows), len(cols), 3), np.uint8)
    for i, y in enumerate(rows):
        for j, x in enumerate(cols):
            c = q[int(y + ky * 0.25):int(y + ky * 0.75) + 1, int(x + kx * 0.25):int(x + kx * 0.75) + 1].reshape(-1, 3)
            v, cnt = np.unique(c, axis=0, return_counts=True)
            out[i, j] = v[cnt.argmax()]
    Image.fromarray(out).save(dst)
    return kx, ky


def guides_b():
    for (cls, look), n in BASE_B.items():
        print("guide b", cls, look, n, place(REFS / f"{cls}_{look}_small_{n}.png", GEN / f"guide_{cls}_{look}_b.png"))


def guides_c():
    for (cls, look), n in BASE_C.items():
        print("guide c", cls, look, n, place(REFS / f"{cls}_{look}_small_{n}.png", GEN / f"guide_{cls}_{look}_c.png"))


def guides_d():
    print("guide d archer c 9", place(REFS / "archer_c_small_9.png", GEN / "guide_archer_c_d.png"))
    print("scale archer b 7", place(REFS / "archer_b_small_7.png", GEN / "scale_archer_b7.png"))


def finals():
    for (cls, look), n in PICK.items():
        im = Image.open(REFS / f"{cls}_{look}_small_{n}.png").convert("RGB")
        im.save(REFS / f"{cls}_{look}_small_r1.png")
        if cls != "mage":
            continue
        rgba = im.convert("RGBA")
        a = np.asarray(rgba).copy()
        a[(a[..., :3] == BG).all(-1), 3] = 0
        Image.fromarray(a).save(REFS / f"mage_{look}_small_noorb_r1.png")
        on = rgba.copy()
        on.alpha_composite(Image.open(REFS / f"{ORB_LAYER}.png").convert("RGBA"), ORB_AT[look])
        on.convert("RGB").save(REFS / f"mage_{look}_small_orb_r1.png")
        print(cls, look, n)


def native(cls, look, n):
    raw = ROOT / f"art/raw/looks_{cls}_{look}_small_{n}.png"
    if not raw.exists():
        return None
    nat = GEN / f"nat_{cls}_{look}_{n}.png"
    kx, ky = grid_snap(raw, nat)
    a = np.asarray(Image.open(nat)).astype(int)
    ys, _ = np.where(np.abs(a - a[0, 0]).sum(-1) > 30)
    h = ys.max() - ys.min() + 1
    h0 = h
    off = abs(kx - ky) > 0.6 or not MIN_H <= h <= MAX_H
    if not off:
        h = place(nat, REFS / f"{cls}_{look}_small_{n}.png", True)
    else:
        snap(GEN / f"looks_{cls}_{look}_small_{n}.png", nat, HEIGHT)
        h = place(nat, REFS / f"{cls}_{look}_small_{n}.png", True)
    return f"{kx:.2f}x{ky:.2f} h{h0}", off, h


def snap_all():
    off = {}
    for cls, look in LOOKS:
        for n in range(1, CANDS + 1):
            r = native(cls, look, n)
            if r:
                k, forced, h = r
                off[f"{cls}_{look}_{n}"] = forced
                print(cls, look, n, "raw grid", k, "OFF GRID, resampled to 40" if forced else "native", "height", h)
    (GEN / "offgrid.json").write_text(json.dumps(off, indent=1))


def std_img(name):
    src = Image.open(REFS / f"{name}.png").convert("RGB")
    a = np.asarray(src).astype(int)[:, :FIG_X]
    x0, x1 = main_run((np.abs(a - a[0, 0]).sum(-1) > 30).sum(0))
    im = src.crop((max(0, x0 - 20), 0, min(FIG_X, x1 + 20), src.height))
    return im.resize((round(im.width * STD_H / im.height), STD_H), Image.LANCZOS)


def small_img(cls, look):
    name = SMALL_A[cls] if look == "a" else f"{cls}_{look}_small_r1"
    if cls == "mage" and look != "a" and (REFS / f"mage_{look}_small_orb_r1.png").exists():
        name = f"mage_{look}_small_orb_r1"
    return on_bg(REFS / f"{name}.png")


def at_game(im):
    a = np.asarray(im).astype(int)
    ys, xs = np.where(np.abs(a - np.array(BG)).sum(-1) > 30)
    fig = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    k = READ_H / fig.height
    return fig.resize((max(1, round(fig.width * k)), READ_H), Image.BOX)


def class_row(cls):
    cells = []
    for look in "abc":
        cells.append((f"{look}: {STD[(cls, look)]}", std_img(STD[(cls, look)])))
    for look in "abc":
        cells.append((f"{look} small x4" + (" + orb layer" if cls == "mage" else ""), nearest(small_img(cls, look).crop((8, 4, 56, 60)), 4)))
    return cells


def read_strip():
    cells = []
    for cls in CLASSES:
        group = [at_game(small_img(cls, look)) for look in "abc"]
        w = sum(g.width for g in group) + 6 * (len(group) + 1)
        strip = Image.new("RGB", (w, READ_H + 12), BG)
        x = 6
        for g in group:
            strip.paste(g, (x, 6))
            x += g.width + 6
        cells.append((f"{cls} a b c, 36 px x1", strip))
        cells.append((f"{cls} a b c, 36 px x{READ_K}", nearest(strip, READ_K)))
    return cells


def cand_row(cls, look):
    off = json.loads((GEN / "offgrid.json").read_text())
    cells = []
    for n in range(1, CANDS + 1):
        p = REFS / f"{cls}_{look}_small_{n}.png"
        if p.exists():
            tag = "resampled, rejected" if off.get(f"{cls}_{look}_{n}", True) else "native"
            tag += ", PICK" if PICK.get((cls, look)) == n else ""
            cells.append((f"{n}: {tag}", nearest(Image.open(p).convert("RGB").crop((8, 4, 56, 60)), 4)))
    return cells


def draw(rows, out):
    pad, lab = 14, 22
    cw = lambda label, im: max(im.width, round(FONT.getlength(label)))
    widths = [sum(cw(l, im) for l, im in cells) + pad * (len(cells) + 1) for _, cells in rows]
    heights = [max(im.height for _, im in cells) + lab * 2 + pad for _, cells in rows]
    sheet = Image.new("RGB", (max(widths), sum(heights) + pad), (20, 20, 28))
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
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out, sheet.size)


def sheet():
    rows = [(f"{cls}: standard a b c | small a b c (native 40 px figure, shown x4)", class_row(cls)) for cls in CLASSES]
    rows.append(("readability preview: each small box-scaled to a 36 px figure (play size), x1 and x4", read_strip()))
    draw(rows, OUT)


def cands():
    rows = [(f"{cls}_{look}: all candidates", cand_row(cls, look)) for cls, look in LOOKS]
    draw([r for r in rows if r[1]], OUT.parent / "candidates.png")


if __name__ == "__main__":
    {"guides": guides, "guides_b": guides_b, "guides_c": guides_c, "finals": finals, "guides_d": guides_d, "snap": snap_all, "sheet": sheet, "cands": cands}[sys.argv[1]]()
