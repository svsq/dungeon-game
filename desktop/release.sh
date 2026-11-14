#!/usr/bin/env bash
# Test release: pack live/ and wrap it in Electron. Installers land in desktop/release/.
#   desktop/release.sh                  # macOS dmg from the working tree
#   desktop/release.sh --head win mac   # from the last commit (uncommitted work left out); targets: mac win linux all
#   desktop/release.sh run              # no installer, just launch the packed game in Electron
#   desktop/release.sh win7             # Windows 7 x64 installer on Electron 22.3 (TASKS 2005: the last one that runs there), with any other targets
#   --no-check                          # skip tune.cjs (it refuses to pack a sim whose selfCheck fails)
#   --publish                           # with --head: upload the built files and their update feeds to the GitHub release v<version>
#                                       # (created from the CHANGELOG entry if it is not there yet; the tag must be pushed first)
#                                       # needs every feed built: mac win win7 linux ("all" does not include win7)
#   --partial                           # with --publish: allow a target set that lacks some of them; the installed builds on the missing
#                                       # feeds then fail to update (ERR_UPDATER_CHANNEL_FILE_NOT_FOUND), so the warning names them
# Updates from the game's menu (TASKS 1870): Windows builds an nsis installer, macOS a zip next to the dmg, each with latest*.yml;
# the Windows 7 build has its own feed, win7.yml, so it is never offered the installer that does not start there
set -euo pipefail
DESK="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DESK")"
SKILL="${REF2GAME:-$HOME/.claude/skills/ref2game}"

head=0; check=1; publish=0; partial=0; targets=()
for a in "$@"; do
  case "$a" in
    --head) head=1 ;;
    --no-check) check=0 ;;
    --publish) publish=1 ;;
    --partial) partial=1 ;;
    all) targets+=(mac win linux) ;;
    mac|win|linux|run|win7) targets+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 64 ;;
  esac
done
[ ${#targets[@]} -gt 0 ] || targets=(mac)
[ $publish = 0 ] || [ $head = 1 ] || { echo "--publish needs --head: a release is built from a commit, not from the working tree" >&2; exit 64; }
# every installed build reads its own feed from the release (TASKS 1870): one missing makes its updater fail on that release
if [ $publish = 1 ]; then
  missing=()
  for need in mac win win7 linux; do
    have=0; for t in "${targets[@]}"; do [ "$t" = "$need" ] && have=1; done
    [ $have = 1 ] || missing+=("$need")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    feeds=(); for m in "${missing[@]}"; do case "$m" in
      mac) feeds+=("macOS builds (latest-mac.yml)") ;; win) feeds+=("Windows 10+ builds (latest.yml)") ;;
      win7) feeds+=("Windows 7 builds (win7.yml)") ;; linux) feeds+=("Linux builds (latest-linux.yml)") ;; esac; done
    if [ $partial = 0 ]; then
      echo "--publish needs every update feed in the release; missing targets: ${missing[*]}" >&2
      echo "add them (all does not include win7), or pass --partial to publish without them" >&2
      exit 64
    fi
    echo "!!! WARNING: --partial publish without: ${missing[*]}" >&2
    printf '!!! installed %s will fail to update (ERR_UPDATER_CHANNEL_FILE_NOT_FOUND) until a release with that feed is published\n' "${feeds[@]}" >&2
  fi
fi
# the installed games take an update only from the certificate that signed them (TASKS 1870): with no such one here the mac
# build stops instead of signing with another of the keychain's identities
MAC_ID="$(node -p "require('$DESK/package.json').build.mac.identity")"
for t in "${targets[@]}"; do if [ "$t" = mac ] && ! security find-identity -v -p codesigning | grep -qF "$MAC_ID"; then
  echo "no signing identity \"$MAC_ID\" in the keychain: the mac build would not update the installed ones" >&2; exit 1; fi; done

rev="$(git -C "$ROOT" rev-parse --short HEAD)"
src="$ROOT"
rm -rf "${DESK:?}/.pack"; mkdir -p "$DESK/.pack"
if [ $head = 1 ]; then
  src="$DESK/.pack/src"; mkdir -p "$src"
  git -C "$ROOT" archive HEAD live CHANGELOG.md tools/changelog.cjs tools/textcheck.cjs tools/layercheck.cjs tools/jsscan.cjs tools/scenebox.cjs | tar -x -C "$src"
