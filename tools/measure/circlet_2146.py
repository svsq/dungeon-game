"""superseded by mageheads_2151.py (TASKS 2151: it left the leather and hooded bodies headless under the circlet); kept as the record
the mage's circlet on his world-grid head (TASKS 2146): the generated whole head (gear.py cut mage_circlet) is drawn, so in the
world its face lost to the shader's vote and sat over the grid head's beard; there the circlet is one row of grid cells over the
grid head (body_nh is the whole body), the drawn heads stay for the arch (head_ci_menu over body_nh_menu)
  python3 tools/gear.py cut mage_circlet && python3 tools/measure/circlet_2146.py   (it reads the drawn head the cut just wrote)"""
import numpy as np; from PIL import Image
G, C, ROW, X0, X1, GEM = 'art/gen/mage__', 360 / 42, 3, 7, 13, 13
load = lambda n: np.array(Image.open(G + n + '.png').convert('RGBA'))
save = lambda a, n: Image.fromarray(a).save(G + n + '.png')
body, menu, drawn = load('body'), load('body_menu'), load('head_ci')
save(drawn, 'head_ci_menu'); nh = menu.copy(); nh[:64] = 0; save(nh, 'body_nh_menu'); save(body, 'body_nh')
band = np.zeros_like(body)
for c in range(X0, X1 + 1):
    col = (0x5a, 0xa8, 0xe8) if c == GEM else (0xcc, 0x73, 0x27) if c % 2 else (0xdf, 0x87, 0x26)
    band[round(ROW * C):round((ROW + 1) * C), round(c * C):round((c + 1) * C)] = (*col, 255)
save(band, 'head_ci')
