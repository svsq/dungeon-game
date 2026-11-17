# python3 tools/measure/limbs2160/cmp.py frames/fix_2160: before/after per class at x1 and x3 (TASKS 2160): the arch figure, and from the
# gear sheets (gearsheet.mjs, z 4) the class's starting outfit in the world: rest right, two run frames, rest left, back, run down, up
import sys
from PIL import Image, ImageDraw
D = sys.argv[1]
ARCH = {'warrior': 'menu_continue', 'archer': 'menu_continue_archer', 'mage': 'menu_continue_mage'}
for c, row in [('warrior', 1), ('archer', 1), ('mage', 1)]:
    arch = [Image.open(f'{D}/{d}/{ARCH[c]}.png').convert('RGB').crop((800, 440, 1060, 750)) for d in ('before', 'after')]
    world = [Image.open(f'{D}/{d}/gear/sheet_{c}.png').convert('RGB').crop((110, row * 480 + 60, 110 + 3360, row * 480 + 480)).resize((840, 105), Image.NEAREST) for d in ('before', 'after')]
    for k in (1, 3):
        a = [im.resize((im.width * k, im.height * k), Image.NEAREST) for im in arch]; w = [im.resize((im.width * k, im.height * k), Image.NEAREST) for im in world]
        W = max(a[0].width * 2 + w[0].width, 10) + 20; H = max(a[0].height, w[0].height * 2) + 24
        s = Image.new('RGB', (a[0].width * 2 + 10 + w[0].width + 10, max(a[0].height, w[0].height * 2 + 10) + 20), (20, 20, 24)); g = ImageDraw.Draw(s)
        s.paste(a[0], (0, 20)); s.paste(a[1], (a[0].width + 5, 20)); s.paste(w[0], (a[0].width * 2 + 10, 20)); s.paste(w[1], (a[0].width * 2 + 10, 30 + w[0].height))
        g.text((4, 4), f'{c}: arch before | after;  world before (top) / after (bottom)', fill=(255, 220, 90))
        s.save(f'{D}/cmp_{c}_x{k}.png')
