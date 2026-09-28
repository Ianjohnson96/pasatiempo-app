"""Month-end refresh: PDFs in, database documents out.

  python refresh.py REPORT_DIR OUT_DIR [--prior PRIOR_DIR]

REPORT_DIR  the POS reports as PDF, Excel or CSV (any file names; the type is detected from the text)
PRIOR_DIR   last month's documents (base.json, skuhist_*.json) read back from the app database
OUT_DIR     one JSON file per document to write back

The club app runs the same refresh when the owner uploads the reports on the Month-end page
(api/merch/refresh.py).
"""
import argparse
from datetime import datetime, timezone
import glob
import json
import os

import engine
import model
import parse
import receipts
from config import OTB_EXCLUDE, REPLENISH
from extract import SHEETS, detect_kind, report_text

LISTS = ('sku_analysis', 'rounds', 'sales_by_item', 'sales_by_category', 'best100')


# Is there anything in a parsed report? A report can be recognised by its title and still
# yield no rows (an export laid out differently from the printout); it's left out then.
HAS_ROWS = {
    'sku_analysis': lambda d: bool(d['rows']) and len(d['months']) == 12,
    'best100': lambda d: bool(d['rows']),
    'sales_by_category': lambda d: any(c['items'] for c in d['cats'].values()),
    'sales_by_item': lambda d: bool(d),
    'daily_sales': lambda d: bool(d['report']) and bool(d['date']),
    'rounds': lambda d: bool(d['rows']) and bool(d['year']),
}
NAMES = {'sku_analysis': 'SKU Analysis', 'best100': 'Cost & margin (BEST 100)', 'sales_by_category': 'Sales by Category',
         'sales_by_item': 'Sales by Item', 'daily_sales': 'Daily Sales Report', 'rounds': 'Rounds Summary'}


def read_reports(files):
    """files: [(name, path or bytes)]. Returns (reports, found).
    found: one dict per file: name, kind (None if not recognised), ok, and a note when it isn't used."""
    reports, found = {}, []
    for name, src in files:
        if not name.lower().endswith(('.pdf',) + SHEETS):
            found.append(dict(name=name, kind=None, ok=False, note='Not a PDF, Excel or CSV file.'))
            continue
        try:
            t = report_text(name, src)
        except Exception:  # damaged, or not really that type
            found.append(dict(name=name, kind=None, ok=False, note="Couldn't be opened."))
            continue
        k = detect_kind(t)
        if not k:
            found.append(dict(name=name, kind=None, ok=False, note="Not one of the month-end reports."))
            continue
        try:
            d = getattr(parse, 'parse_' + k)(t)
            ok = HAS_ROWS[k](d)
        except Exception:
            ok = False
        if not ok:
            found.append(dict(name=name, kind=k, ok=False, note=f"Looks like the {NAMES[k]}, but no rows could be read. Try the PDF."))
            continue
        if k not in LISTS and k in reports:
            found.append(dict(name=name, kind=k, ok=False, note=f'A second {NAMES[k]}; the first one is used.'))
            continue
        found.append(dict(name=name, kind=k, ok=True, note=None))
        if k in LISTS:
            reports.setdefault(k, []).append(d)
        else:
            reports[k] = d
    return reports, found


def load_reports(folder):
    files = [(os.path.basename(p), p) for p in sorted(glob.glob(os.path.join(folder, '*')))
             if p.lower().endswith(('.pdf',) + SHEETS)]
    reports, found = read_reports(files)
    for f in found:
        print(f"  {f['kind']:<18} {f['name']}" if f['ok'] else f"  skipped: {f['name']} ({f['note']})")
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
        elif n == 'skusnap':
            pr['skusnap'] = d
        elif n == 'brandmap':
            pr['brandmap'] = d
        elif n == 'assumptions':
            pr['assumptions'] = {k: d[k] for k in ('g27', 'g27cat', 'g28', 'wos') if k in d}
    return pr


def prior_from_docs(docs):
    """Prior documents as stored in merch.docs ({path: data}) -> the shape build() takes."""
    if not docs:
        return None
    pr = {'skuhist': {}}
    for path, d in docs.items():
        if path == 'base/current':
            pr['base'] = d
        elif path.startswith('skuhist/'):
            pr['skuhist'][path[8:]] = d
        elif path == 'plan/assumptions':
            pr['assumptions'] = {k: d[k] for k in ('g27', 'g27cat', 'g28', 'wos') if k in d}
        elif path == 'skusnap/current':
            pr['skusnap'] = d
        elif path == 'brandmap/current':
            pr['brandmap'] = d
    return pr


