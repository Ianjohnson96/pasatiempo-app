"""Month-end refresh for the Merchandise Program: POS reports in, a data file out.

Runs on Vercel's Python runtime (the report readers are Python: merchandise/pipeline). The
owner's page first asks the Next.js app for a pass and last month's documents
(POST /merch/api/refresh), then posts them here with the report files:

  {"ticket": "...", "prior": {path: data}, "note": "...", "files": [{"name": "...", "data": "<base64>"}]}

and gets back {"bundle": ..., "summary": ..., "files": [...]}. Nothing is saved here: the page
shows the result, and the owner's "Update the program" sends the bundle to /merch/api/import,
which checks the owner again and writes it.

The pass is signed with a key derived from SUPABASE_SERVICE_ROLE_KEY (lib/merch/ticket.ts), so
only a signed-in owner can run a refresh.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'merchandise', 'pipeline'))

import refresh  # noqa: E402

MAX_BODY = 4_400_000  # Vercel accepts request bodies up to 4.5 MB
MAX_FILES = 20


def _key():
    secret = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    return hashlib.sha256(('merch-refresh:' + secret).encode()).digest() if secret else None


def _b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()


def check_ticket(ticket, key=None, now=None):
    """The ticket's claims if it is genuine and unexpired, else None."""
    key = key or _key()
    if not key or not isinstance(ticket, str) or ticket.count('.') != 1:
        return None
    body, sig = ticket.split('.')
    if not hmac.compare_digest(_b64url(hmac.new(key, body.encode(), hashlib.sha256).digest()), sig):
        return None
    try:
        claims = json.loads(base64.urlsafe_b64decode(body + '=' * (-len(body) % 4)))
    except ValueError:
        return None
    if not isinstance(claims, dict) or not isinstance(claims.get('x'), (int, float)) or claims['x'] < (now or time.time()):
        return None
    return claims


def run(req):
    """(status, response body) for one request body (already parsed JSON)."""
    if not isinstance(req, dict):
        return 400, {'error': "That upload wasn't understood."}
    claims = check_ticket(req.get('ticket'))
    if not claims:
        return 401, {'error': 'Your upload pass has expired. Reload the page and try again.'}
    files = req.get('files')
    if not isinstance(files, list) or not files:
        return 400, {'error': 'Choose the report files first.'}
    if len(files) > MAX_FILES:
        return 400, {'error': f'Upload at most {MAX_FILES} files at a time.'}
    decoded = []
    for f in files:
        if not isinstance(f, dict) or not isinstance(f.get('name'), str) or not isinstance(f.get('data'), str):
            return 400, {'error': "That upload wasn't understood."}
        try:
            decoded.append((f['name'][:200], base64.b64decode(f['data'], validate=True)))
        except ValueError:
            return 400, {'error': f"{f['name'][:200]} didn't upload cleanly. Try again."}
    docs = req.get('prior') if isinstance(req.get('prior'), dict) else {}
    prior = refresh.prior_from_docs(docs)
    note = req.get('note')
    notes = [note.strip()[:200]] if isinstance(note, str) and note.strip() else []
    reports, found = refresh.read_reports(decoded)
    if not reports.get('sku_analysis'):
        return 422, {'error': 'No SKU Analysis among these files. It is needed for on-hand stock and unit sales.', 'files': found}
    try:
        _docs, bundle, summary = refresh.build_bundle(reports, prior, notes)
    except ValueError as e:
        return 422, {'error': str(e), 'files': found}
    was = docs.get('base/current') if isinstance(docs.get('base/current'), dict) else None
    summary['was'] = {'asOf': was.get('asOf'), 'actualThrough': was.get('actualThrough')} if was else None
    return 200, {'bundle': bundle, 'summary': summary, 'files': found, 'warnings': refresh.warnings(reports, prior, summary)}


class handler(BaseHTTPRequestHandler):
    def _send(self, status, obj):
        out = json.dumps(obj, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_POST(self):
        try:
            n = int(self.headers.get('content-length') or 0)
        except ValueError:
            n = 0
        if n <= 0:
            return self._send(400, {'error': 'Choose the report files first.'})
        if n > MAX_BODY:
            return self._send(413, {'error': 'Those files are too large to upload together (4 MB at most). Upload fewer at a time, or use Excel exports, which are smaller.'})
        try:
            req = json.loads(self.rfile.read(n))
        except ValueError:
            return self._send(400, {'error': "That upload wasn't understood."})
        try:
            status, body = run(req)
        except Exception:
            traceback.print_exc()
            status, body = 500, {'error': "The reports couldn't be read. Check they are this month's POS reports and try again."}
        self._send(status, body)

    def do_GET(self):
        self._send(405, {'error': 'Post the reports to this address.'})
