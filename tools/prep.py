import fnmatch
import json
import os
from pathlib import Path
import runpy


ROOT = Path.cwd()
# the project's copy of the skill; another agent's copy diverged once and its tools reported defects the game did not have (TASKS 236)
SKILL = Path(os.environ.get('REF2GAME_SKILL', Path.home() / '.claude/skills/ref2game')) / 'scripts/prep.py'

runpy.run_path(str(SKILL), run_name='__main__')
cfg = json.loads((ROOT / 'ref2game.json').read_text())['prep']
for path in sorted((ROOT / cfg['dst']).glob('*.png')):
    if any(fnmatch.fnmatch(path.stem, pattern) for pattern in cfg['skip']):
        path.unlink()
        print('excluded', path.name)
