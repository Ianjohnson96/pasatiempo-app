"""python merchandise/pipeline/test_model.py"""
from model import fytd_by_category


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


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
