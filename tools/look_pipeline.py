#!/usr/bin/env python3
"""look_pipeline.py — the recipe of one new hero look (TASKS 2148, docs/LOOKS_2148.md §5): from the accepted sheets to a look in the
state of the class's «a» after every fix of docs/CHAR_REGEN_2146.md §9–29, as the exact commands in their order.

  python3 tools/look_pipeline.py RIG [STAGE…]          print the commands (a dry run: nothing is read or written but the config)
  python3 tools/look_pipeline.py RIG [STAGE…] --run    run them, stopping at the first that fails

RIG: hero_b, hero_c, mage_b, mage_c, archer_b, archer_c (tools/rigarg.py). STAGE, in this order (all of them without any):
  cut        regen_2146.py front, back (and quiver for an archer) into the cut folder on a scratch copy of live/rigs.js; then look
  install    the cut's parts into art/gen, RIGS.<rig> into live/rigs.js, the portrait; the archer's HAND0; prep
  seed       <rig>__body, __cape, __body_back in art/softbones.json copied from the class's «a» where missing; then fit them by hand
  softbones  prep, softbones.py, prep of the weights
  gear       gear.py make of the class's sets; then the generation (a sonnet low subagent) of their sheets
  gearcut    gear.py cut, the shoulder caps, the mage's grid heads; prep
  fix        the fix chain of the class, each step with --rig (and the gridify lines the steps print, run as printed)
  checks     the measures and game checks the look has to pass; the data line to write (docs/LOOKS_2148.md §5 step 7)
@<rig> in a prep line is every art/gen/<rig>__*.png at the time it runs.
A step marked [lock] writes live/rigs.js or live/assets.js: with --run it waits for the directory $ART_LOCK (when set) to be free,
holds it and lets it go after the step. The look's inputs (sheets, small reference, flags) are art/look_params.json → <rig> →
pipeline; what is not set there is a placeholder in the dry run and the class's «a» flags (CHAR_REGEN_2146.md §6–8)."""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigarg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SKILL = os.path.join(os.environ.get('REF2GAME_SKILL', os.path.expanduser('~/.claude/skills/ref2game')), 'scripts')
STAGES = ('cut', 'install', 'seed', 'softbones', 'gear', 'gearcut', 'fix', 'checks')
TAG = '20261118-2148'
# the «a» cut's flags (CHAR_REGEN_2146.md §6–8), the start for a look of the class
FRONT = {'warrior': [], 'archer': ['--cape-hem', '0.72', '--neck', '60', '--head-dy', '2'],
         'mage': ['--skirt', '--head-dy', '6', '--skirt-hem', '0.9', '--skirt-split', '0.66']}
BACK = {'warrior': [], 'archer': ['--back-k', '0.78', '--back-dx', '-8'], 'mage': []}
QUIVER = ['--q-at', '-0.5,0.06', '--q-h', '0.38']
GEAR = {'warrior': ['shirt', 'plate', 'hood', 'helm_le', 'helm_kn'], 'mage': ['mage_leather', 'mage_hood', 'mage_circlet', 'mage_helm_le'],
        'archer': ['archer_hood', 'archer_helm_le']}
CHECKS = ['lookCheck', 'heroTexCheck', 'heroPoseCheck', 'heroShoulderCheck', 'heroFistCheck', 'heroCapeCheck', 'heroBackCheck',
          'heroHoodCheck', 'heroGripCheck', 'portCheck']


class Step:
    def __init__(self, args, lock=False, follow=True, note=''):
        self.args, self.lock, self.follow, self.note = args, lock, follow, note


def py(script, *a, **k): return Step(['python3', f'tools/{script}', *a], **k)
def note(text): return Step([], note=text)


