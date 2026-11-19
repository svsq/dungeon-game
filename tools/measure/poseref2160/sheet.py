"""TASKS 2160: per class, the arch hero (x2), the class reference scaled to the same height and the world hero (x4), with the rig's joints,
the reference's landmarks and the author's five points marked.  Needs grab.mjs and measure.py output first.
python3 tools/measure/poseref2160/sheet.py [game|game_after]  ->  frames/pose_ref_2160/compare_<class>[_after].png"""
import json
from PIL import Image, ImageDraw, ImageFont
import os, sys

TAG = sys.argv[1] if len(sys.argv) > 1 else 'game'
G = 'frames/pose_ref_2160/' + TAG + '/'
J = json.load(open(G + 'joints.json'))
M = json.load(open('frames/pose_ref_2160/measure_' + TAG + '.json'))
F = '/System/Library/Fonts/Supplemental/Arial.ttf'
FB = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font, fontb, fonts = ImageFont.truetype(F, 17), ImageFont.truetype(FB, 20), ImageFont.truetype(F, 15)
CL, CR, MARK = (0, 230, 255), (255, 220, 0), (255, 70, 200)
REFS = {'warrior': 'art/char_refs/warrior_a_v2.png', 'archer': 'art/char_refs/archer_a.png', 'mage': 'art/char_refs/mage_a_v4.png'}
REF_PTS = {
    'warrior': {'top': 38, 'sole': 960, 'crop': (60, 20, 680, 980),
                'L': [(315, 250), (275, 380), (255, 495)], 'R': [(520, 270), (535, 400), (540, 525)],
                'ankL': (340, 880), 'ankR': (480, 880), 'soleL': 960, 'soleR': 935},
    'archer': {'top': 62, 'sole': 945, 'crop': (60, 40, 680, 965),
               'L': [(315, 320), (280, 430), (290, 545)], 'R': [(520, 310), (545, 420), (600, 500)],
               'ankL': (300, 870), 'ankR': (460, 860), 'soleL': 945, 'soleR': 920},
    'mage': {'top': 80, 'sole': 960, 'crop': (180, 50, 700, 980), 'L': None, 'R': None,
             'ankL': (345, 880), 'ankR': (495, 880), 'soleL': 960, 'soleR': 945},
}
HT = 520


def game_panel(name, z):
    r = J[name]; im = Image.open(G + name + '_all.png').convert('RGB'); pre = r.get('pre'); k = pre[2] if pre else 1
    def P(n):
        p = r['joints'][n]
        if pre:
            p = [pre[0] + (p[0] - pre[0]) * k, pre[1] + (p[1] - pre[1]) * k]
        return ((p[0] - r['box'][0]) * z, (p[1] - r['box'][1]) * z)
    top, gr = P('top'), P('ground')
    x0 = int(gr[0] - 45 * k * z); y0 = int(top[1] - 12 * z)
    im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    w = int(90 * k * z)
    box = (max(0, x0), max(0, y0), min(im.width, x0 + w), min(im.height, int(gr[1] + 8 * z)))
    im = im.crop(box); d = ImageDraw.Draw(im)
    Q = lambda n: (P(n)[0] - box[0], P(n)[1] - box[1])
    for s, col in (('L', CL), ('R', CR)):
        for chain in (('sh', 'elbow', 'hand'), ('hip', 'knee', 'ankle', 'toe')):
            pts = [Q(c + s) for c in chain]
            d.line(pts, fill=col, width=2)
            for q in pts:
                d.ellipse((q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3), outline=col, width=2)
        d.line([Q('heel' + s), Q('toe' + s)], fill=col, width=1)
    return im, Q


def ref_panel(cls):
    R = REF_PTS[cls]; c = R['crop']; s = HT / (R['sole'] - R['top'])
    im = Image.open(REFS[cls]).convert('RGB').crop(c)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS); d = ImageDraw.Draw(im)
    T = lambda p: ((p[0] - c[0]) * s, (p[1] - c[1]) * s)
    for side, col in (('L', CL), ('R', CR)):
        if R[side]:
            pts = [T(p) for p in R[side]]; d.line(pts, fill=col, width=2)
            for q in pts:
                d.ellipse((q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3), outline=col, width=2)
    for a, col in ((R['ankL'], CL), (R['ankR'], CR)):
        q = T(a); d.ellipse((q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4), outline=col, width=2)
    return im, T


def tag(d, xy, n, txt=None):
    x, y = xy; d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=MARK); d.text((x - 6, y - 12), str(n), font=fontb, fill=(0, 0, 0))
    if txt:
        d.text((x + 16, y - 10), txt, font=fonts, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))


