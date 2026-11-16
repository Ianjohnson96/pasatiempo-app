"""The forecast across the fiscal-year turn (May 1): the April close, the May close, and saved plans in either shape."""
import engine
from config import GROWTH_DEFAULT
from model import fy_months, add_months


def base_at(fy, through, act, hist, defaults=None):
    """One category, sales 100 a month everywhere unless given."""
    cats = {'620': dict(name='GA', gm=0.4, onHand=1000.0, soOnHand=0, act=act, hist=hist, so={})}
    return dict(fy=f'FY{fy}', asOf=through + '-30', actualThrough=through, partial=None, cats=cats,
                defaults=defaults or dict(growth={'2028': {'months': {}, 'cats': {'620': 0.10}}}, wos={'620': 12}))


def test_the_april_close_plans_the_next_year_from_this_years_actuals():
    act = {k: 200.0 for k in fy_months(2027)}                       # FY2027 all closed at 200 a month
    hist = {k: 100.0 for k in fy_months(2026)}                      # FY2026 at 100
    b = base_at(2027, '2027-04', act, hist)
    assert engine.plan_fy(b) == 2028
    r = engine.run(b)
    assert r['m27'] == fy_months(2028)                              # the budget year is FY2028, not the closed FY2027
    assert round(r['sales']['620']['2027-06']) == 220               # FY2027's 200 x (1 + FY2028's 10% for the category)
    assert all(k >= '2027-05' for k in r['months'])


def test_the_may_close_gives_the_same_plan_as_the_april_close():
    april = engine.run(base_at(2027, '2027-04', {k: 200.0 for k in fy_months(2027)}, {k: 100.0 for k in fy_months(2026)}))
    may = engine.run(base_at(2028, '2027-05', {'2027-05': 220.0}, {k: 200.0 for k in fy_months(2027)}))
    assert round(may['sales']['620']['2027-06']) == round(april['sales']['620']['2027-06']) == 220
    assert round(may['sales']['620']['2028-04']) == 220


def test_growth_by_year_reads_either_shape():
    old = {'g27': {'2026-12': 0.25}, 'g27cat': {'620': 0.05}, 'g28': {'620': 0.08}, 'wos': {'620': 9}}
    a = engine.resolve(base_at(2027, '2026-11', {}, {}, defaults=dict(growth=GROWTH_DEFAULT, wos={'620': 14})), old)
    assert a['g27']['2026-12'] == 0.25 and a['g27']['2027-01'] == GROWTH_DEFAULT['2027']['months']['2027-01']
    assert a['g27cat'] == {'620': 0.05} and a['g28']['620'] == 0.08 and a['wos']['620'] == 9
    # the same saved plan read a year later: last year's g28 is now this year's category growth
    b = engine.resolve(base_at(2028, '2027-05', {}, {}, defaults=dict(growth=GROWTH_DEFAULT, wos={'620': 14})), old)
    assert b['g27cat']['620'] == 0.08 and b['g27'] == {} and b['g28'] == {}


def test_older_base_defaults_still_read():
    b = base_at(2027, '2026-11', {}, {}, defaults=dict(g27={'2026-12': 0.25}, g28={'620': 0.08}, wos={'620': 14}))
    a = engine.resolve(b)
    assert a['g27'] == {'2026-12': 0.25} and a['g28'] == {'620': 0.08} and a['wos'] == {'620': 14}
