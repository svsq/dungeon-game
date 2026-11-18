#!/usr/bin/env python3
"""TASKS 2148 step 0: a fix run with --rig on a new look must do to that look what it does to the accepted one. The accepted look's
files are copied under the new look's name (hero → hero_b: art/gen, art/old, live/assets and their manifest, RIGS entries,
art/softbones.json; gear sheets and art/gear.json for gear.py), then one command runs twice on clones of the tree: as it is on
the accepted looks, and with --rig NEW on the copy. Every file the first run wrote for the accepted look must be written,
byte for byte, under the new name by the second, and its stdout must be the same with the names swapped back.
  python3 tools/measure/looks2148/asrig.py DIR hero:hero_b [--params FILE] [--restore b600f44c] -- python3 tools/fix_2167.py run
--params: a JSON written as the copy's art/look_params.json (the archer's HAND0, which a new look has to set). Exit 1 on a difference."""
import hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(os.environ.get('ROOT') or Path(__file__).resolve().parents[3])
args = sys.argv[1:]; cut = args.index('--'); cmd, opts = args[cut + 1:], args[:cut]
DIR = Path(opts[0]); SRC, DST = opts[1].split(':')
restore = opts[opts.index('--restore') + 1] if '--restore' in opts else None
params = opts[opts.index('--params') + 1] if '--params' in opts else None
git = lambda *a, **k: subprocess.run(['git', '-C', str(ROOT), *a], check=True, capture_output=True, **k).stdout
JS = lambda p, var: json.loads(re.sub(rf'^window\.{var} = |;\s*$', '', p.read_text().strip()))


def clone(w):
    if w.exists(): shutil.rmtree(w)
    w.mkdir(parents=True)
    subprocess.run(['cp', '-cR', str(ROOT / 'art'), str(ROOT / 'live'), str(ROOT / 'ref2game.json'), str(w)], check=True)
    subprocess.run(['cp', '-R', str(ROOT / 'tools'), str(w)], check=True)
    if restore:
        gone = [f for st, _, f in (l.partition('\t') for l in git('show', '--name-status', '--format=', restore, text=True).splitlines())
                if st == 'D' and f.count('/') == 2 and f.startswith('art/old/') and f[8:].split('__')[0] in ('hero', 'mage', 'archer') and not (w / f).exists()]
        if gone: subprocess.run(f'git -C "{ROOT}" archive {restore}^ {" ".join(gone)} | tar -x -C "{w}"', shell=True, check=True)


def gear_map(w):
    """{accepted look's set: the look's set} as gear.py --rig names them"""
    code = ("import sys, json; sys.argv = ['g']; sys.path.insert(0, 'tools'); import gear; b, r = %r, %r; "
            "print(json.dumps({n: r + n[len(b):] if n.startswith(b + '_') else r + '_' + n for n in gear.SETS "
            "if gear.opt(n).get('src', 'hero') == b and not gear.opt(n).get('base')}))") % (SRC, DST)
    return json.loads(subprocess.run([sys.executable, '-c', code], cwd=w, capture_output=True, text=True, check=True).stdout)


def rename(name, gm):
    if name.startswith(SRC + '__'): return DST + name[len(SRC):]
    m = re.fullmatch(r'gear_(.+?)(_tpl)?', name)
    if m and m.group(1) in gm: return f'gear_{gm[m.group(1)]}{m.group(2) or ""}'
    return None


def copy_look(w):
    gm = gear_map(w)
    for d in ('art/gen', 'art/old', 'live/assets'):
        for p in sorted((w / d).glob('*.png')):
            stem, _, tag = p.stem.partition('-') if d == 'art/old' else (p.stem, '', '')
            n = rename(stem, gm)
            if n: shutil.copyfile(p, p.with_name(n + (f'-{tag}' if tag else '') + '.png'))
    A = JS(w / 'live/assets.js', 'ASSETS'); A.update({rename(k, gm): v for k, v in list(A.items()) if rename(k, gm)})
    (w / 'live/assets.js').write_text('window.ASSETS = ' + json.dumps(A) + ';\n')
    R = JS(w / 'live/rigs.js', 'RIGS'); R.update({rename(k, gm) or DST: v for k, v in list(R.items()) if k == SRC or k.startswith(SRC + '__')})
    (w / 'live/rigs.js').write_text('window.RIGS = ' + json.dumps(R) + ';\n')
    S = json.loads((w / 'art/softbones.json').read_text()); S.update({rename(k, gm): v for k, v in list(S.items()) if rename(k, gm)})
    (w / 'art/softbones.json').write_text(json.dumps(S, indent=1))
    G = json.loads((w / 'art/gear.json').read_text()); G.update({gm[k]: v for k, v in list(G.items()) if k in gm})
    (w / 'art/gear.json').write_text(json.dumps(G, indent=1))
    if params: shutil.copyfile(params, w / 'art/look_params.json')
    return gm


def hashes(w):
    out = {}
    for top in ('art', 'live'):
        for p in (w / top).rglob('*'):
            k = str(p.relative_to(w))
            if p.is_file() and '__pycache__' not in p.parts and not k.startswith('art/logs/'):
                st = p.stat(); out[k] = (hashlib.md5(p.read_bytes()).hexdigest(), st.st_mtime_ns)
    return out


def run(w, c):
    r = subprocess.run(c, cwd=w, env=dict(os.environ, ROOT=str(w)), capture_output=True, text=True)
    return r.returncode, r.stdout.replace(str(w), '<W>'), r.stderr


wa, wb = DIR / 'a', DIR / 'b'; clone(wa); clone(wb); gm = copy_look(wb)
ba, bb = hashes(wa), hashes(wb)
(ca, oa, ea), (cb, ob, eb) = run(wa, cmd), run(wb, cmd + ['--rig', DST])
ha, hb = hashes(wa), hashes(wb)
wrote = lambda b, h: {k for k in set(b) | set(h) if b.get(k) != h.get(k)}
mine = lambda k: rename(Path(k).stem.partition('-')[0] if k.startswith('art/old/') else Path(k).stem, gm)
wa_ = sorted(k for k in wrote(ba, ha) if mine(k)); wb_ = wrote(bb, hb); bad = []
for k in wa_:
    stem = Path(k).stem; tag = stem.partition('-')[2] if k.startswith('art/old/') else ''
    k2 = str(Path(k).with_name(mine(k) + (f'-{tag}' if tag else '') + Path(k).suffix))
    same = ha.get(k, (None,))[0] == hb.get(k2, (None,))[0]
    if not same: bad.append(k)
    print(f'  {"same" if same else "DIFF"} {k} → {k2}{"" if k2 in wb_ else "  (not written)"}')
others = sorted(k for k in wb_ if not mine(k) and not any(x in k for x in (f'/{DST}__', f'_{DST}_', f'gear_{DST}')) and k not in ('live/rigs.js', 'live/assets.js', 'art/gear.json'))
back = ob.replace(DST + '__', SRC + '__').replace(f'{DST} ', f'{SRC} ')
src_only = '\n'.join(l for l in oa.splitlines() if SRC + '__' in l or not re.search(r'(hero|mage|archer)__', l))
print('$', ' '.join(cmd), '| --rig', DST)
print(f'exit {ca} / {cb}; {len(wa_)} {SRC} files written, {len(bad)} differ; other files the --rig run touched: {others or "none"}')
if ca or cb: print('stderr a:', ea.strip()[-600:]); print('stderr b:', eb.strip()[-600:])
print('stdout (b with names swapped back):\n' + back[-1200:])
if '--keep' not in opts: shutil.rmtree(DIR)
sys.exit(1 if bad or others or ca != cb else 0)