elif ! git -C "$ROOT" diff --quiet HEAD -- live || [ -n "$(git -C "$ROOT" ls-files --others --exclude-standard live)" ]; then
  rev="$rev-dirty"
fi

cd "$src"
if [ $check = 1 ]; then
  echo "== sim check"
  node live/tune.cjs >/dev/null 2>&1 || { node live/tune.cjs 2>&1 | grep -E "FAIL|Error" >&2; echo "tune.cjs failed: fix it, use --head, or pass --no-check" >&2; exit 1; }
fi

ver="$(node -e "require('./live/data.js'); console.log(DATA.VERSION)")"
[ "$(node -p "require('$DESK/package.json').version")" = "$ver" ] || { echo "desktop/package.json is not at version $ver: node tools/changelog.cjs" >&2; exit 1; }
node tools/changelog.cjs --check >/dev/null || { echo "CHANGELOG.md is out of step with the game: node tools/changelog.cjs --check" >&2; exit 1; }
echo "== pack $ver ($rev)"
python3 "$SKILL/scripts/pack.py" --name crypt --out "$DESK/.pack/out" | tail -1
rm -rf "${DESK:?}/game"
cp -R "$DESK/.pack/out/crypt/game" "$DESK/game"
rm -rf "${DESK:?}/.pack"

cd "$DESK"
[ -d node_modules ] || npm install

if [ "${targets[0]}" = run ]; then exec npx electron .; fi

# file names carry the version only, so a release asset has the same name every time; a working-tree build is marked "-dirty"
export CRYPT_REV="$ver"; case "$rev" in *-dirty) CRYPT_REV="$ver-dirty" ;; esac
flags=(); win7=0
for t in "${targets[@]}"; do if [ "$t" = win7 ]; then win7=1; else flags+=("--$t"); fi; done
if [ ${#flags[@]} -gt 0 ]; then
  echo "== build ${flags[*]}"
  npx electron-builder "${flags[@]}" -c.extraMetadata.version="$ver" --publish never
fi
# Electron 23+ does not start on Windows 7/8/8.1; electron-builder fetches 22.3.27 itself, the main build keeps its own Electron
if [ $win7 = 1 ]; then
  echo "== build win7 (Electron 22.3.27)"
  npx electron-builder --win nsis --x64 -c.electronVersion=22.3.27 -c.extraMetadata.version="$ver" -c.publish.channel=win7 \
    -c.artifactName='TheElderDeep-${env.CRYPT_REV}-win7-${arch}.${ext}' --publish never
fi
echo "== done"
ls -lh release/ | grep -E "TheElderDeep-$CRYPT_REV-(mac|win|linux)" || true
# this build's files and the feeds that name them: a feed left from another build or version is not uploaded
files=(); for f in release/TheElderDeep-"$CRYPT_REV"-{mac,win,win7,linux}*; do [ -f "$f" ] && files+=("$f"); done
for f in release/latest*.yml release/win7.yml; do [ -f "$f" ] && grep -q "TheElderDeep-$CRYPT_REV-" "$f" && files+=("$f"); done
printf '  %s\n' "${files[@]}"
if [ $publish = 1 ]; then
  echo "== publish v$ver"
  if gh release view "v$ver" >/dev/null 2>&1; then gh release upload "v$ver" "${files[@]}" --clobber
  else
    notes="$DESK/.notes.md"
    git -C "$ROOT" show HEAD:CHANGELOG.md | node -e "const s=require('fs').readFileSync(0,'utf8'), m=s.split(/^## /m).find((e)=>e.startsWith('$ver '));
      if(!m)process.exit(1); process.stdout.write(m.split('\n').slice(1).join('\n').trim()+'\n')" > "$notes"
    gh release create "v$ver" "${files[@]}" --verify-tag --title "The Elder Deep $ver" --notes-file "$notes"; rm -f "$notes"
  fi
fi
