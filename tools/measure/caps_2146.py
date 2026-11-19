"""shoulder caps (docs/CHAR_REGEN_2146.md step 6): each upper arm's own pixels within R rig px of its shoulder pivot laid onto bodies
  python3 tools/measure/caps_2146.py RIG R BODY...   (BODY: body, body_menu, body_nh, body_le, ...; the uarm of the body's suffix if any)"""
import json, re, sys, os; import numpy as np; from PIL import Image
rig, R, bodies = sys.argv[1], float(sys.argv[2]), sys.argv[3:]
RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))[rig]
for b in bodies:
    B = np.array(Image.open(f'art/gen/{rig}__{b}.png').convert('RGBA')); sfx = next((s for s in ('le', 'hd') if f'_{s}' in b), '')
    for side in 'LR':
        n = f'art/gen/{rig}__uarm{side}' + (f'_{sfx}' if sfx and os.path.exists(f'art/gen/{rig}__uarm{side}_{sfx}.png') else '') + '.png'
        P = np.array(Image.open(n).convert('RGBA')); px, py = RG['sh' + side]; yy, xx = np.mgrid[:B.shape[0], :B.shape[1]]
        m = (np.hypot(xx - px, yy - py) < R) & (P[..., 3] > 60); B[m] = P[m]
    Image.fromarray(B).save(f'art/gen/{rig}__{b}.png'); print(b, 'capped')
