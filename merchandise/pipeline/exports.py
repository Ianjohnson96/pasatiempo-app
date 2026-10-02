"""The POS's "data only" Excel and CSV exports: a report's rows with no title, headings or totals.

Without a title the report is told by its columns, and without headings the SKU Analysis's months
and the sales reports' period are worked out:

  SKU Analysis      category no, category, SKU, description, last received, last sale, cost, on hand,
                    units sold (12 months), the 12 months newest first, then the vendor and type codes.
                    The newest month is the month of the latest sale.
  Sales by Category sales area no, area, category no, category, SKU, description, average price, units, sales
  Sales by Item     sales area no, area, SKU, description, average price, units, sales
  Rounds            the Yearly Rounds Summary by golfer classification. It keeps its headings (Group Code,
                    Golfer Class'n Code, January Weekdays ... December Total) but has no year and no total
                    rows: the groups are added up here, and the year comes from the file name or the SKU Analysis
  BEST 100          category no, category, rank, SKU, description, quantity sold, sales, cost,
                    margin (a fraction: 0.496), markdown; at most 100 SKUs per category

The sales reports list each sales area, then the same rows again under "All Sales Areas" (no area
number); the second pass is left out. Their period is the run of months, ending at the SKU
Analysis's newest month, whose unit sales add up to the report's units.

Checked against the September 30, 2026 exports (Sku analysis, By Catagory, By Item, Top 100 Hottest items, Rounds of golf).
"""
from datetime import date, datetime
import re

from extract import _cell


def _t(v):
    return '' if v is None else ' '.join(str(v).split())


