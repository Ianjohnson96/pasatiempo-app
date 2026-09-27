"""What arrived between two month-end refreshes, worked out from the SKU Analysis.

The shop receives into the POS without purchase orders, so nobody records deliveries in the
program. Instead each refresh keeps a stock snapshot (skusnap/current: on-hand, cost and the
month's unit sales by SKU), and the next refresh works out, for every SKU:

    arrived = on-hand now - on-hand then + units sold in between

valued at the current cost and grouped by category and brand. The program matches those
totals to open purchase orders and the owner confirms them (Month-end upload).

Counts, shrink and returns to vendors also move on-hand, so a SKU that went down by more
than it sold is reported separately rather than netted against deliveries.
"""
from collections import defaultdict

from brands import brand_of
from config import CATS

MERCH = set(CATS)
TOP = 5


def _months(first, last):
    """'YYYY-MM' months from first to last inclusive."""
    y, m = int(first[:4]), int(first[5:7])
    out = []
    while f'{y}-{m:02d}' <= last:
        out.append(f'{y}-{m:02d}')
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def snapshot(ctx):
    """This refresh's stock by SKU, for the next refresh to compare with. {sku: [on hand, cost, units sold this month]}"""
    month = ctx['sku_month']
    skus = {}
    for s, r in ctx['snap'].items():
        mtd = int(r['mo'].get(month, 0))
        if r['oh'] or mtd:
            skus[s] = [int(r['oh']), round(float(r['cost']), 2), mtd]
    return dict(asOf=ctx['as_of'].isoformat(), month=month, skus=skus)


def arrivals(prev, ctx):
    """Deliveries since the previous snapshot, by category and brand; None if there's nothing to compare with."""
    if not prev or 'skus' not in prev or not prev.get('month'):
        return None
    as_of = ctx['as_of'].isoformat()
    if prev['asOf'] >= as_of:
        return None
    months = _months(prev['month'], ctx['sku_month'])
    before = prev['skus']
    groups = defaultdict(lambda: dict(value=0.0, units=0, skus=0, top=[]))
    down = dict(value=0.0, units=0, skus=0)
    for s, r in ctx['snap'].items():
        if r['cat_no'] not in MERCH:
            continue
        oh0, _, mtd0 = before.get(s, [0, 0, 0])
        sold = sum(int(r['mo'].get(m, 0)) for m in months) - mtd0
        units = int(r['oh']) - int(oh0) + sold
        if units == 0:
            continue
        # Special orders sometimes carry the whole order's cost as the unit cost; a unit never costs
        # more than it sells for, so the average selling price caps it.
        cost, price = float(r['cost']), (ctx['px'](s) if ctx.get('px') else 0)
        value = units * (min(cost, price) if price > 0 else cost)
        if units < 0:
            down['value'] += -value
            down['units'] += -units
            down['skus'] += 1
            continue
        desc = ctx['desc_of'].get(s) or r['desc']
        g = groups[(r['cat_no'], brand_of(desc))]
        g['value'] += value
        g['units'] += units
        g['skus'] += 1
        g['top'].append(dict(sku=s, desc=desc, units=units, value=round(value, 2)))
    out = []
    for (cat, brand), g in groups.items():
        g['top'] = sorted(g['top'], key=lambda x: -x['value'])[:TOP]
        out.append(dict(cat=cat, brand=brand, value=round(g['value'], 2), units=g['units'], skus=g['skus'], top=g['top']))
    out.sort(key=lambda g: -g['value'])
    return dict(**{'from': prev['asOf'], 'to': as_of}, total=round(sum(g['value'] for g in out), 2), groups=out,
                down=dict(value=round(down['value'], 2), units=down['units'], skus=down['skus']))
