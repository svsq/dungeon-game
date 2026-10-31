#!/usr/bin/env bash
# Linux-вариант start.command: самодостаточный, чтобы игра работала без скилла ref2game.
# WebGL не загружает изображения по file://, нужен статический HTTP-сервер.
cd "$(dirname "$0")" || exit 1
P="${1:-8930}"
if command -v lsof >/dev/null 2>&1; then
  while lsof -iTCP:"$P" -sTCP:LISTEN >/dev/null 2>&1; do P=$((P+1)); done
else
  while (exec 3<>"/dev/tcp/127.0.0.1/$P") 2>/dev/null; do P=$((P+1)); done
fi
URL="http://127.0.0.1:$P/live/index.html"
echo "LIVE: $URL"
( sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v gio >/dev/null 2>&1; then gio open "$URL" >/dev/null 2>&1
  else echo "Откройте вручную: $URL"; fi ) &
exec python3 -m http.server "$P" --bind 127.0.0.1
