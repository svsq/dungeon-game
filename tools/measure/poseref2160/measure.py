"""TASKS 2160: stance, elbow bend, near/far limb tone and cape-over-leg on the game's hero (grab.mjs output) and on the class references.
python3 tools/measure/poseref2160/measure.py [game|game_after]  ->  frames/pose_ref_2160/measure_<dir>.json
Reference landmarks are read by eye off art/char_refs/*.png (full figure, 1536x1024 sheet), accurate to about +-10 px."""
import json, math, sys
import numpy as np
from PIL import Image

TAG = sys.argv[1] if len(sys.argv) > 1 else 'game'
G = 'frames/pose_ref_2160/' + TAG + '/'
J = json.load(open(G + 'joints.json'))

# screen-left limb first, screen-right second; for the 3/4-front refs the screen-left limbs are the character's right
REF = {
    'warrior': {'img': 'art/char_refs/warrior_a_v2.png', 'top': (420, 38), 'sole': 960,
                'arms': {'screen_left': [(315, 250), (275, 380), (255, 495)], 'screen_right': [(520, 270), (535, 400), (540, 525)]},
                'ankles': [(340, 880), (480, 880)], 'soles': [960, 935],
                'boxes': {'upper_arm': [(270, 280, 315, 330), (510, 280, 545, 330)], 'forearm': [(245, 390, 290, 460), (520, 390, 550, 450)],
                          'thigh': [(325, 620, 390, 700), (440, 620, 510, 700)], 'shin': [(310, 770, 375, 860), (450, 770, 505, 860)]}},
    'archer': {'img': 'art/char_refs/archer_a.png', 'top': (420, 62), 'sole': 945,
               'arms': {'screen_left': [(315, 320), (280, 430), (290, 545)], 'screen_right': [(520, 310), (545, 420), (600, 500)]},
               'ankles': [(300, 870), (460, 860)], 'soles': [945, 920],
               'boxes': {'upper_arm': [(265, 330, 300, 380), (510, 330, 540, 380)], 'forearm': [(270, 440, 300, 480), (530, 430, 560, 460)],
                         'thigh': [(320, 600, 380, 680), (430, 600, 490, 680)], 'shin': [(285, 770, 340, 850), (430, 770, 480, 850)]}},
    'mage': {'img': 'art/char_refs/mage_a_v4.png', 'top': (430, 80), 'sole': 960, 'arms': None,
             'ankles': [(345, 880), (495, 880)], 'soles': [960, 945],
             'boxes': {'shin': [(320, 850, 370, 920), (465, 850, 520, 920)]}},
}


def lab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def mean_lab(px):
    if len(px) == 0:
        return None
    return [round(float(v), 1) for v in lab(px).mean(0)]


def bend(s, e, h):
    a1 = math.atan2(e[1] - s[1], e[0] - s[0]); a2 = math.atan2(h[1] - e[1], h[0] - e[0])
    d = math.degrees((a2 - a1 + math.pi) % (2 * math.pi) - math.pi)
    return round(d, 1)


def arm_info(s, e, h, H, facing):
    return {'elbow_bend_deg': bend(s, e, h), 'inner_angle_deg': round(180 - abs(bend(s, e, h)), 1),
            'elbow_dx_H': round((e[0] - (s[0] + h[0]) / 2) * facing / H, 3), 'hand_dx_from_shoulder_H': round((h[0] - s[0]) * facing / H, 3),
            'hand_drop_H': round((h[1] - s[1]) / H, 3)}


