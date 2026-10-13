#!/usr/bin/env bash
# Self-contained so the game runs without the ref2game skill installed; WebGL can't load file:// images.
cd "$(dirname "$0")"
P="${1:-8930}"
while lsof -iTCP:"$P" -sTCP:LISTEN >/dev/null 2>&1; do P=$((P+1)); done
URL="http://127.0.0.1:$P/live/index.html"
echo "LIVE: $URL"
(sleep 1; command -v open >/dev/null && open "$URL") &
exec python3 -m http.server "$P" --bind 127.0.0.1
