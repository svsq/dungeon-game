# usage: python3 tools/golem_longarm.py  (lengthens golem arms, edits live/assets/golem*__uarm/farm*.png and live/rigs.js)
import json, re, os, sys
import numpy as np
from PIL import Image

PARAMS = {"L": (15, 20), "R": (10, 15)}

RP = "live/rigs.js"
R = json.loads(re.sub(r"^window\.RIGS = |;\s*$", "", open(RP).read().strip()))
g = R["golem"]
if "longarm" in g:
    sys.exit("golem.longarm already set")


jobs = []
over = []
skipped = []
for S in "LR":
    UA, FA = PARAMS[S]
    ys, ye, yh = round(g["sh" + S][1]), round(g["elbow" + S][1]), round(g["hand" + S][1])
    for pre in ("golem", "golemE"):
        for part in ("uarm", "farm"):
            p = f"live/assets/{pre}__{part}{S}.png"
            if not os.path.exists(p):
                skipped.append(p)
                continue
            a = np.array(Image.open(p).convert("RGBA"))
            h = a.shape[0]
            if part == "uarm":
                top, bot, grow, shift_above = ys, ye, UA, 0
                tail = UA
            else:
                top, bot, grow, shift_above = ye, yh, FA, UA
                tail = UA + FA
            n = bot - top + 1
            nh = n + grow
            idx = np.arange(nh) * n // nh
            mid = a[top:bot + 1][idx]
            if part == "uarm":
                out = np.concatenate([a[:top], mid, a[bot + 1:]], axis=0)
            else:
                out = np.concatenate([np.zeros((UA,) + a.shape[1:], a.dtype), a[:top], mid, a[bot + 1:]], axis=0)
            extra = out[h:]
            if extra[..., 3].any():
                rows = np.where(extra[..., 3].any(axis=(1, 2)) if extra.ndim > 3 else extra[..., 3].any(axis=1))[0].max() + 1
                over.append(f"{p}: overflow by {rows} rows")
                continue
            jobs.append((p, out[:h]))
if over:
    sys.exit("\n".join(over))

for p, im in jobs:
    Image.fromarray(im).save(p)

for S in "LR":
    print(S, "elbow", g["elbow" + S], "hand", g["hand" + S])
    UA, FA = PARAMS[S]
    g["elbow" + S][1] += UA
    g["hand" + S][1] += UA + FA
    print(S, "->", g["elbow" + S], g["hand" + S])
g["longarm"] = {k: list(v) for k, v in PARAMS.items()}
open(RP, "w").write("window.RIGS = " + json.dumps(R) + ";\n")
print("skipped:", skipped)