def config(rig):
    P = (json.load(open(rigarg.PARAMS)) if os.path.exists(rigarg.PARAMS) else {}).get(rig, {}).get('pipeline', {})
    cls, lid = rigarg.cls(rig), rig.split('_')[1]; frames = f'frames/hero_{cls}_{lid}_2148'
    get = lambda k, d: P.get(k, d)
    return dict(cls=cls, id=lid, cut=get('cut', f'{frames}/cut1'), sheet=get('sheet', f'<sheet: {frames}/gen/hero_parts_{cls}_{lid}_<n>.png>'),
                back=get('back', f'<back: {frames}/gen/hero_body_back_{cls}_{lid}_<n>.png>'), small=get('small', f'<small ref: art/char_refs/{cls}_{lid}_small_<…>.png>'),
                portrait=get('portrait', f'<portrait: {frames}/gen/portrait_{cls}_{lid}_<n>.png>'), front=get('front', FRONT[cls]),
                back_flags=get('back_flags', BACK[cls]), quiver=get('quiver', QUIVER), gear=get('gear', GEAR[cls]),
                tone=get('tone', False), jobs=get('gear_jobs', f'art/jobs_hero_{cls}_{lid}_2148_gear.json'))


def bodies(rig):
    from fix_2167 import BODIES
    b = BODIES[rigarg.base(rig)]
    return b + [x + '_menu' for x in b if not x.endswith('_nh')]


def stage_cut(rig, C):
    env = ['env', f'RIGS_JS={C["cut"]}/rigs.js']
    out = [Step(['mkdir', '-p', C['cut']]), Step(['cp', 'live/rigs.js', f'{C["cut"]}/rigs.js']),
           Step(env + ['python3', 'tools/regen_2146.py', 'front', rig, C['sheet'], C['small'], '--out', C['cut'], *C['front']],
                note='prints eye (look.eye), neck, the hands'),
           Step(env + ['python3', 'tools/regen_2146.py', 'back', rig, C['back'], '--out', C['cut'], *C['back_flags']])]
    if C['cls'] == 'archer': out.append(Step(env + ['python3', 'tools/regen_2146.py', 'quiver', rig, 'art/gen/it_quiver.png', '--out', C['cut'], *C['quiver']]))
    return out + [note(f'look at {C["cut"]}/preview.png, preview_menu.png, preview_back.png, grid42_x8.png before installing')]


def stage_install(rig, C):
    out = [py('regen_2146.py', 'install', rig, C['cut'], '--tag', TAG, '--rigs', f'{C["cut"]}/rigs.js', lock=True),
           Step(['cp', C['portrait'], f'art/gen/portrait_{rig}.png'])]
    if C['cls'] == 'archer': out.append(py('look_pipeline.py', rig, 'hands', note='HAND0 of archer_2170 (the hands as cut) into art/look_params.json'))
    return out + [Step(['python3', 'tools/prep.py', '--only', f'@{rig},portrait_{rig}'], lock=True)]


def stage_seed(rig, C):
    return [py('look_pipeline.py', rig, 'seed'), note(f'fit the polygons, roots and tips of the seeded entries to {rig} (CHAR_REGEN_2146.md step 5)')]


def stage_softbones(rig, C):
    n = [f'{rig}__body', f'{rig}__cape', f'{rig}__body_back']
    return [Step(['python3', 'tools/prep.py', '--only', ','.join(n)], lock=True),
            Step(['python3', f'{SKILL}/softbones.py', 'art/softbones.json', *n], lock=True),
            Step(['python3', 'tools/prep.py', '--only', ','.join(x + '_w' for x in n)], lock=True)]


def stage_gear(rig, C):
    return [py('gear.py', 'make', '--rig', rig, *C['gear']),
            note(f'generation (a sonnet low subagent): python3 {SKILL}/gen.py batch {C["jobs"]} --jobs 4 (refs: the templates '
                 f'art/gen/gear_{rig}_<set>_tpl.png); each accepted sheet to art/gen/gear_{rig}_<set>.png')]


