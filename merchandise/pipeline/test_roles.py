"""python -m pytest merchandise/pipeline/test_roles.py -- category roles in the brand calls and the To do wording."""
from config import CATS, ROLE_OF
from model import _aged_action, call_for, OVERSTOCK_ACTION


def m(**k):
    base = dict(t12=20000, oh=8000, wks=60, agedPct=0.1, gmroi=0.4, md=0.05, ly=100, ty=90, seg='mens')
    return dict(base, **k)


def test_every_category_has_a_role():
    assert set(CATS) <= set(ROLE_OF)


def test_slow_apparel_brand_is_dropped_but_an_equipment_brand_is_carried_thinner():
    assert call_for(m())[0] == 'drop'
    call, why = call_for(m(seg='equipment', gmroi=0.3))
    assert call == 'reduce' and 'fitting' in why


def test_equipment_brand_with_mostly_aged_stock_is_carried_thinner():
    assert call_for(m(seg='equipment', agedPct=0.6, gmroi=0.2, wks=30))[0] == 'reduce'
    assert call_for(m(agedPct=0.6, gmroi=0.2, wks=30))[0] == 'drop'


def test_equipment_brand_that_stopped_selling_is_still_dropped():
    assert call_for(m(seg='equipment', t12=0, ty=0, ly=0))[0] == 'drop'


def test_aged_logo_goods_mention_the_member_discount_and_no_return():
    a = _aged_action('fashion', 400)
    assert '25%' in a and "can't go back" in a
    assert 'rep' in _aged_action('hardgoods', 400)
    assert 'demo' in _aged_action('demo', 400)


def test_overstock_wording_by_role():
    assert '25%' in OVERSTOCK_ACTION['fashion']
    assert 'fitting' in OVERSTOCK_ACTION['hardgoods']
