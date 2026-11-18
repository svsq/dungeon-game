#!/usr/bin/env python3
# the game's static server for start.command, start.sh and deck.sh (TASKS 2179): `python3 -m http.server` listens with a backlog
# of 5 and closes every connection after one answer, so the page's burst of scripts and textures got some connections reset
# ("Failed to fetch", a script's onerror), a different file on every start. Stdlib only, Python 3.8+ (macOS's own python3).
#   python3 tools/serve.py [port] [--bind 127.0.0.1] [--dir .]
import argparse
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

TYPES = {'.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.png': 'image/png',
         '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
         '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'}


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **TYPES)

    def end_headers(self):
        # the page itself is asked anew on every start; the scripts and textures carry their own ?v= stamp
        if self.path.split('?')[0].endswith(('.html', '/')):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            super().handle_error(request, client_address)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('port', nargs='?', type=int, default=8930)
    a.add_argument('--bind', default='127.0.0.1')
    a.add_argument('--dir', default=os.getcwd())
    o = a.parse_args()
    with Server((o.bind, o.port), partial(Handler, directory=o.dir)) as s:
        try:
            s.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