def stage_gearcut(rig, C):
    out = [py('gear.py', 'cut', '--rig', rig, *C['gear']),
           py('measure/caps_2146.py', rig, '16', *bodies(rig), note='the shoulder caps (CHAR_REGEN_2146.md step 6.6)')]
    if C['cls'] == 'mage': out.append(py('measure/mageheads_2151.py', '--rig', rig))
    return out + [Step(['python3', 'tools/prep.py', '--only', f'@{rig}'], lock=True)]


def stage_fix(rig, C):
    r = ['--rig', rig]; out = []
    if C['cls'] == 'archer':
        out += [py('archer_2170.py', 'run', *r, lock=True, note='2152 tone, 2160 mirror, the short forearms, 2167 caps, 2155 grid, fists, hands')]
    else:
        if C['cls'] == 'warrior' and C['tone']: out.append(py('fix_2154.py', 'install', *r))
        mirrored = lambda: ['python3', 'tools/gridify_2155.py', 'run', *(near_arms(rig) or [f'{rig}__farmR', f'{rig}__farmR_<outfit>…'])]
        out += [py('gridify_2155.py', 'run', *r), py('fix_2160.py', 'mirror', *r), Step(mirrored), py('fix_2167.py', 'run', *r), py('fix_2167.py', 'grid', *r)]
        if C['cls'] == 'warrior':
            out += [py('warrior_2170.py', a, *r, lock=a == 'rig') for a in ('arms', 'rig', 'cape', 'steel', 'caps', 'fist')]
        else:
            out += [py('fix_mage_2170.py', 'heads', *r), py('fix_mage_2170.py', 'arms', *r), py('fix_mage_2170.py', 'rig', *r, lock=True)]
    out += [py('fix_2177.py', 'run', *r), py('fist_2177.py', 'run', *r)]
    if C['cls'] == 'warrior': out += [py('fix_2182.py', 'cape', *r), py('fix_2183.py', 'backs', *r)]
    if C['cls'] == 'mage': out += [py('fix_2183.py', 'hair', *r), py('fix_2183.py', 'fist', *r)]
    out.append(py('fix_2184.py', 'hood', *r))
    if C['cls'] == 'mage': out += [py('fix_2184.py', 'mage', *r), py('cup_2190.py', 'run', *r, note='prints ORB_CUP: the look\'s cup anchors'), py('fix_2193.py', 'hair', *r)]
    if C['cls'] == 'archer': out.append(py('fix_2184.py', 'olive', *r))
    out.append(Step(['python3', 'tools/prep.py', '--only', f'@{rig}'], lock=True, note='fix_2191 / fix_2194 draw the prepped look (foot.cjs)'))
    side = 'fix_2194.py' if C['cls'] == 'mage' else 'fix_2191.py'
    out += [py(side, 'run', *r), py(side, 'sock', *r)]
    if C['cls'] == 'mage':
        out += [py('fix_2194.py', 'drape', *r), py('fix_2195.py', 'hem', *r),
                Step(['python3', 'tools/prep.py', '--only', f'{rig}__body_back'], lock=True),
                Step(['python3', f'{SKILL}/softbones.py', 'art/softbones.json', f'{rig}__body_back'], lock=True)]
    return out + [Step(['python3', 'tools/prep.py', '--only', f'@{rig}'], lock=True)]


def stage_checks(rig, C):
    return [py('jointgap.py', rig), py('measure/chars_assets/speckle.py'),
            note(f'live/data_hero.js CLASSES.{C["cls"]}.looks.{C["id"]}: drop art, set eye (printed by the cut), fist, arm.hold '
                 '(tools/measure/chars_ref/reach.py), sat; gear and a GEARS row if its sets differ'),
            *[Step(['node', '<scratchpad>/one.cjs', c]) for c in CHECKS],
            note('frames: node tools/qashot.mjs --states … (LOOKS_2148.md §7), gearsheet.mjs --cls ' + C['cls'])]


def near_arms(rig):
    from fix_2160 import near_arms as f
    return f(rig)


