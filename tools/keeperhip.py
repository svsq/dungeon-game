# Repaints the smeared dark back-fill left where rigcut removed the far arm of town_keeper__body.png with hard-pixel cloak folds in the cloak's own tones.
from PIL import Image
P = "live/assets/town_keeper__body.png"
TONES = [(108, 77, 70), (101, 71, 65), (108, 77, 70), (92, 65, 60)]
EDGE = (19, 3, 4)
im = Image.open(P).convert("RGBA")
for y in range(146, 216):
    for x in range(17, 67):
        top = 147 + (64 - x) // 6
        left = 18 + (y * 7) % 3
        right = 64 - (y * 5) % 2
        if y < top or x < left or x > right or im.getpixel((x, y))[3] == 0:
            continue
        t = ((x + y // 2) // 6) % len(TONES)
        c = EDGE if y == top else TONES[t]
        im.putpixel((x, y), c + (255,))
im.save(P)
