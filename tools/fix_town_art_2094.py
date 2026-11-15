import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

STAMP = "20261115-2094"
PARAMS = {
    "runes_tw": {"dilate_radius": 7},
    "disc_tw": {"sigma": 6, "groove_drop": 8, "offset": 7, "raise": 24, "darken": 6},
    "stairs_tw": {"a_min": 4, "b_max": 15, "l_mul": 0.84, "a_mul": 0.55},
    "forge_tw": {"a_min": 4, "b_max": 15, "l_mul": 0.84, "a_mul": 0.55},
}
WHITE = np.array([0.95047, 1.0, 1.08883])
M = np.array([[0.4124564, 0.3575761, 0.1804375],
              [0.2126729, 0.7151522, 0.0721750],
              [0.0193339, 0.1191920, 0.9503041]])
EPS = 216 / 24389
KAPPA = 24389 / 27


def to_lab(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    t = (lin @ M.T) / WHITE
    f = np.where(t > EPS, np.cbrt(t), (KAPPA * t + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def from_lab(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    t = np.where(f ** 3 > EPS, f ** 3, (116 * f - 16) / KAPPA)
    lin = (t * WHITE) @ np.linalg.inv(M).T
    lin = np.clip(lin, 0, 1)
    c = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255)


def pct(x):
    return [round(float(v), 2) for v in np.percentile(x, [5, 50, 95])]


def runes(rgb, a, p):
    r = p["dilate_radius"]
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    disk = x * x + y * y <= r * r
    op = a > 127
    new = ndi.binary_dilation(op, structure=disk)
    idx = ndi.distance_transform_edt(~op, return_distances=False, return_indices=True)
    out = rgb[idx[0], idx[1]]
    a2 = np.where(new, 255, 0).astype(np.uint8)
    print("opaque share %.4f -> %.4f" % (op.mean(), new.mean()))
    return out, a2


def disc(rgb, a, p):
    op = a > 0
    lab = to_lab(rgb.astype(float))
    L = lab[..., 0]
    w = op.astype(float)
    loc = ndi.gaussian_filter(L * w, p["sigma"]) / np.maximum(ndi.gaussian_filter(w, p["sigma"]), 1e-6)
    groove = op & (L <= loc - p["groove_drop"])
    o = p["offset"]
    shifted = np.zeros_like(groove)
    shifted[o:, o:] = groove[:-o, :-o]
    hi = shifted & ~groove & op
    before = pct(L[op])
    L2 = L.copy()
    L2[hi] = np.clip(L2[hi] + p["raise"], 0, 100)
    L2[groove] = np.clip(L2[groove] - p["darken"], 0, 100)
    lab[..., 0] = L2
    print("L* p5/p50/p95 %s -> %s  (groove %d px, highlight %d px)" % (before, pct(L2[op]), groove.sum(), hi.sum()))
    return from_lab(lab).astype(np.uint8), a


def lilac(rgb, a, p, report="L"):
    op = a > 0
    lab = to_lab(rgb.astype(float))
    m = op & (lab[..., 1] > p["a_min"]) & (lab[..., 2] < p["b_max"])
    b = lab[m]
    chroma0 = np.hypot(b[:, 1], b[:, 2])
    lab[m, 0] *= p["l_mul"]
    lab[m, 1] *= p["a_mul"]
    b2 = lab[m]
    chroma1 = np.hypot(b2[:, 1], b2[:, 2])
    print("masked %d px; L* p50 %.2f -> %.2f; a* p50 %.2f -> %.2f; C* p50 %.2f -> %.2f" % (
        m.sum(), np.median(b[:, 0]), np.median(b2[:, 0]), np.median(b[:, 1]), np.median(b2[:, 1]),
        np.median(chroma0), np.median(chroma1)))
    return from_lab(lab).astype(np.uint8), a


FUNCS = {"runes_tw": runes, "disc_tw": disc, "stairs_tw": lilac, "forge_tw": lilac}


def run(name):
    src = "art/gen/%s.png" % name
    bak = "art/old/%s-%s.png" % (name, STAMP)
    if os.path.exists(bak):
        sys.exit("backup exists: " + bak)
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    rgb, a = arr[..., :3], arr[..., 3]
    print(name)
    out_rgb, out_a = FUNCS[name](rgb, a, PARAMS[name])
    im.save(bak)
    res = np.dstack([out_rgb, out_a]).astype(np.uint8)
    res[out_a == 0, :3] = rgb[out_a == 0] if name != "runes_tw" else res[out_a == 0, :3]
    Image.fromarray(res, "RGBA").save(src)


if __name__ == "__main__":
    names = list(FUNCS) if sys.argv[1] == "all" else [sys.argv[1]]
    for n in names:
        run(n)
