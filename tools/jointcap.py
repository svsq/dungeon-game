# paint a joint cap onto a rig's body: the part's own pixels within a radius of its pivot, so a limb raised far from its rest
# turns over a round shoulder instead of opening a gap where the cut took the shoulder away
#   python3 tools/jointcap.py NAME "PART:PIVOTKEY:R" ...   (e.g. "uarmR:shR:16", radius in rig px)
import json, re, sys; import numpy as np; from PIL import Image
name = sys.argv[1]; RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))[name]
B = np.array(Image.open(f'art/gen/{name}__body.png').convert('RGBA'))
for arg in sys.argv[2:]:
    part, key, r = arg.split(':'); px, py = RG[key]; P = np.array(Image.open(f'art/gen/{name}__{part}.png').convert('RGBA'))
    yy, xx = np.mgrid[:B.shape[0], :B.shape[1]]; m = (np.hypot(xx - px, yy - py) < float(r)) & (P[..., 3] > 60)
    B[m] = P[m]; print(part, 'cap', int(m.sum()), 'px at', key, (px, py))
Image.fromarray(B).save(f'art/gen/{name}__body.png')
