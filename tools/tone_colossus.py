import numpy as np
from PIL import Image
from scipy import ndimage


source = np.array(Image.open('art/gen/colossus_source.png').convert('RGBA'))
rgb = source[..., :3].astype(float)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
core = (r - np.maximum(g, b) > 28) & ((r - b) / np.maximum(r, 1) > 0.42)
ramp = np.array([[14, 13, 14], [28, 26, 27], [70, 68, 67], [124, 120, 115], [165, 160, 153]])
index = np.digitize(rgb @ [0.3, 0.5, 0.2], [14, 26, 50, 85])
index = ndimage.median_filter(index, size=3)
alpha = ndimage.gaussian_filter((source[..., 3] > 200).astype(float), 8)
dx, dy = ndimage.sobel(alpha, 1), ndimage.sobel(alpha, 0)
left = (dx > 0.02) & (np.abs(dx) > np.abs(dy)) & (index >= 2)
right = (dx < -0.02) & (np.abs(dx) > np.abs(dy)) & (index >= 3)
index[left] = np.minimum(4, index[left] + 1)
index[right] -= 1
mask = (source[..., 3] > 0) & ~core
source[mask, :3] = ramp[index[mask]]
Image.fromarray(source).save('art/gen/en_colossus.png')
