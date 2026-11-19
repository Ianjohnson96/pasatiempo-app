"""The owner's saved guidelines (Guidelines page) reach the month-end reader: role map and member discount."""
from config import ROLE_OF, MEMBER_DISCOUNT, guided


def test_defaults_without_guidelines():
    assert guided(None) == (ROLE_OF, MEMBER_DISCOUNT)
    assert MEMBER_DISCOUNT == 0.25


def test_saved_values_on_top():
    role_of, md = guided({'roleOf': {'480': 'impulse'}, 'memberDiscount': 0.3})
    assert role_of['480'] == 'impulse'
    assert role_of['400'] == 'fashion'
    assert md == 0.3
    assert ROLE_OF['480'] == 'fashion'  # the defaults themselves are untouched


def test_bad_values_fall_back():
    role_of, md = guided({'memberDiscount': 'x', 'roleOf': {'480': 'bogus', 'abc': 'fashion'}})
    assert role_of == ROLE_OF
    assert md == MEMBER_DISCOUNT
    assert guided({'memberDiscount': 2})[1] == MEMBER_DISCOUNT
    assert guided('nonsense') == (ROLE_OF, MEMBER_DISCOUNT)


def test_advice_follows_the_discount():
    import model
    model.use_guidelines(*guided({'memberDiscount': 0.3}))
    try:
        assert '30%' in model.OVERSTOCK_ACTION['fashion'] and '25%' not in model.OVERSTOCK_ACTION['fashion']
        assert '30%' in model._aged_action('fashion', 400)
    finally:
        model.use_guidelines(*guided(None))
    assert '25%' in model.OVERSTOCK_ACTION['fashion']
