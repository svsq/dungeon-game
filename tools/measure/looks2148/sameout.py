#!/usr/bin/env python3
"""TASKS 2148 step 0: a character fix made rig-parametric (tools/rigarg.py) must write for the accepted looks what it wrote before.
Runs one command twice in two scratch copies of the tree (art/, live/, ref2game.json cloned, so cheap on APFS): once with tools/
as at REV, once with the working tree's tools/; then compares every file the command wrote under art/ and live/ (art/logs left
out: generation logs of other runs; a file rewritten with its own bytes counts as written) and its stdout.
Each output that differs from the tree's own copy is also checked against the committed art/gen (git HEAD): «= gen» when equal.
  python3 tools/measure/looks2148/sameout.py DIR [--rev HEAD] [--restore b600f44c] -- python3 tools/gridify_2155.py run
--restore REV: the art/old/{hero,mage,archer}__* frozen sources deleted by REV (2186 removed 503 of them) brought back from REV^
first, so a fix that starts from its frozen copy reads the copy it was written for. Exit 1 when the two runs differ."""
import hashlib, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(os.environ.get('ROOT') or Path(__file__).resolve().parents[3])
args = sys.argv[1:]; cut = args.index('--'); cmd, opts = args[cut + 1:], args[:cut]
DIR = Path(opts[0]); rev = opts[opts.index('--rev') + 1] if '--rev' in opts else 'HEAD'
restore = opts[opts.index('--restore') + 1] if '--restore' in opts else None
git = lambda *a, **k: subprocess.run(['git', '-C', str(ROOT), *a], check=True, capture_output=True, **k).stdout


def tree(w, tools):
    if w.exists(): shutil.rmtree(w)
    w.mkdir(parents=True)
    subprocess.run(['cp', '-cR', str(ROOT / 'art'), str(ROOT / 'live'), str(ROOT / 'ref2game.json'), str(w)], check=True)
    if restore:
        gone = [f for st, _, f in (l.partition('\t') for l in git('show', '--name-status', '--format=', restore, text=True).splitlines())
                if st == 'D' and f.count('/') == 2 and f.startswith('art/old/') and f[8:].split('__')[0] in ('hero', 'mage', 'archer') and not (w / f).exists()]
        if gone: subprocess.run(f'git -C "{ROOT}" archive {restore}^ {" ".join(gone)} | tar -x -C "{w}"', shell=True, check=True)
    if tools == 'tree': subprocess.run(['cp', '-R', str(ROOT / 'tools'), str(w)], check=True)
    else: subprocess.run(f'git -C "{ROOT}" archive {tools} tools | tar -x -C "{w}"', shell=True, check=True)


def hashes(w):
    out = {}
    for top in ('art', 'live'):
        for p in (w / top).rglob('*'):
            k = str(p.relative_to(w))
            if p.is_file() and '__pycache__' not in p.parts and not k.startswith('art/logs/'): out[k] = (hashlib.md5(p.read_bytes()).hexdigest(), p.stat().st_mtime_ns)
    return out


def run(w):
    r = subprocess.run(cmd, cwd=w, env=dict(os.environ, ROOT=str(w)), capture_output=True, text=True)
    return r.returncode, r.stdout.replace(str(w), '<W>'), r.stderr[-2000:]


res = {}
for side, tools in (('old', rev), ('new', 'tree')):
    w = DIR / side; tree(w, tools); b = hashes(w)
    res[side] = (run(w), b, hashes(w))
(c0, o0, e0), b0, h0 = res['old']; (c1, o1, e1), b1, h1 = res['new']
wrote = lambda b, h: {k for k in set(b) | set(h) if b.get(k) != h.get(k)}
changed = sorted(wrote(b0, h0) | wrote(b1, h1))
md5 = lambda h, k: h.get(k, ('-',))[0]
diff = [k for k in changed if md5(h0, k) != md5(h1, k)]
print('$', ' '.join(cmd)); print(f'exit {c0} / {c1}; stdout {"same" if o0 == o1 else "DIFFERS"}; {len(changed)} files written, {len(diff)} differ')
if c0 or c1: print('stderr old:', e0.strip()[-600:]); print('stderr new:', e1.strip()[-600:])
for k in changed:
    g = ''
    if k.startswith('art/gen/') and k in h1:
        try: g = '= gen' if hashlib.md5(git('show', f'HEAD:{k}')).hexdigest() == h1[k][0] else '≠ gen'
        except subprocess.CalledProcessError: g = 'new file'
    print(f'  {"DIFF" if k in diff else "same"} {md5(h1, k)[:10]} {g:8s} {k}')
if o0 != o1: print('--- old stdout\n' + o0[-1500:] + '\n--- new stdout\n' + o1[-1500:])
if '--keep' not in opts: shutil.rmtree(DIR)
sys.exit(1 if diff or o0 != o1 or c0 != c1 else 0)
