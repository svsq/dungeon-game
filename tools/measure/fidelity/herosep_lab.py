import numpy as np
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    X = c @ np.array([0.4124, 0.3576, 0.1805]); Y = c @ np.array([0.2126, 0.7152, 0.0722]); Z = c @ np.array([0.0193, 0.1192, 0.9505])
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(X / 0.9505), f(Y), f(Z / 1.089)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)
