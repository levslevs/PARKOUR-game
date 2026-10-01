#!/usr/bin/env python3
"""Serve this exported game locally using only the Python standard library."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8000)
parser.add_argument('--host', default='127.0.0.1', help='Use 0.0.0.0 only to test from another device on your network.')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
with ThreadingHTTPServer((args.host, args.port), handler) as server:
    display_host = '127.0.0.1' if args.host == '0.0.0.0' else args.host
    print(f'Game: http://{display_host}:{args.port}/parkour-enemies.html', flush=True)
    print('Stop with Ctrl+C.', flush=True)
    if args.host == '0.0.0.0':
        print('For an iPad on the same Wi-Fi, replace 127.0.0.1 with this computer\'s local IP address.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
