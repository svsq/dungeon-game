#!/usr/bin/env bash
# Steam Deck: the game full screen in Chrome (Flatpak), with the pad (R-08, TASKS 251–252).
# Add this file to Steam («Добавить стороннюю игру») and start it from the library, in Game Mode or from the desktop Steam client:
# Steam then gives Chrome the Deck's controls as a gamepad (layout «Геймпад»), as it does for cloud gaming in Chrome.
# The port is fixed: the saves live in the browser under http://127.0.0.1:8930, another port would be another, empty save.
# A separate Chrome profile keeps them apart from the everyday browser. DECK_ANGLE=gl falls back to the OpenGL backend.
cd "$(dirname "$0")" || exit 1
P=8930
URL="http://127.0.0.1:$P/live/index.html"
PROFILE="${XDG_DATA_HOME:-$HOME/.local/share}/elder-deep-chrome"
if ! (exec 3<>"/dev/tcp/127.0.0.1/$P") 2>/dev/null; then
  python3 -m http.server "$P" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for _ in $(seq 50); do (exec 3<>"/dev/tcp/127.0.0.1/$P") 2>/dev/null && break; sleep 0.1; done
fi
ANGLE="${DECK_ANGLE:-vulkan}"
FLAGS=(--user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --start-fullscreen --kiosk --app="$URL"
  --ozone-platform=x11 --ignore-gpu-blocklist --autoplay-policy=no-user-gesture-required)
[ "$ANGLE" = vulkan ] && FLAGS+=(--use-angle=vulkan --enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE)
if flatpak info com.google.Chrome >/dev/null 2>&1; then flatpak run com.google.Chrome "${FLAGS[@]}"
elif command -v google-chrome >/dev/null 2>&1; then google-chrome "${FLAGS[@]}"
else echo "Нужен Google Chrome: Discover → Google Chrome (Flatpak). Или откройте вручную: $URL"; read -r; fi
