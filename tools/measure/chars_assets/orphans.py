# python3 tools/measure/chars_assets/orphans.py: hero rig textures in live/assets that no outfit reaches through scene_hero.js's GEARS
# table (suffix per slot; armour: body, body_back, uarm, thigh; gloves: farm; boots: shin, foot; helm: head, head_back; _nh with a helm;
# _menu in the arch; _w weight maps of a used part), with their bytes and width against the rig's
import os, json, re
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')); os.chdir(ROOT)
A = json.loads(re.sub(r'^window\.ASSETS = |;\s*$', '', open('live/assets.js').read().strip()))
RG = json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open('live/rigs.js').read().strip()))
GEARS = {'hero': {'armor': ['cl', '', 'pw', 'hd'], 'gloves': ['', 'pw'], 'boots': ['', 'pw'], 'helm': ['le', 'kn']},
         'mage': {'armor': ['', 'le', 'hd'], 'gloves': [''], 'boots': [''], 'helm': ['ci', 'le']},
         'archer': {'armor': ['', 'hd'], 'gloves': [''], 'boots': [''], 'helm': ['le']}}
tot = 0
for rig, G in GEARS.items():
    used = {f'{rig}__cape', f'{rig}__cape_w', f'{rig}__quiver'}
    sx = lambda s: '_' + s if s else ''
    for a in G['armor']:
        for b in ('body', 'body_back'):
            for nh in ('', '_nh'):
                for menu in ('', '_menu'):
                    k = f'{rig}__{b}{sx(a)}{nh}{menu}'
                    if k in A: used.add(k)
                    elif f'{rig}__{b}{nh}{menu}' in A: used.add(f'{rig}__{b}{nh}{menu}')
        for p in ('uarm', 'thigh'):
            for s in 'LR': used.add(f'{rig}__{p}{s}{sx(a)}' if f'{rig}__{p}{s}{sx(a)}' in A else f'{rig}__{p}{s}')
    for slot, parts in (('gloves', ('farm',)), ('boots', ('shin', 'foot'))):
        for g in G[slot]:
            for p in parts:
                for s in 'LR': used.add(f'{rig}__{p}{s}{sx(g)}' if f'{rig}__{p}{s}{sx(g)}' in A else f'{rig}__{p}{s}')
    for h in G['helm']:
        for k in (f'{rig}__head_{h}', f'{rig}__head_{h}_menu', f'{rig}__head_back_{h}'): used.add(k)
    used |= {f'{rig}__body_w', f'{rig}__body_back_w'}
    # (r2) scene_hero.js fine(): in the arch every drawn part takes its _menu copy when one exists
    used |= {u + '_menu' for u in list(used)}
    for k in sorted(x for x in A if x.startswith(rig + '__')):
        if k not in used:
            b = os.path.getsize(f'live/assets/{k}.png'); tot += b
            print(f'unused {k:26s} {A[k]["w"]}x{A[k]["h"]} (rig {RG[rig]["w"]}) {b // 1024} KB')
print('total unused', tot // 1024, 'KB')
