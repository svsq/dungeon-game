#!/usr/bin/env bash
# Steam Deck: the game full screen in Chrome (Flatpak), with the pad (R-08, TASKS 251–252).
# Add this file to Steam («Добавить стороннюю игру») and start it from the library, in Game Mode or from the desktop Steam client:
# Steam then gives Chrome the Deck's controls as a gamepad (layout «Геймпад»), as it does for cloud gaming in Chrome.
# The port is fixed: the saves live in the browser under http://127.0.0.1:8930, another port would be another, empty save.
# A separate Chrome profile keeps them apart from the everyday browser. DECK_ANGLE=gl falls back to the OpenGL backend.
cd "$(dirname "$0")" || exit 1
P=8930
URL="http://127.0.0.1:$P/live/index.html"
# the Flatpak Chrome always writes into its own ~/.var/app folder; another place depends on the package's file permissions
if flatpak info com.google.Chrome >/dev/null 2>&1; then PROFILE="$HOME/.var/app/com.google.Chrome/data/elder-deep-chrome"
else PROFILE="${XDG_DATA_HOME:-$HOME/.local/share}/elder-deep-chrome"; fi
# a port already open must be this game (review of PR 62: another server there opened something else in the kiosk)
is_game() { python3 -c "import sys,urllib.request; sys.exit(0 if b'MODULES' in urllib.request.urlopen('$URL', timeout=2).read() else 1)" 2>/dev/null; }
if (exec 3<>"/dev/tcp/127.0.0.1/$P") 2>/dev/null; then
  is_game || { echo "Порт $P занят другим сервером: закройте его и запустите deck.sh снова."; read -r; exit 1; }
else
  python3 -m http.server "$P" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for _ in $(seq 50); do (exec 3<>"/dev/tcp/127.0.0.1/$P") 2>/dev/null && break; sleep 0.1; done
  # (third review of PR 62) a server that did not come up would leave the kiosk on an error page with no way out in Game Mode
  is_game || { echo "Сервер игры не запустился на порту $P (нужен python3). Откройте вручную: $URL"; read -r; exit 1; }
fi
ANGLE="${DECK_ANGLE:-vulkan}"
FLAGS=(--user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --start-fullscreen --kiosk --app="$URL"
  --ozone-platform=x11 --ignore-gpu-blocklist --autoplay-policy=no-user-gesture-required)
[ "$ANGLE" = vulkan ] && FLAGS+=(--use-angle=vulkan --enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE)
if flatpak info com.google.Chrome >/dev/null 2>&1; then flatpak run com.google.Chrome "${FLAGS[@]}"
elif command -v google-chrome >/dev/null 2>&1; then google-chrome "${FLAGS[@]}"
else echo "Нужен Google Chrome: Discover → Google Chrome (Flatpak). Или откройте вручную: $URL"; read -r; fi
# a Chrome already open on this profile takes the page and the launch returns at once (re-review of PR 62): the server lives on
# until no Chrome on the profile is left, or the page would lose it
while pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; do sleep 2; done
