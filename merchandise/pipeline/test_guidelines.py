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


# Shared with lib/merch/guides.test.ts (suggestedTotal, mixTotalOf): same rows, same answers.
MIXROWS = [{'cat': '480', 't12': 10000, 'gm': 0.5}, {'cat': '620', 't12': 6000, 'so': 1000, 'gm': 0.4}, {'cat': '160', 't12': 9000, 'gm': 0.25},
           {'cat': '200', 't12': 4000, 'so': 3000, 'gm': 0.2}, {'cat': '640', 't12': 5000, 'gm': 0.1}]


def test_suggested_total_matches_the_page():
    from config import suggested_total, turns_targets
    assert suggested_total(MIXROWS, turns_targets(None)) == 6650
    assert suggested_total(MIXROWS, turns_targets({'bench': {'turns': {'accessories': 4}}})) == 5900
    assert turns_targets({'bench': {'turns': {'fast': 'x', 'apparel': -1}}}) == {'apparel': 2, 'accessories': 2, 'equipment': 2, 'fast': 3}


def test_the_linked_total_follows_the_suggestion():
    from config import mix_total
    assert mix_total(None, MIXROWS) is None
    assert mix_total({'mix': {'total': 632720}}, MIXROWS) == 632720
    assert mix_total({'mix': {'total': 632720, 'follow': 'suggested'}}, MIXROWS) == 6650
    assert mix_total({'mix': {'total': 632720, 'follow': 'suggested'}, 'bench': {'turns': {'accessories': 4}}}, MIXROWS) == 5900
    assert mix_total({'mix': {'total': 632720, 'follow': 'suggested'}}, []) == 632720   # no sales: the typed total stands
    assert mix_total({'mix': {'total': -5}}) is None
