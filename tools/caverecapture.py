import argparse
import datetime
import json
from pathlib import Path
import subprocess
import sys


parser = argparse.ArgumentParser()
parser.add_argument('--resume', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
out = root / 'frames/cave_recapture'
out.mkdir(parents=True, exist_ok=True)
qa = str(Path.home() / '.claude/skills/ref2game/scripts/qa.mjs')
(out / 'project_qa.mjs').write_bytes(Path(qa).read_bytes())
py = sys.executable
steps = [
    ('tune', ['node', 'live/tune.cjs']),
    ('actors_sim', ['node', 'tools/caveactorcheck.cjs']),
    ('fire_sim', ['node', 'tools/cavefirecheck.cjs']),
    ('results_sim', ['node', 'tools/caveresultcheck.cjs']),
    ('reactions_sim', ['node', 'tools/cavereactioncheck.cjs']),
    ('ambush', ['node', 'tools/ambushcheck.cjs']),
    ('density', ['node', 'tools/cavedensitycheck.cjs']),
    ('art', [py, 'tools/caveartcheck.py']),
    ('cave', ['node', 'tools/cavecheck.mjs', '--out', 'frames/cave_333_delivery']),
    ('qa', ['node', qa, '--out', 'frames/cave_333_qa']),
    ('actors', ['node', 'tools/cavecheck.mjs', '--input', 'frames/cave_actor_series/states.json', '--out', 'frames/cave_actor_series']),
    ('actor_sheets', [py, 'tools/caveactorframes.py']),
    ('fire', ['node', 'tools/cavecheck.mjs', '--input', 'frames/cave_fire_cases/states.json', '--out', 'frames/cave_fire_cases']),
    ('results', ['node', 'tools/cavecheck.mjs', '--input', 'frames/cave_results/states.json', '--out', 'frames/cave_results']),
    ('exit', ['node', 'tools/cavecheck.mjs', '--only', 'cave_arena_exit', '--out', 'frames/cave_333_exit']),
    ('map', ['node', 'tools/cavemapcheck.mjs']),
    ('audio', ['node', 'tools/cavereactionaudio.mjs']),
    ('light', ['node', 'tools/cavelightcheck.mjs', '--out', 'frames/cave_330_delivery']),
    ('bank', ['node', 'tools/bankcheck.mjs', '--out', 'frames/cave_323_bank']),
    ('wading', ['node', 'tools/cavewadecheck.mjs', '--out', 'frames/cave_323_wading_final']),
    ('materials', ['node', 'tools/cavematerialcheck.mjs', '--out', 'frames/cave_322_materials_final']),
    ('palette', [py, 'tools/cavepalette.py', '--frames', 'frames/cave_333_delivery', '--out', 'frames/cave_recapture/metrics.json']),
    ('palette_r1', [py, 'tools/cavepalette.py', '--frames', 'frames/cave_333_delivery', '--roi', '0,260,1590,1080', '--out', 'frames/cave_recapture/metrics_r1_roi.json']),
    ('regions', [py, 'tools/cavepalette.py', '--frames', 'frames/cave_333_delivery', '--regions', 'study/CAVE_PALETTE_REGIONS.json', '--out', 'frames/cave_recapture/regions.json']),
    ('crab', ['node', 'tools/crabcheck.mjs']),
    ('serpent', ['node', 'tools/serpentcheck.mjs']),
    ('serpent_warnings', ['node', 'tools/serpentwarncheck.mjs']),
    ('serpent_motion', ['node', 'tools/serpentmotion.mjs']),
    ('serpent_metrics', [py, 'tools/serpentmotion.py']),
    ('repeat', ['node', 'tools/caverepeatcheck.mjs', '--out', 'frames/cave_333_repeat_probe']),
    ('loot', ['node', 'tools/lootvis.mjs', '--mode', 'cave', '--out', 'frames/cave_333_loot']),
    ('water', ['node', 'tools/watercheck.mjs', '--out', 'frames/cave_333_water']),
    ('sheets', [py, 'tools/cavereviewsheets.py']),
]
report_path = out / 'runs.json'
report = json.loads(report_path.read_text()) if args.resume and report_path.exists() else {}
for name, command in steps:
    if args.resume and name in report and report[name]['exit_code'] == 0:
        continue
    print(f'START {name}', flush=True)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (out / (name + '.log')).open('w') as log:
        try:
            result = subprocess.run(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=1200)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
    report[name] = {'command': command, 'started': started, 'exit_code': code}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'END {name}: {code}', flush=True)
print('Capture complete; inspect frames/cave_recapture/runs.json before packaging.', flush=True)
