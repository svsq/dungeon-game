#!/usr/bin/env bash
# Test release: pack live/ and wrap it in Electron. Installers land in desktop/release/.
#   desktop/release.sh                  # macOS dmg from the working tree
#   desktop/release.sh --head win mac   # from the last commit (uncommitted work left out); targets: mac win linux all
#   desktop/release.sh run              # no installer, just launch the packed game in Electron
#   --no-check                          # skip tune.cjs (it refuses to pack a sim whose selfCheck fails)
set -euo pipefail
DESK="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DESK")"
SKILL="${REF2GAME:-$HOME/.claude/skills/ref2game}"

head=0; check=1; targets=()
for a in "$@"; do
  case "$a" in
    --head) head=1 ;;
    --no-check) check=0 ;;
    all) targets+=(mac win linux) ;;
    mac|win|linux|run) targets+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 64 ;;
  esac
done
[ ${#targets[@]} -gt 0 ] || targets=(mac)

rev="$(git -C "$ROOT" rev-parse --short HEAD)"
src="$ROOT"
rm -rf "${DESK:?}/.pack"; mkdir -p "$DESK/.pack"
if [ $head = 1 ]; then
  src="$DESK/.pack/src"; mkdir -p "$src"
  git -C "$ROOT" archive HEAD live CHANGELOG.md tools/changelog.cjs tools/textcheck.cjs tools/layercheck.cjs tools/jsscan.cjs | tar -x -C "$src"
elif ! git -C "$ROOT" diff --quiet HEAD -- live || [ -n "$(git -C "$ROOT" ls-files --others --exclude-standard live)" ]; then
  rev="$rev-dirty"
fi

cd "$src"
if [ $check = 1 ]; then
  echo "== sim check"
  node live/tune.cjs >/dev/null 2>&1 || { node live/tune.cjs 2>&1 | grep -E "FAIL|Error" >&2; echo "tune.cjs failed: fix it, use --head, or pass --no-check" >&2; exit 1; }
fi

ver="$(node -e "require('./live/data.js'); console.log(DATA.VERSION)")"
node tools/changelog.cjs --check >/dev/null || { echo "CHANGELOG.md is out of step with the game: node tools/changelog.cjs --check" >&2; exit 1; }
echo "== pack $ver ($rev)"
python3 "$SKILL/scripts/pack.py" --name crypt --out "$DESK/.pack/out" | tail -1
rm -rf "${DESK:?}/game"
cp -R "$DESK/.pack/out/crypt/game" "$DESK/game"
rm -rf "${DESK:?}/.pack"

cd "$DESK"
[ -d node_modules ] || npm install

if [ "${targets[0]}" = run ]; then exec npx electron .; fi

export CRYPT_REV="$ver-$rev"
flags=()
for t in "${targets[@]}"; do flags+=("--$t"); done
echo "== build ${targets[*]}"
npx electron-builder "${flags[@]}" -c.extraMetadata.version="$ver" --publish never
echo "== done"
ls -lh release/ | grep "TheElderDeep-$CRYPT_REV" || true
