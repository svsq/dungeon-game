"""rigarg.py — the rig a character fix runs on (TASKS 2148, docs/LOOKS_2148.md §5): the class's accepted look (`hero`, `mage`,
`archer`) or a new look of it (`hero_b`, `mage_c`, `archer_b`, …: live/data_hero.js D.LOOKS, the rig `<rig of the class>_<id>`).

Every fix of docs/CHAR_REGEN_2146.md §9–29 takes
  --rig NAME[,NAME…]   (repeatable) the rigs to work on; without it the accepted looks the fix was written for, as before
  --fresh              the step's source is the part in art/gen as it is now (a new cut), frozen again into art/old/<name>-<tag>.png;
                       without it the frozen copy is the source when there is one (a step run again starts from the same pixels)
A fix's numbers were tuned on the accepted look's drawing (rows of a belt, a collar, a hem). A new look takes its own from
art/look_params.json ({rig: {script: {NAME: value}}}); a number it does not set is the accepted look's, said on stderr."""
import json, os, re, shutil, subprocess, sys

BASES = {'hero': 'warrior', 'mage': 'mage', 'archer': 'archer'}
PARAMS = 'art/look_params.json'
_warned = set()


def base(rig):
    """the accepted look's rig of the class rig belongs to: hero_b → hero"""
    b = rig.split('_')[0]
    if b not in BASES or not re.fullmatch(r'[a-z]+(_[a-z0-9]+)?', rig): sys.exit(f'{rig}: not a hero rig (hero, mage, archer or <one of them>_<look>)')
    return b


def cls(rig):
    return BASES[base(rig)]


def accepted(rig):
    return rig in BASES


def take(default, argv=None):
    """pops --rig and --fresh from argv (sys.argv by default): (rigs, fresh); rigs is default without --rig"""
    argv = sys.argv if argv is None else argv; rigs, fresh, i = [], False, 1
    while i < len(argv):
        if argv[i] == '--rig' and i + 1 < len(argv): rigs += argv[i + 1].split(','); del argv[i:i + 2]
        elif argv[i].startswith('--rig='): rigs += argv[i][6:].split(','); del argv[i]
        elif argv[i] == '--fresh': fresh = True; del argv[i]
        else: i += 1
    for r in rigs: base(r)
    return (list(dict.fromkeys(rigs)) or list(default)), fresh


def param(rig, script, key, value, required=False):
    """value as tuned on the accepted look; a new look's own from art/look_params.json, else value (said once on stderr), or an
    exit when required (a number of the drawing itself, such as the hands as cut, that the accepted look's would put wrong)"""
    if accepted(rig): return value
    own = (json.load(open(PARAMS)) if os.path.exists(PARAMS) else {}).get(rig, {}).get(script, {})
    if key in own: return _like(own[key], value)
    if required: sys.exit(f'{rig}: {script} needs {key} in {PARAMS} ({base(rig)}: {json.dumps(value)})')
    if (rig, script, key) not in _warned:
        _warned.add((rig, script, key)); print(f'{rig}: {script} {key} is {base(rig)}\'s (set it in {PARAMS})', file=sys.stderr)
    return value


def _like(v, d):
    """a JSON value in the shape of the default it replaces: lists back to tuples where the default has tuples"""
    if isinstance(d, tuple) and isinstance(v, list): return tuple(_like(x, d[0] if d else None) for x in v)
    if isinstance(d, dict) and isinstance(v, dict): return {k: _like(x, next(iter(d.values()), None)) for k, x in v.items()}
    if isinstance(d, list) and isinstance(v, list): return [_like(x, d[0] if d else None) for x in v]
    return v


def head(rig):
    """the rows above which the torso is the cell-painted head, {body, body_back}: tools/gear.py NEW_LOOK, a new look's own from
    art/look_params.json {rig: {gear: {NEW_LOOK: …}}}"""
    from gear import NEW_LOOK
    return NEW_LOOK.get(rig) or param(rig, 'gear', 'NEW_LOOK', NEW_LOOK[base(rig)])


def frozen(name, tag, fresh=False, src=None):
    """art/old/<name>-<tag>.png, the step's source: frozen once from src (art/gen/<name>.png), or again with fresh"""
    old = f'art/old/{name}-{tag}.png'
    if fresh or not os.path.exists(old): shutil.copyfile(src or f'art/gen/{name}.png', old)
    return old


_looks = None
def look(rig):
    """the look's own data as live/data_hero.js gives it, the class's `look` under the look's line (its `art` alias left out: a new
    look's numbers are wanted while its art is still being made)"""
    global _looks
    if _looks is None:
        js = ("const T=new Proxy(function(k){return k},{get:(t,p)=>p in t?t[p]:()=>{}});globalThis.TXT=T;require('./live/data_hero.js');"
              "const D=globalThis.DATA,o={};for(const [cls,C] of Object.entries(D.CLASSES))for(const id of D.LOOK_IDS){"
              "const own=Object.assign({},C.looks[id]);delete own.art;const rig=id==='a'?C.look.rig:C.look.rig+'_'+id;"
              "o[rig]=Object.assign({},C.look,own,{id,cls,rig})}console.log(JSON.stringify(o))")
        _looks = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True).stdout)
    if rig not in _looks: sys.exit(f'{rig}: no such look in live/data_hero.js (D.LOOKS)')
    return _looks[rig]


def rigs_js():
    return os.environ.get('RIGS_JS', 'live/rigs.js')


def read_rigs():
    return json.loads(re.sub(r'^window\.RIGS = |;\s*$', '', open(rigs_js()).read().strip()))
