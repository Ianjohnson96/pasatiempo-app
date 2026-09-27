"""python -m pytest merchandise/pipeline  (or: python merchandise/pipeline/test_receipts.py)"""
from datetime import date

import receipts


def row(cat, desc, oh, cost, mo):
    return dict(cat_no=cat, desc=desc, oh=oh, cost=cost, mo=mo)


def ctx(snap, month, as_of, prices=None):
    return dict(snap=snap, sku_month=month, as_of=as_of, desc_of={}, px=lambda s: (prices or {}).get(s, 0))


def test_arrived_is_stock_change_plus_sales_since_the_last_snapshot():
    # Sep 11: 10 on hand, 4 sold so far in September. Sep 30: 30 on hand, 12 sold in September.
    prev = receipts.snapshot(ctx({'480100': row('480', 'Shirt Peter Millar', 10, 50.0, {'2026-09': 4})}, '2026-09', date(2026, 9, 11)))
    a = receipts.arrivals(prev, ctx({'480100': row('480', 'Shirt Peter Millar', 30, 50.0, {'2026-09': 12})}, '2026-09', date(2026, 9, 30)))
    assert (a['from'], a['to']) == ('2026-09-11', '2026-09-30')
    g = a['groups'][0]
    assert (g['cat'], g['brand'], g['units'], g['value']) == ('480', 'Peter Millar', 28, 1400.0)  # 30 - 10 + (12 - 4)


def test_spans_months_and_skus_new_since_the_snapshot():
    prev = receipts.snapshot(ctx({'480100': row('480', 'Shirt Peter Millar', 5, 50.0, {'2026-08': 6})}, '2026-08', date(2026, 8, 31)))
    cur = {'480100': row('480', 'Shirt Peter Millar', 2, 50.0, {'2026-08': 6, '2026-09': 3, '2026-10': 4}),
           '440200': row('440', 'Hat Melin', 20, 12.0, {'2026-10': 5})}
    a = receipts.arrivals(prev, ctx(cur, '2026-10', date(2026, 10, 31)))
    by = {g['brand']: g for g in a['groups']}
    assert by['Peter Millar']['units'] == 2 - 5 + 3 + 4
    assert by['Melin']['units'] == 25 and by['Melin']['value'] == 300.0


def test_stock_that_fell_beyond_sales_is_reported_not_netted():
    prev = receipts.snapshot(ctx({'480100': row('480', 'Shirt Peter Millar', 10, 50.0, {'2026-09': 0})}, '2026-09', date(2026, 9, 1)))
    a = receipts.arrivals(prev, ctx({'480100': row('480', 'Shirt Peter Millar', 7, 50.0, {'2026-09': 1})}, '2026-09', date(2026, 9, 30)))
    assert a['groups'] == [] and a['down'] == dict(value=100.0, units=2, skus=1)


def test_unit_cost_is_capped_at_the_selling_price():
    prev = receipts.snapshot(ctx({}, '2026-09', date(2026, 9, 1)))
    cur = {'640001': row('200', 'Yardage/Towel UCSC (Pera)', 0, 2870.80, {'2026-09': 124})}
    a = receipts.arrivals(prev, ctx(cur, '2026-09', date(2026, 9, 30), {'640001': 22.0}))
    assert a['groups'][0]['value'] == 124 * 22.0


def test_nothing_to_compare_with():
    cur = ctx({'480100': row('480', 'Shirt Peter Millar', 3, 50.0, {'2026-09': 1})}, '2026-09', date(2026, 9, 30))
    assert receipts.arrivals(None, cur) is None
    same = receipts.snapshot(cur)
    assert receipts.arrivals(same, cur) is None  # same date: nothing arrived in between


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
