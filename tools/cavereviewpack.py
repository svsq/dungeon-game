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
runs = json.loads(Path('frames/cave_recapture/runs.json').read_text())
required_steps = set('tune actors_sim fire_sim results_sim reactions_sim ambush density art cave qa actors actor_sheets fire results exit map audio light bank wading materials palette palette_r1 regions crab serpent serpent_warnings serpent_motion serpent_metrics repeat loot water sheets'.split())
if required_steps - runs.keys():
    raise SystemExit(f'Missing capture steps: {sorted(required_steps - runs.keys())}')
if len(qa['states']) != 343 or len(qa['cycles']) != 30 or len(cave['states']) != 84:
    raise SystemExit('Review changed QA coverage before preparing the package')
known_qa = 'boss_combo: handL @34 pops 107.7 px (64 % of H, max 6 %): the motion breaks across the state change'
if qa['fails'] not in [[], [known_qa]]:
    raise SystemExit('Review the changed full QA failures before preparing the package')
if any(e != 'cave_fireball_deep_0: repeated frame changed' for e in cave['errors']) or not all(s['pure'] for s in cave['states'].values()):
    raise SystemExit('Review the changed cave QA failures before preparing the package')
unexpected = {name: r['exit_code'] for name, r in runs.items() if r['exit_code'] and name not in ['qa', 'cave']}
if unexpected:
    raise SystemExit(f'Review failed capture steps: {unexpected}')
if water['failures'] or loot['hidden'] or loot['errors']:
    raise SystemExit('Water or loot checks failed')
if exit_check['errors'] or not exit_check['states']['cave_arena_exit']['exitValid']:
    raise SystemExit('Exit fixture check failed')
for filename in [
    'frames/cave_mapcheck/report.json', 'frames/cave_reactions/audio.json',
    'frames/cave_330_delivery/report.json', 'frames/cave_323_bank/report.json',
    'frames/cave_323_wading_final/report.json', 'frames/cave_322_materials_final/report.json',
    'frames/cave_art_final/report.json', 'frames/crabcheck/report.json',
    'frames/serpentcheck/report.json', 'frames/serpent_warnings/report.json',
    'frames/serpentmotion/report.json', 'frames/cave_333_repeat_probe/report.json',
    'frames/cave_recapture/palette_comparison.png', 'frames/cave_recapture/hero_facings.png',
    'frames/cave_recapture/regions_comparison.png', 'frames/cave_recapture/materials.png',
    *[f'study/critique/cave_{role}_r1.md' for role in ['assets', 'fidelity', 'frame', 'game', 'motion']],
]:
    if not Path(filename).is_file():
        raise SystemExit(f'Missing review evidence: {filename}')
for name in qa['states']:
    if not Path('frames/cave_333_qa', name + '.png').is_file():
        raise SystemExit(f'Missing full QA frame: {name}')
for name in cave['states']:
    if not Path('frames/cave_333_delivery', name + '.png').is_file():
        raise SystemExit(f'Missing cave frame: {name}')
for folder in ['cave_actor_series', 'cave_fire_cases', 'cave_results']:
    for name, _ in json.loads(Path('frames', folder, 'states.json').read_text()):
        if not Path('frames', folder, name + '.png').is_file():
            raise SystemExit(f'Missing scenario frame: {folder}/{name}')

files = set()
for pattern in [
    'TASKS*.md', 'study/CAVE_*.md', 'study/CAVE_*.json', 'study/CRITICS.md', 'study/refs/*.png', 'ref.png',
    'study/refs/README.md', 'study/critique/cave_*_r1.md', 'live/*.js', 'live/index.html',
    'tools/cave*.*', 'tools/bankcheck.mjs', 'tools/watercheck.mjs', 'tools/lootvis.mjs', 'tools/bot.cjs',
    'tools/ambushcheck.cjs', 'tools/crabcheck.mjs', 'tools/serpent*.*', 'live/tune.cjs', 'art/style_bible.txt',
    'frames/cave_333_qa/*',
    'frames/cave_333_delivery/*', 'frames/cave_333_exit/*', 'frames/cave_actor_series/*', 'frames/cave_fire_cases/*',
    'frames/cave_results/*', 'frames/cave_mapcheck/*', 'frames/cave_333_loot/*', 'frames/cave_333_water/*',
    'frames/cave_333_repeat_probe/*', 'frames/cave_333_repeat_trace/*',
    'frames/cave_333_repeat_clear/*', 'frames/cave_333_repeat_pixels/*',
    'frames/cave_330_delivery/*', 'frames/cave_recapture/*', 'frames/cave_art_final/*',
    'frames/crabcheck/*', 'frames/serpentcheck/*', 'frames/serpent_warnings/*', 'frames/serpentmotion/**/*', 'frames/cave_323_bank/*',
    'frames/cave_323_wading_final/*', 'frames/cave_322_materials_final/*',
    'frames/cave_reactions/*', 'frames/cave_density/report.json',
]:
    files.update(p for p in Path('.').glob(pattern) if p.is_file())

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


manifest = {
    'status': 'prepared_with_known_failures' if qa['fails'] or cave['errors'] else 'prepared',
    'critics_launched': False,
    'balance_run': False,
    'capture_runs': runs,
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
print(f'Review package: {archive}, {len(files)} files, {archive.stat().st_size} bytes; QA failures: {qa["fails"] + cave["errors"]}')