def warnings(reports, prior, summary):
    """Plain-English notes on what this refresh can't update, for the owner to see before loading it."""
    out = []
    if not reports.get('best100'):
        out.append('No cost & margin report (BEST 100): margins stay as they were.')
    if not reports.get('sales_by_item'):
        out.append('No Sales by Item report: selling prices stay as they were.')
    if not (prior or {}).get('skusnap'):
        out.append("Deliveries are matched to orders from the next upload on: this one saves the stock snapshot they're worked out from.")
    pb = (prior or {}).get('base') or {}
    if pb.get('fy') == summary.get('fy') and (pb.get('ytdActual') or 0) > 0 and summary['ytd'] < pb['ytdActual'] * 0.97:
        out.append(f"This year's sales to date come out lower than at the last upload (${pb['ytdActual']:,.0f} -> ${summary['ytd']:,.0f}). "
                   "Check the reports are the latest before updating.")
    if not reports.get('daily_sales') and not any(model.fytd_by_category([c], int(summary['fy'][2:]), summary['actualThrough']) for c in reports.get('sales_by_category', [])):
        out.append('No Daily Sales Report or Sales by Category (May 1 to date), so this year\'s sales are estimated from the SKU Analysis and prices.')
    if pb.get('fy') and summary.get('fy') and pb['fy'] < summary['fy']:
        out.append(f"{pb['fy']} has closed: its months become last year's sales from the last upload. "
                   f"Set {summary['fy']}'s monthly growth on the Forecast tab; until then the forecast repeats last year's months.")
    was = pb.get('asOf')
    day =lambda d: f'{datetime.fromisoformat(d):%b} {int(d[8:10])}, {d[:4]}'
    if was and summary['asOf'] < was:
        out.append(f"These reports are older than the program's data (as of {day(was)}). Updating would take it back to {day(summary['asOf'])}.")
    elif was and summary['asOf'] == was:
        out.append(f'The program already has data as of {day(was)}. Updating replaces it.')
    return out


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


def build_bundle(reports, prior=None, notes=None):
    """Run the month-end refresh. Returns (docs, bundle, summary): docs by file name, the data file the
    club app loads (More -> Load month-end data), and the headline numbers."""
    if not reports.get('sku_analysis'):
        raise ValueError('No SKU Analysis among the reports. It is needed for on-hand stock and unit sales.')
    notes = notes or []
    built = model.build(reports, prior)
    base = built['base']
    assume = (prior or {}).get('assumptions')
    calls, r = category_calls(base, assume)
    for c, k in calls.items():
        base['cats'][c]['call'] = k
    insights = model.build_insights(built['ctx'], calls)
    brands = model.build_brands(built['ctx'])
    docs = {'base': base, 'inventory': built['inventory'], 'insights': insights, 'brands': brands,
            'skusnap': receipts.snapshot(built['ctx']), 'brandskus': model.brand_skus(built['ctx'])}
    arrived = receipts.arrivals((prior or {}).get('skusnap'), built['ctx'])
    if arrived:
        docs['arrivals'] = arrived
    docs.update({f'skuhist_{k}': v for k, v in built['skuhist'].items()})
    ex = [c for c in base['cats'] if c not in OTB_EXCLUDE]
    open_months = [k for k in r['m27'] + r['m28'] if k > base['actualThrough']]
    docs['refresh'] = dict(asOf=base['asOf'], actualThrough=base['actualThrough'], at=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                           ytd=base['ytdActual'], ytdReport=base['ytdReport'],
                           onHand=round(sum(v['onHand'] for v in base['cats'].values())),
                           otbCur=round(engine.totals(r, ex, r['m27'])), otbNext=round(engine.totals(r, ex, r['m28'])),
                           forecast={k: round(sum(r['sales'][c][k] for c in base['cats'])) for k in open_months},
                           notes=notes)
    paths = {'base': 'base/current', 'inventory': 'inventory/current', 'insights': 'insights/current', 'brands': 'brands/current',
             'refresh': f"refreshes/{base['asOf']}", 'skusnap': 'skusnap/current', 'brandskus': 'brandskus/current',
             'arrivals': f"arrivals/{base['asOf']}"}
    paths.update({f'skuhist_{k}': f'skuhist/{k}' for k in built['skuhist']})
    bundle = dict(kind='pasatiempo-merch-bundle', version=1,
                  note=f"Month-end data as of {base['asOf']}" + (': ' + '; '.join(notes) if notes else ''),
                  docs={paths[n]: d for n, d in docs.items()})
    rf = docs['refresh']
    summary = dict(asOf=base['asOf'], fy=base['fy'], actualThrough=base['actualThrough'], partial=base['partial'],
                   ytd=rf['ytd'], onHand=rf['onHand'], otbCur=rf['otbCur'], otbNext=rf['otbNext'],
                   arrivals=dict(total=arrived['total'], **{'from': arrived['from']}) if arrived else None)
    return docs, bundle, summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('reports')
    ap.add_argument('out')
    ap.add_argument('--prior')
    ap.add_argument('--note', action='append', help='a line for the refresh history (repeatable)')
    a = ap.parse_args()
    reports = load_reports(a.reports)
    prior = load_prior(a.prior)
    docs, bundle, summary = build_bundle(reports, prior, a.note)
    os.makedirs(a.out, exist_ok=True)
    for n, d in docs.items():
        json.dump(d, open(os.path.join(a.out, n + '.json'), 'w'), separators=(',', ':'))
        print(f'  wrote {n:<16} {len(json.dumps(d, separators=(",", ":"))) / 1024:6.1f} KB')
    # One data file for the club app (More -> Load month-end data).
    bpath = os.path.join(a.out, f"Merchandise_Program_Data_{summary['asOf']}.json")
    json.dump(bundle, open(bpath, 'w'), separators=(',', ':'))
    print(f'  data file        {bpath}')
    fy = int(summary['fy'][2:])
    print(f"\nAs of {summary['asOf']}  actuals through {summary['actualThrough']}  partial {summary['partial']}")
    print(f"FY{fy} open-to-buy remaining (ex Special Orders): ${summary['otbCur']:,.0f}")
    print(f"FY{fy + 1} open-to-buy (ex Special Orders):          ${summary['otbNext']:,.0f}")


if __name__ == '__main__':
    main()
