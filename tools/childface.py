# Repaints the town_child head face: the eyes were heavy dark bars fused to the hair outline, freckles and mouth read as dark blotches.
from PIL import Image

P = "live/assets/town_child__head.png"
SKIN = (251, 189, 127, 255)
EYE = (33, 10, 8, 255)
FRECKLE = (179, 88, 47, 255)
MOUTH = (148, 75, 46, 255)

im = Image.open(P).convert("RGBA")
px = im.load()


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = c


def dark_to_skin(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if sum(px[x, y][:3]) < 390:
                px[x, y] = SKIN


dark_to_skin(78, 79, 90, 88)
dark_to_skin(103, 79, 110, 88)
rect(84, 84, 88, 88, EYE)
rect(99, 84, 103, 88, EYE)

for x0, y0, x1, y1 in [(78, 89, 81, 92), (73, 93, 77, 96), (83, 93, 86, 96), (100, 93, 104, 96), (78, 100, 83, 103), (92, 100, 101, 103)]:
    rect(x0, y0, x1, y1, SKIN)
for x0, y0 in [(78, 89), (83, 93), (100, 93)]:
    rect(x0, y0, x0 + 3, y0 + 3, FRECKLE)
rect(93, 102, 100, 103, MOUTH)
rect(92, 101, 93, 101, MOUTH)
rect(100, 101, 101, 101, MOUTH)

im.save(P)