def _num(v):
    """A number cell, or None. CSV cells are text: 1,234.56, $12.00, (5.00) and -5 all read."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = _t(v).replace(',', '').replace('$', '')
    if not s:
        return None
    neg = s.startswith('(') and s.endswith(')')
    try:
        x = float(s.strip('()'))
    except ValueError:
        return None
    return -x if neg else x


def _date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = _t(v)
    for f in ('%m-%d-%y', '%m/%d/%y', '%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(s, f).date()
        except ValueError:
            pass
    return None


def _values(rows):
    """[(value, format)] rows -> value rows without trailing empty cells; empty rows dropped."""
    out = []
    for r in rows:
        v = [x for x, _ in r]
        while v and _t(v[-1]) == '':
            v.pop()
        if v:
            out.append(v)
    return out


def _nums(r, cols):
    return all(_num(r[i]) is not None for i in cols)


def _is_sku_row(r):
    return (len(r) >= 21 and _t(r[0]).isdigit() and _t(r[2]) != '' and _t(r[3]) != ''
            and all(_t(r[i]) == '' or _date(r[i]) for i in (4, 5))
            and (_t(r[6]) == '' or _num(r[6]) is not None) and _nums(r, range(7, 21)))


def _is_cat_row(r):
    return len(r) == 9 and _t(r[2]) != '' and _num(r[3]) is None and _t(r[4]) != '' and _num(r[5]) is None and _nums(r, (6, 7, 8))


def _is_item_row(r):
    return len(r) == 7 and _t(r[1]) != '' and _t(r[2]) != '' and _num(r[3]) is None and _nums(r, (4, 5, 6))


def _is_best_row(r):
    return (len(r) == 10 and _t(r[0]).isdigit() and _t(r[2]).isdigit() and _t(r[3]) != '' and _num(r[4]) is None
            and _nums(r, range(5, 10)))


TESTS = (('sku_analysis', _is_sku_row), ('best100', _is_best_row), ('sales_by_category', _is_cat_row), ('sales_by_item', _is_item_row))


MONTHS_FULL = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December')


def _rounds_cols(head):
    """Column of each month's total in the rounds export's heading row, or None."""
    h = [_t(x).lower() for x in head]
    if not any('golfer class' in x for x in h):
        return None
    cols = [h.index(f'{m.lower()} total') if f'{m.lower()} total' in h else None for m in MONTHS_FULL]
    return cols if None not in cols else None


def detect(rows):
    """The report an export without a title holds, or None. rows: extract.sheet_rows."""
    v = _values(rows)[:300]
    if v and _rounds_cols(v[0]):
        return 'rounds'
    if len(v) < 5:
        return None
    for k, test in TESTS:
        if sum(1 for r in v if test(r)) >= len(v) * 0.9:
            return k
    return None


def _ym_back(ym, n):
    y, m = int(ym[:4]), int(ym[5:])
    i = y * 12 + m - 1 - n
    return f'{i // 12}-{i % 12 + 1:02d}'


def parse_sku_analysis(rows):
    """Same shape as parse.parse_sku_analysis, plus the latest sale date ('day')."""
    v = [r for r in _values(rows) if _is_sku_row(r)]
    sales = [d for d in (_date(r[5]) for r in v) if d] or [d for d in (_date(r[4]) for r in v) if d]
    if not sales:
        return dict(as_of=None, months=[], rows=[])
    day = max(sales)
    as_of = f'{day.year}-{day.month:02d}'
    months = [_ym_back(as_of, i) for i in range(12)]
    out, agree, sold_any = [], 0, 0
    for r in v:
        sku = _t(r[2])
        if not re.match(r'^[A-Za-z0-9]+$', sku):  # ZDEL-… lines for deleted SKUs
            continue
        lr, ls = _date(r[4]), _date(r[5])
        mo = [int(_num(x)) for x in r[9:21]]
        sold = int(_num(r[8]))
        if sold:
            sold_any += 1
            agree += sold == sum(mo)
        out.append(dict(cat_no=str(int(_t(r[0]))), cat=_t(r[1]), sku=sku, desc=_t(r[3]),
                        last_rec=_cell(lr) if lr else None, last_sale=_cell(ls) if ls else None,
                        cost=_num(r[6]) or 0.0, oh=int(_num(r[7])), sold=sold, mo=dict(zip(months, mo))))
    # the 12 months must add up to the units sold, or the columns aren't the ones this reads
    if sold_any and agree < sold_any * 0.9:
        return dict(as_of=None, months=[], rows=[])
    return dict(as_of=as_of, months=months, rows=out, day=day.isoformat())


def _sales_rows(v):
    """Leave out the second pass ("All Sales Areas", no area number) when the areas are listed."""
    if any(_t(r[0]) for r in v):
        v = [r for r in v if _t(r[0])]
    return v


def parse_sales_by_category(rows):
    """Same shape as parse.parse_sales_by_category; the period is worked out later (infer_period)."""
    cats = {}
    for r in _sales_rows([r for r in _values(rows) if _is_cat_row(r)]):
        code = _t(r[2]).lstrip('0') or '0'
        c = cats.setdefault(code, dict(name=_t(r[3]), items=[]))
        c['items'].append(dict(sku=_t(r[4]), desc=_t(r[5]), avg=_num(r[6]), units=_num(r[7]), value=_num(r[8])))
    return dict(period=None, cats=cats)


def parse_sales_by_item(rows):
    """Same shape as parse.parse_sales_by_item. A SKU sold in two sales areas is added up."""
    out = {}
    for r in _sales_rows([r for r in _values(rows) if _is_item_row(r)]):
        s = out.setdefault(_t(r[2]), dict(desc=_t(r[3]), units=0.0, value=0.0))
        s['units'] += _num(r[5])
        s['value'] += _num(r[6])
    return out


def parse_best100(rows):
    """Same shape as parse.parse_best100; the period is worked out later (infer_period). 'cut' lists the
    categories that stop at 100 SKUs while still selling, so some of their sales are missing."""
    out, per_cat = [], {}
    for r in _values(rows):
        if not _is_best_row(r):
            continue
        g, c = _num(r[6]), _num(r[7])
        out.append(dict(cat_no=str(int(_t(r[0]))), cat=_t(r[1]), sku=_t(r[3]), desc=_t(r[4]), qty=int(_num(r[5])),
                        gross=int(round(g)), cost=int(round(c)), margin_pct=round((1 - c / g) * 100, 1) if g else 0.0,
                        markdown=int(round(_num(r[9])))))
        per_cat.setdefault(out[-1]['cat_no'], []).append(out[-1]['qty'])
    cut = sorted(k for k, q in per_cat.items() if len(q) >= 100 and q[-1] > 1)
    return dict(period=None, rows=out, cut=cut)


# the group totals the program keeps (model.build), by the group's description in the export
ROUND_GROUPS = {'Member Rounds': 'Member Rounds Total', 'Guest Rounds': 'Guest Rounds Total', 'Public Rounds': 'Public Rounds Total'}


def parse_rounds(rows, name=''):
    """Same shape as parse.parse_rounds, {year, rows: {label: [Jan..Dec, Total]}}, with the labels the
    program keeps. Report Totals adds up every classification, as the printed report does. year: a 20xx
    in the file name, else None (read_reports takes the SKU Analysis's)."""
    v = _values(rows)
    cols = _rounds_cols(v[0]) if v else None
    if not cols:
        return dict(year=None, rows={})
    out = {}
    for r in v[1:]:
        r = r + [None] * (max(cols) + 1 - len(r))
        if not all(_t(r[i]) == '' or _num(r[i]) is not None for i in cols):
            continue
        mo = [int(_num(r[i]) or 0) for i in cols]
        for label in ('Report Totals', ROUND_GROUPS.get(_t(r[1]))):
            if label:
                out[label] = [a + b for a, b in zip(out.get(label, [0] * 12), mo)]
    y = re.search(r'(?<!\d)(20\d\d)(?!\d)', name)
    return dict(year=int(y.group(1)) if y else None, rows={k: m + [sum(m)] for k, m in out.items()})


PARSE = {'sku_analysis': parse_sku_analysis, 'sales_by_category': parse_sales_by_category, 'sales_by_item': parse_sales_by_item, 'best100': parse_best100, 'rounds': parse_rounds}


def units_of(kind, d):
    if kind == 'sales_by_item':
        return {s: v['units'] for s, v in d.items()}
    if kind == 'best100':
        return {r['sku']: r['qty'] for r in d['rows']}
    u = {}
    for c in d['cats'].values():
        for i in c['items']:
            u[i['sku']] = u.get(i['sku'], 0) + i['units']
    return u


def infer_period(units, sku):
    """The months a sales report covers: the k newest months of the SKU Analysis whose unit sales add up
    to the report's, SKU by SKU (k = 1..12). Returns (first month, last month) as YYYY-MM, or None."""
    snap = {r['sku']: r for r in sku['rows']}
    both = [s for s, u in units.items() if u and s in snap and snap[s]['sold']]
    if len(both) < 10:
        return None
    best, hits = None, 0
    for k in range(1, 13):
        ms = sku['months'][:k]
        n = sum(1 for s in both if abs(units[s] - sum(snap[s]['mo'].get(m, 0) for m in ms)) <= 0.5)
        if n > hits:
            best, hits = k, n
    if not best or hits < len(both) * 0.6:
        return None
    return sku['months'][best - 1], sku['months'][0]


MONS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')


def period_text(first, last):
    """('2026-05', '2026-09') -> ('May 1/26', 'Sep 30/26'), the way the printed reports give a period."""
    from calendar import monthrange
    y, m = int(last[:4]), int(last[5:])
    return f'{MONS[int(first[5:]) - 1]} 1/{first[2:4]}', f'{MONS[m - 1]} {monthrange(y, m)[1]}/{last[2:4]}'


def period_label(first, last):
    """('2026-05', '2026-09') -> 'May 1 – Sep 30, 2026'."""
    a, b = period_text(first, last)
    return f"{a.split('/')[0]}{', 20' + a[-2:] if first[:4] != last[:4] else ''} – {b.split('/')[0]}, 20{b[-2:]}"