def sheet(cls):
    g, Qg = game_panel('arch_' + cls, 2)
    rf, T = ref_panel(cls)
    wn = 'world_' + cls + '_right'
    w, Qw = game_panel(wn, 4)
    mg, mr, mw = M['game']['arch_' + cls], M['ref'][cls], M['game'][wn]
    pad, head = 20, 60
    W = g.width + rf.width + w.width + 4 * pad
    H = head + max(g.height, rf.height, w.height) + 330
    out = Image.new('RGB', (W, H), (22, 22, 30)); d = ImageDraw.Draw(out)
    xs = [pad, 2 * pad + g.width, 3 * pad + g.width + rf.width]
    for x, im, t in ((xs[0], g, 'игра: арка меню (x2), ' + cls), (xs[1], rf, 'эталон: ' + os.path.basename(REFS[cls])), (xs[2], w, 'игра: мир 84 px (x4)')):
        out.paste(im, (x, head)); d.text((x, 20), t, font=fontb, fill=(240, 240, 240))
    o = lambda xy, x: (xy[0] + x, xy[1] + head)
    # 1: arms
    tag(d, o(Qg('elbowR'), xs[0] + 18), 1, f"{mg['arms']['near_R_screen_right']['inner_angle_deg']:.0f}°")
    tag(d, o(Qg('elbowL'), xs[0] - 30), 1, f"{mg['arms']['far_L_screen_left']['inner_angle_deg']:.0f}°")
    R = REF_PTS[cls]
    if R['L']:
        tag(d, o(T(R['L'][1]), xs[1] - 30), 1, f"{mr['arms']['screen_left']['inner_angle_deg']:.0f}°")
        tag(d, o(T(R['R'][1]), xs[1] + 18), 1, f"{mr['arms']['screen_right']['inner_angle_deg']:.0f}°")
    # 2: the world figure
    tag(d, o(Qw('top'), xs[2] - 40), 2)
    # 3: limb tone (shins)
    sg = mg['tone']['shin']; sr = mr['tone']['shin']
    tag(d, o(Qg('kneeL'), xs[0] - 40), 3, f"L*{sg['far_L_screen_left'][0]:.0f}")
    tag(d, o(Qg('kneeR'), xs[0] + 30), 3, f"L*{sg['near_R_screen_right'][0]:.0f}")
    tag(d, o(T(R['ankL']), xs[1] - 40), 3, f"L*{sr['screen_left'][0]:.0f}")
    tag(d, o(T(R['ankR']), xs[1] + 30), 3, f"L*{sr['screen_right'][0]:.0f}")
    # 4: feet
    a, b = o(Qg('ankleL'), xs[0]), o(Qg('ankleR'), xs[0]); y = max(a[1], b[1]) + 30
    d.line((a[0], y, b[0], y), fill=MARK, width=3); tag(d, ((a[0] + b[0]) / 2, y + 20), 4, f"{mg['feet_dx_H']:.2f}H, Δy {mg['feet_depth_dy_H']:.3f}H")
    a, b = o(T(R['ankL']), xs[1]), o(T(R['ankR']), xs[1]); y = max(a[1], b[1]) + 40
    d.line((a[0], y, b[0], y), fill=MARK, width=3); tag(d, ((a[0] + b[0]) / 2, y + 20), 4, f"{mr['feet_dx_H']:.2f}H, Δy {mr['feet_depth_dy_H']:.3f}H")
    # 5: cape vs the screen-left thigh
    th = o(Qg('hipL'), xs[0]); kn = o(Qg('kneeL'), xs[0]); c = ((th[0] + kn[0]) / 2 - 50, (th[1] + kn[1]) / 2)
    cs = mg.get('cape_share_on_thigh')
    tag(d, c, 5, f"плащ на бедре {cs['far_L'] * 100:.0f}%" if cs else None)
    y0 = head + max(g.height, rf.height, w.height) + 16
    tg = mg['tone']; tr = mr['tone']
    def tl(t, k):
        v = t.get(k)
        if not v:
            return '-'
        if 'far_L_screen_left' in v:
            return f"{v['far_L_screen_left'][0]:.0f} / {v['near_R_screen_right'][0]:.0f}"
        return f"{v['screen_left'][0]:.0f} / {v['screen_right'][0]:.0f}"
    lines = [
        'голубой = левая часть экрана (rig L, игра рисует её «дальней»: Ufar, до тела); жёлтый = правая часть экрана (rig R, «ближняя»)',
        f"1 руки: угол в локте игра L {mg['arms']['far_L_screen_left']['inner_angle_deg']:.0f}° / R {mg['arms']['near_R_screen_right']['inner_angle_deg']:.0f}°"
        + (f";  эталон {mr['arms']['screen_left']['inner_angle_deg']:.0f}° / {mr['arms']['screen_right']['inner_angle_deg']:.0f}°" if 'arms' in mr else '')
        + f";  плечи врозь игра {mg['shoulders_dx_H']:.2f}H",
        f"2 мир 84 px: тот же скелет: локти {mw['arms']['far_L_screen_left']['inner_angle_deg']:.0f}°/{mw['arms']['near_R_screen_right']['inner_angle_deg']:.0f}°, стопы {mw['feet_dx_H']:.2f}H, Δy 0, тон голени L*{tl(mw['tone'], 'shin')}",
        f"3 тон L* (лево/право экрана): голень игра {tl(tg, 'shin')}  эталон {tl(tr, 'shin')};  предплечье игра {tl(tg, 'forearm')}  эталон {tl(tr, 'forearm')}",
        f"4 стопы: игра {mg['feet_dx_H']:.2f}H, по глубине 0, носок задней до лодыжки передней {mg['toe_far_to_ankle_near_H']:.3f}H (стопы в профиль, встык);  эталон {mr['feet_dx_H']:.2f}H, дальняя выше на {mr['feet_depth_dy_H']:.3f}H, стопы в 3/4",
        f"5 плащ: игра закрывает {cs['far_L'] * 100:.0f}% бедра левой (экранной) ноги в арке, 0% в мире; эталон: 0%, плащ за обеими ногами" if cs else '5 плащ: -',
    ]
    for i, t in enumerate(lines):
        d.text((pad, y0 + i * 26), t, font=font, fill=(235, 235, 235))
    out.save(f'frames/pose_ref_2160/compare_{cls}' + ('' if TAG == 'game' else '_' + TAG.split('_')[-1]) + '.png')


for c in ('warrior', 'archer', 'mage'):
    sheet(c)
