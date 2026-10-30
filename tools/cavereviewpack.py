import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


parser = argparse.ArgumentParser()
parser.add_argument('--out', default='frames/cave_review_r2')
args = parser.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

qa = json.loads(Path('frames/cave_333_qa/report.json').read_text())
cave = json.loads(Path('frames/cave_333_delivery/report.json').read_text())
water = json.loads(Path('frames/cave_333_water/report.json').read_text())
loot = json.loads(Path('frames/cave_333_loot/report.json').read_text())
exit_check = json.loads(Path('frames/cave_333_exit/report.json').read_text())
if len(qa['fails']) != 1 or not qa['fails'][0].startswith('boss_combo:'):
    raise SystemExit('Review the changed full QA failures before preparing the package')
if cave['errors'] != ['cave_fireball_deep_0: repeated frame changed'] or not all(s['pure'] for s in cave['states'].values()):
    raise SystemExit('Review the changed cave QA failures before preparing the package')
if water['failures'] or loot['hidden'] or loot['errors']:
    raise SystemExit('Water or loot checks failed')
if exit_check['errors'] or not exit_check['states']['cave_arena_exit']['exitValid']:
    raise SystemExit('Exit fixture check failed')

files = set()
for pattern in [
    'TASKS*.md', 'study/CAVE_*.md', 'study/CRITICS.md', 'study/refs/*.png',
    'study/refs/README.md', 'study/critique/cave_*_r1.md', 'live/*.js', 'live/index.html',
    'tools/cave*.*', 'tools/bankcheck.mjs', 'tools/watercheck.mjs', 'tools/lootvis.mjs',
    'tools/ambushcheck.cjs', 'tools/crabcheck.mjs', 'tools/serpent*.*', 'live/tune.cjs', 'art/style_bible.txt',
    'frames/cave_333_*.log', 'frames/cave_333_qa/report.json', 'frames/cave_333_qa/cycle_*.png',
    'frames/cave_333_delivery/*', 'frames/cave_333_exit/*', 'frames/cave_actor_series/*', 'frames/cave_fire_cases/*',
    'frames/cave_results/*', 'frames/cave_mapcheck/*', 'frames/cave_333_loot/*', 'frames/cave_333_water/*',
    'frames/cave_333_repeat_probe/*', 'frames/cave_333_repeat_trace/*',
    'frames/cave_333_repeat_clear/*', 'frames/cave_333_repeat_pixels/*',
    'frames/cave_330_delivery/*', 'frames/cave_330_measured/hero_facings.png',
    'frames/cave_330_measured/metrics*.json', 'frames/cave_323_bank/*',
    'frames/cave_323_wading_final/*', 'frames/cave_322_materials_final/*',
    'frames/cave_reactions/*', 'frames/cave_density/report.json',
]:
    files.update(p for p in Path('.').glob(pattern) if p.is_file())

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


manifest = {
    'status': 'prepared_with_known_failures',
    'critics_launched': False,
    'balance_run': False,
    'source_base': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'full_qa': {'states': len(qa['states']), 'cycles': len(qa['cycles']), 'effects': len(qa['anim']), 'failures': qa['fails']},
    'cave_qa': {'states': len(cave['states']), 'pure': True, 'failures': cave['errors']},
    'loot': {'mode': loot['mode'], 'items': loot['items'], 'hidden': len(loot['hidden'])},
    'files': [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in sorted(files)],
}
body = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
(out / 'manifest.json').write_text(body)
archive = out.with_suffix('.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in sorted(files):
        z.write(p, str(p))
    z.writestr('manifest.json', body)
with zipfile.ZipFile(archive) as z:
    if z.testzip():
        raise SystemExit('Archive CRC check failed')
print(f'Review package: {archive}, {len(files)} files, {archive.stat().st_size} bytes; two known QA failures retained')
