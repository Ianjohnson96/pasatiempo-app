"""Assemble the single-file Merchandise Program page.

  python build.py DATA_DIR [OUT]

DATA_DIR holds base.json, inventory.json, insights.json, brands.json (the refresh output) and optionally
plan.json (the legacy FY27 plan). They are embedded as the fallback shown when the database can't be reached.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def build(data_dir, out):
    fb = {}
    for k in ('base', 'inventory', 'insights', 'brands', 'plan'):
        p = os.path.join(data_dir, k + '.json')
        fb[k] = json.load(open(p)) if os.path.exists(p) else None
    js = '\n'.join(open(p).read() for p in sorted(glob.glob(os.path.join(HERE, 'src', '*.js'))))
    blob = json.dumps(fb, separators=(',', ':')).replace('</', '<\\/')
    assert js.count('__FALLBACK__') == 1
    html = open(os.path.join(HERE, 'src', 'shell.html')).read() + '\n<script>\n' + js.replace('__FALLBACK__', blob) + '\n</script>\n'
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    open(out, 'w').write(html)
    print(f'wrote {out} ({len(html) / 1024:.0f} KB)')


if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', 'dist', 'merchandise-program.html'))
