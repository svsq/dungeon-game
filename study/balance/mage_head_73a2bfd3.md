# Mage balance at 73a2bfd3

Node.js v26.7.0; mage profile and class, town campaign, seeds 1–40, one run per seed. The command was run once per difficulty:

```sh
node tools/difficulty.cjs --profiles mage --cls mage --mode town --seeds 1-40 --runs 1 --no-cache --diff "$DIFF"
```

Win rates use all 40 runs; minimum HP is the mean of each run's minimum health fraction. Potion figures are per run. The tool rounds 37/40 to 93%; the table uses the exact 92.5%.

| Difficulty | Wins | Deaths by floor | Avg. min HP | HP / MP potions | Stuck |
| --- | ---: | --- | ---: | ---: | ---: |
| [Easy](mage_head_73a2bfd3_current_easy.txt) | 36/40 (90%) | 0 | 45% | 0.4 / 0.1 | 4 |
| [Normal](mage_head_73a2bfd3_current_normal.txt) | 36/40 (90%) | 0 | 36% | 1.1 / 0.2 | 4 |
| [Hard](mage_head_73a2bfd3_current_hard.txt) | 37/40 (92.5%) | 0 | 28% | 3.1 / 0.2 | 3 |

Differences are HEAD minus the rounded figures in [the 2269 report](mage_staff_2269.md); win rate and minimum HP are in percentage points.

| Baseline | Difficulty | Wins, pp | Deaths by floor | Min HP, pp | HP / MP potions | Stuck |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| After | Easy | -5 | 0 | 0 | +0.1 / -0.1 | +2 |
| After | Normal | -2.5 | floor 6: -1 | +1 | -0.7 / 0.0 | +2 |
| After | Hard | -2.5 | floor 4: -2 | +1 | -0.1 / -0.2 | +3 |
| Before | Easy | -5 | 0 | -2 | +0.1 / +0.1 | +2 |
| Before | Normal | -5 | 0 | -2 | -0.4 / +0.1 | +2 |
| Before | Hard | +5 | 0 | 0 | +0.4 / 0.0 | -2 |
