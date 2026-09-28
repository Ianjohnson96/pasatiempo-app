"""python merchandise/pipeline/test_model.py"""
from config import CATS
from model import brand_inputs, brand_skus, build, build_brands, fy_months, fytd_by_category, rebuild_ctx


def cat_report(start, end, sales):
    return dict(period=(start, end), cats={c: dict(name='', items=[dict(sku='x', desc='', avg=0, units=1, value=v)]) for c, v in sales.items()})


def test_may_to_date_category_report_is_used():
    r = cat_report('May 1/26', 'Sep 30/26', {'480': 1000.0, '620': 250.5})
    got = fytd_by_category([r], 2027, '2026-09')
    assert got['480'] == 1000.0 and got['620'] == 250.5 and got['160'] == 0


def test_other_periods_are_not():
    assert fytd_by_category([cat_report('May 1/25', 'Apr 30/26', {'480': 1.0})], 2027, '2026-09') is None  # last year
    assert fytd_by_category([cat_report('Sep 1/26', 'Sep 30/26', {'480': 1.0})], 2027, '2026-09') is None  # one month
    assert fytd_by_category([cat_report('May 1/26', 'Aug 31/26', {'480': 1.0})], 2027, '2026-09') is None  # stale


def sku_report(as_of, units):
    """A SKU Analysis with one Fancy Shirts SKU selling units[month] a month."""
    return dict(as_of=as_of, rows=[dict(sku='A1', cat_no='480', desc='Polo', oh=5, cost=40.0, last_sale='Sep20/26', mo=units)])


def prior_base(fy, hist, act):
    cats = {c: dict(gm=0.4, hist={k: 0.0 for k in fy_months(fy - 1)}, act={}) for c in CATS}
    cats['480'] = dict(gm=0.45, hist=hist, act=act)
    return dict(fy=f'FY{fy}', asOf='2027-04-30', cats=cats)


def test_last_year_carries_forward_without_last_years_reports():
    ly = {k: 100.0 for k in fy_months(2026)}
    prior = dict(base=prior_base(2027, ly, {'2026-05': 500.0}), skuhist={'meta': {'A1': ['480', 'Polo', 50.0]}})
    b = build({'sku_analysis': [sku_report('2026-06', {'2026-05': 10, '2026-06': 12})]}, prior)['base']
    assert all(b['cats']['480']['hist'][k] == 100.0 for k in fy_months(2026))
    assert b['ytdActual'] == 1100.0  # no sales report: the SKU history at the saved price, not $0


def test_new_fiscal_year_turns_last_uploads_actuals_into_history():
    ly = {k: 100.0 for k in fy_months(2026)}
    act = {k: 200.0 for k in fy_months(2027)[:11]}  # the last upload closed May-Mar
    units = {k: 4 for k in fy_months(2027)}
    prior = dict(base=prior_base(2027, ly, act), skuhist={'meta': {'A1': ['480', 'Polo', 50.0]}})
    b = build({'sku_analysis': [sku_report('2027-05', units)]}, prior)['base']
    h = b['cats']['480']['hist']
    assert b['fy'] == 'FY2028'
    assert all(h[k] == 200.0 for k in fy_months(2027)[:11])
    assert h['2027-04'] == 200.0  # April from the SKU history, scaled like the closed months (4 x $50 x 1.0)
    assert h['2025-05'] == 100.0  # the year before stays


def test_brand_scorecard_rebuilds_from_stored_documents():
    """Brands -> Update brands gives what a month-end upload with the same reports would."""
    ly = {k: 100.0 for k in fy_months(2026)}
    units = {'2026-05': 3, '2026-06': 4, '2026-07': 5}
    rep = sku_report('2026-07', units)
    rep['rows'].append(dict(sku='B2', cat_no='480', desc='Shirt Peter Millar', oh=2, cost=30.0, last_sale='Jan02/24', mo={'2025-08': 2}))
    bm = {'skus': {'A1': [{'b': 'Straight Down', 's': 100}]}}
    prior = dict(base=prior_base(2027, ly, {}), skuhist={'meta': {'A1': ['480', 'Polo', 50.0]}}, brandmap=bm)
    b = build({'sku_analysis': [rep]}, prior)
    docs = {'base/current': b['base'], 'brandin/current': brand_inputs(b['ctx']), 'brandmap/current': bm}
    docs.update({f'skuhist/{k}': v for k, v in b['skuhist'].items()})
    ctx = rebuild_ctx(docs)
    assert build_brands(ctx) == build_brands(b['ctx'])
    assert brand_skus(ctx) == brand_skus(b['ctx'])


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