def prep_names(rig):
    """every art/gen part of the look (its prefix), for prep --only @rig"""
    return ','.join(sorted(f[:-4] for f in os.listdir('art/gen') if f.startswith(rig + '__') and f.endswith('.png')))


def seed(rig):
    """art/softbones.json: the look's entries copied from the class's «a» where it has none yet (the polygons are then fitted)"""
    path = 'art/softbones.json'; S = json.load(open(path)); b = rigarg.base(rig); done = []
    for p in ('body', 'cape', 'body_back'):
        if f'{rig}__{p}' not in S and f'{b}__{p}' in S: S[f'{rig}__{p}'] = json.loads(json.dumps(S[f'{b}__{p}'])); done.append(f'{rig}__{p}')
    json.dump(S, open(path, 'w'), indent=1); print('seeded', done or 'nothing (all there)')


def hands(rig):
    """HAND0 of tools/archer_2170.py: the look's hands as the cut placed them (before archer_2170 moves them up)"""
    P = json.load(open(rigarg.PARAMS)) if os.path.exists(rigarg.PARAMS) else {}; own = P.setdefault(rig, {}).setdefault('archer_2170', {})
    if 'HAND0' in own: sys.exit(f'{rig}: HAND0 already {own["HAND0"]}')
    g = rigarg.read_rigs()[rig]; own['HAND0'] = {'L': g['handL'], 'R': g['handR']}
    json.dump(P, open(rigarg.PARAMS, 'w'), indent=1); print(rig, 'HAND0', own['HAND0'])


def locked(fn):
    lock = os.environ.get('ART_LOCK')
    if not lock: return fn()
    while True:
        try: os.mkdir(lock); break
        except FileExistsError: time.sleep(5)
    try: return fn()
    finally: os.rmdir(lock)


def follow_up(out):
    """the gridify_2155 lines a step prints, run as printed (its prep lines are left to the stage's own prep)"""
    for line in out.splitlines():
        if line.startswith('python3 tools/gridify_2155.py run '): execute(Step(line.split()))


def execute(s, rig=None):
    args = s.args() if callable(s.args) else s.args
    args = [a.replace(f'@{rig}', prep_names(rig)) for a in args] if rig else args
    print('$', ' '.join(args), flush=True)
    if any(a.startswith('<') for a in args): sys.exit(f'not set: {[a for a in args if a.startswith("<")]} (art/look_params.json → {rig} → pipeline)')
    r = locked(lambda: subprocess.run(args, capture_output=True, text=True)) if s.lock else subprocess.run(args, capture_output=True, text=True)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr)
    if r.returncode: sys.exit(f'failed ({r.returncode}): {" ".join(args)}')
    if s.follow: follow_up(r.stdout)


def main():
    os.chdir(ROOT); argv = sys.argv[1:]; run = '--run' in argv; argv = [a for a in argv if a != '--run']
    if not argv: sys.exit(__doc__)
    rig, rest = argv[0], argv[1:]
    if rigarg.accepted(rig): sys.exit(f'{rig} is an accepted look: its art is in, the recipe is for a new one (hero_b, mage_c, …)')
    rigarg.base(rig)
    if rest[:1] == ['seed']: return seed(rig)
    if rest[:1] == ['hands']: return hands(rig)
    bad = [s for s in rest if s not in STAGES]
    if bad: sys.exit(f'unknown stage {bad}; stages: {" ".join(STAGES)}')
    C = config(rig)
    for st in [s for s in STAGES if not rest or s in rest]:
        print(f'\n## {st}')
        for s in globals()['stage_' + st](rig, C):
            if not s.args: print('#', s.note); continue
            if not run: print(('[lock] ' if s.lock else '') + ' '.join(s.args() if callable(s.args) else s.args) + (f'    # {s.note}' if s.note else '')); continue
            if s.note: print('#', s.note)
            if s.args[0] == 'node' and s.args[1].startswith('<'): print('# (run by hand)', ' '.join(s.args)); continue
            execute(s, rig)


if __name__ == '__main__':
    main()
