"""Month-end refresh: PDFs in, database documents out.

  python refresh.py REPORT_DIR OUT_DIR [--prior PRIOR_DIR]

REPORT_DIR  the POS report PDFs (any file names; the report type is detected from the text)
PRIOR_DIR   last month's documents (base.json, skuhist_*.json) read back from the app database
OUT_DIR     one JSON file per document to write back
"""
import argparse
from datetime import datetime, timezone
import glob
import json
import os

import engine
import model
import parse
from config import OTB_EXCLUDE, REPLENISH
from extract import detect_kind, pdf_text

LISTS = ('sku_analysis', 'rounds', 'sales_by_item', 'sales_by_category', 'best100')


def load_reports(folder):
    reports = {}
    for p in sorted(glob.glob(os.path.join(folder, '*.pdf'))):
        t = pdf_text(p)
        k = detect_kind(t)
        if not k:
            print('  skipped (not recognised):', os.path.basename(p))
            continue
        d = getattr(parse, 'parse_' + k)(t)
        print(f'  {k:<18} {os.path.basename(p)}')
        if k in LISTS:
            reports.setdefault(k, []).append(d)
        else:
            reports[k] = d
    return reports


def load_prior(folder):
    if not folder:
        return None
    pr = {'skuhist': {}}
    for p in glob.glob(os.path.join(folder, '*.json')):
        n = os.path.basename(p)[:-5]
        d = json.load(open(p))
        if n == 'base':
            pr['base'] = d
        elif n.startswith('skuhist_'):
            pr['skuhist'][n[8:]] = d
        elif n == 'assumptions':
            pr['assumptions'] = {k: d[k] for k in ('g27', 'g27cat', 'g28', 'wos') if k in d}
    return pr


def category_calls(base, a=None):
    r = engine.run(base, a)
    calls = {}
    for c, v in base['cats'].items():
        if c in OTB_EXCLUDE:
            calls[c] = 'excluded'
            continue
        otb = engine.totals(r, [c], r['m27'])
        cogs = sum(x['cogs'] for x in r['cats'][c] if x['m'] in r['m27'])
        calls[c] = 'stop' if otb < 0 else 'replenish' if c in REPLENISH or otb < cogs * 0.1 else 'buy'
    # an overbought category carries its excess into next year (orders beyond budget are added in the app)
    carry = {c: max(-engine.totals(r, [c], r['m27']), 0) for c in base['cats'] if c not in OTB_EXCLUDE}
    return calls, engine.run(base, a, carry)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('reports')
    ap.add_argument('out')
    ap.add_argument('--prior')
    ap.add_argument('--note', action='append', help='a line for the refresh history (repeatable)')
    a = ap.parse_args()
    reports = load_reports(a.reports)
    prior = load_prior(a.prior)
    built = model.build(reports, prior)
    base = built['base']
    assume = (prior or {}).get('assumptions')
    calls, r = category_calls(base, assume)
    for c, k in calls.items():
        base['cats'][c]['call'] = k
    insights = model.build_insights(built['ctx'], calls)
    brands = model.build_brands(built['ctx'])
    os.makedirs(a.out, exist_ok=True)
    docs = {'base': base, 'inventory': built['inventory'], 'insights': insights, 'brands': brands}
    docs.update({f'skuhist_{k}': v for k, v in built['skuhist'].items()})
    ex = [c for c in base['cats'] if c not in OTB_EXCLUDE]
    open_months = [k for k in r['m27'] + r['m28'] if k > base['actualThrough']]
    docs['refresh'] = dict(asOf=base['asOf'], actualThrough=base['actualThrough'], at=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                           ytd=base['ytdActual'], ytdReport=base['ytdReport'],
                           onHand=round(sum(v['onHand'] for v in base['cats'].values())),
                           otbCur=round(engine.totals(r, ex, r['m27'])), otbNext=round(engine.totals(r, ex, r['m28'])),
                           forecast={k: round(sum(r['sales'][c][k] for c in base['cats'])) for k in open_months},
                           notes=a.note or [])
    for n, d in docs.items():
        json.dump(d, open(os.path.join(a.out, n + '.json'), 'w'), separators=(',', ':'))
        print(f'  wrote {n:<16} {len(json.dumps(d, separators=(",", ":"))) / 1024:6.1f} KB')
    print(f"\nAs of {base['asOf']}  actuals through {base['actualThrough']}  partial {base['partial']}")
    print(f"FY{base['fy'][2:]} open-to-buy remaining (ex Special Orders): ${engine.totals(r, ex, r['m27']):,.0f}")
    print(f"FY{int(base['fy'][2:]) + 1} open-to-buy (ex Special Orders):          ${engine.totals(r, ex, r['m28']):,.0f}")


if __name__ == '__main__':
    main()