def ref_stats(cls):
    R = REF[cls]; im = np.asarray(Image.open(R['img']).convert('RGB'))
    H = R['sole'] - R['top'][1]
    out = {'H_px': H, 'feet_dx_H': round((R['ankles'][1][0] - R['ankles'][0][0]) / H, 3),
           'feet_depth_dy_H': round((R['soles'][0] - R['soles'][1]) / H, 3)}
    if R['arms']:
        out['arms'] = {k: arm_info(*v, H, 1) for k, v in R['arms'].items()}
    out['tone'] = {}
    for part, (b0, b1) in R['boxes'].items():
        l0 = mean_lab(im[b0[1]:b0[3], b0[0]:b0[2]].reshape(-1, 3)); l1 = mean_lab(im[b1[1]:b1[3], b1[0]:b1[2]].reshape(-1, 3))
        out['tone'][part] = {'screen_left': l0, 'screen_right': l1, 'dL': round(l1[0] - l0[0], 1)}
    return out


def seg_pixels(img, mask, a, b, r):
    h, w = mask.shape; ys, xs = np.mgrid[0:h, 0:w]
    ax, ay = a; bx, by = b; vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy or 1
    t = np.clip(((xs - ax) * vx + (ys - ay) * vy) / L2, 0.15, 0.85)
    d = np.hypot(xs - (ax + t * vx), ys - (ay + t * vy))
    sel = mask & (d <= r)
    return img[sel], sel


def game_stats(name, cape_test):
    r = J[name]; bx, by = r['box'][:2]; pre = r.get('pre'); k = pre[2] if pre else 1
    def P(n):
        p = r['joints'][n]
        if pre:
            p = [pre[0] + (p[0] - pre[0]) * k, pre[1] + (p[1] - pre[1]) * k]
        return (p[0] - bx, p[1] - by)
    a = np.asarray(Image.open(G + name + '_all.png').convert('RGB')).astype(int)
    b = np.asarray(Image.open(G + name + '_none.png').convert('RGB')).astype(int)
    mask = np.abs(a - b).sum(2) > 24
    H = P('ground')[1] - P('top')[1]
    out = {'H_px': round(H, 1), 'scale': k,
           'feet_dx_H': round((P('ankleR')[0] - P('ankleL')[0]) / H, 3),
           'feet_depth_dy_H': round((P('ankleL')[1] - P('ankleR')[1]) / H, 3),
           'toe_far_to_ankle_near_H': round((P('ankleR')[0] - P('toeL')[0]) / H, 3),
           'shoulders_dx_H': round((P('shR')[0] - P('shL')[0]) / H, 3),
           'arms': {'far_L_screen_left': arm_info(P('shL'), P('elbowL'), P('handL'), H, 1),
                    'near_R_screen_right': arm_info(P('shR'), P('elbowR'), P('handR'), H, 1)}}
    rad = 2.6 * k
    tone = {}
    for part, (j0, j1) in {'upper_arm': ('sh', 'elbow'), 'forearm': ('elbow', 'hand'), 'thigh': ('hip', 'knee'), 'shin': ('knee', 'ankle')}.items():
        pl, _ = seg_pixels(a, mask, P(j0 + 'L'), P(j1 + 'L'), rad); pr, _ = seg_pixels(a, mask, P(j0 + 'R'), P(j1 + 'R'), rad)
        l0, l1 = mean_lab(pl), mean_lab(pr)
        tone[part] = {'far_L_screen_left': l0, 'near_R_screen_right': l1, 'dL_near_minus_far': round(l1[0] - l0[0], 1) if l0 and l1 else None}
    out['tone'] = tone
    if cape_test:
        cov = {}
        for s in 'LR':
            px, _ = seg_pixels(a, mask, P('hip' + s), P('knee' + s), rad)
            cov[s] = round(float(cape_test(lab(px)).mean()), 3) if len(px) else None
        out['cape_share_on_thigh'] = {'far_L': cov['L'], 'near_R': cov['R']}
    return out


CAPE = {'warrior': lambda L: (L[..., 1] > 25) & (L[..., 1] > 1.2 * L[..., 2]),
        'archer': lambda L: (L[..., 1] < -6) & (L[..., 2] > 8)}
res = {'ref': {c: ref_stats(c) for c in REF},
       'game': {n: game_stats(n, CAPE.get(n.split('_')[1])) for n in J}}
json.dump(res, open('frames/pose_ref_2160/measure_' + TAG + '.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
