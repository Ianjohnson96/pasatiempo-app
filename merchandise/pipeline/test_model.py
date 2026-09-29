"""python merchandise/pipeline/test_model.py"""
from config import CATS
import copy

import engine
from model import (brand_inputs, brand_skus, build, build_brands, build_subcats, sub_auto, desc_changes, fy_months, fytd_by_category,
                   open_desc_changes, rebuild_ctx, sells_auto, so_auto, special_budget)


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


def test_a_reused_sku_number_keeps_the_old_products_sales_apart():
    """SKU A1 was a Polo shirt until August; from September the number is a hat."""
    ly = {k: 100.0 for k in fy_months(2026)}
    units = {'2026-06': 10, '2026-07': 10, '2026-08': 10, '2026-09': 4}
    rep = sku_report('2026-09', units)
    rep['rows'][0].update(cat_no='440', desc='Hat Melin')
    bm = {'skus': {}, 'recycled': {'A1': {'from': '2026-09', 'brand': 'Peter Millar', 'cat': '480', 'desc': 'Shirt Polo'}}}
    prior = dict(base=prior_base(2027, ly, {}), skuhist={'meta': {'A1': ['480', 'Shirt Polo', 50.0]}}, brandmap=bm)
    b = build({'sku_analysis': [rep]}, prior)
    rows = {(r['brand'], r['seg']): r for r in build_brands(b['ctx'])['rows']}
    assert rows[('Peter Millar', 'mens')]['units12'] == 30  # the shirt's months stay with the shirt
    assert rows[('Melin', 'hats')]['units12'] == 4  # the hat starts fresh
    assert 'A1~2026-09' not in {r[0] for r in brand_skus(b['ctx'])['rows']}
    # the same from the stored documents (Update brands), before and after the split is saved
    docs = {'base/current': b['base'], 'brandin/current': brand_inputs(b['ctx']), 'brandmap/current': bm}
    docs.update({f'skuhist/{k}': v for k, v in b['skuhist'].items()})
    assert build_brands(rebuild_ctx(docs)) == build_brands(b['ctx'])


def test_a_new_description_is_flagged_until_answered():
    snap = {'A1': dict(sku='A1', desc='Hat Melin', cat_no='440'), 'B2': dict(sku='B2', desc='Shirt  FJ', cat_no='480')}
    prev = {'skus': {'A1': [50.0, 3, 20.0, 'Aug01/26', 'Shirt Polo'], 'B2': [40.0, 1, 20.0, 'Aug01/26', 'shirt fj']}}
    got = desc_changes(prev, snap, {'A1': ['480', 'Shirt Polo', 50.0]}, {}, '2026-10-01T00:00:00+00:00')
    assert list(got) == ['A1'] and got['A1']['was'] == 'Shirt Polo' and got['A1']['wasCat'] == '480'  # spacing and case don't count
    assert desc_changes({**prev, 'skus': {}, 'changed': got}, snap, {}, {}, 'later') == got  # carried to the next upload
    assert open_desc_changes(got, {'checked': {'A1': 'hat melin'}}) == {}  # same product
    assert open_desc_changes(got, {'recycled': {'A1': {'from': '2026-09', 'at': '2026-10-02T09:00:00Z'}}}) == {}  # marked reused
    assert open_desc_changes(got, {'recycled': {'A1': {'from': '2025-01', 'at': '2025-02-01T09:00:00Z'}}}) == got  # an older reuse


def test_subcategories_from_descriptions_and_the_programs_choice():
    assert sub_auto('620', 'Winston/Vanto/Seamus Dr Cover') == 's-620-headcovers'
    assert sub_auto('620', 'Misc. PRG Bag Tag') == 's-620-bag-tags'  # before totes & pouches ("bag")
    assert sub_auto('490', 'Sweater Greyson Hoodie') == 's-490-hoodies'
    assert sub_auto('350', 'Bag Titleist Travel') == 's-350-travel-covers'
    # from the first audit
    assert sub_auto('620', 'Misc. Putter Grip') == 's-620-grips-training-aids'
    assert sub_auto('620', 'Misc. PRG Chisel Mark') == 's-620-ball-markers-poker-chips'
    assert sub_auto('620', 'Misc. Sunglasses Maui Jim') == 's-620-sunglasses-rangefinders'  # not drinkware ("glass")
    assert sub_auto('620', 'Misc Flag Bag Duffel') == 's-620-totes-pouches'
    assert sub_auto('620', 'Misc. Winston Cutting Board') == 's-620-other-accessories'
    assert sub_auto('620', 'Misc. MGI Halo (Millslagle)') == 's-620-push-carts-electronics'
    assert sub_auto('620', 'Misc. Push Cart (Wood)') == 's-620-push-carts-electronics'
    assert sub_auto('620', 'Misc. Single Lithium Battery') == 's-620-push-carts-electronics'
    assert sub_auto('620', 'Misc. Putter Grip') == 's-620-grips-training-aids'  # "putt" is also a headcover word
    assert sub_auto('160', 'Balls Tit 26 No Imprint') == 's-160-stock-balls'
    assert sub_auto('620', 'Misc Headcover PRG', subids={'s-620-towels'}) == ''  # a removed subcategory is skipped
    ly = {k: 100.0 for k in fy_months(2026)}
    rep = sku_report('2026-07', {'2026-06': 4, '2026-07': 6})
    rep['rows'].append(dict(sku='B2', cat_no='480', desc='Shirt FJ Hoodie', oh=2, cost=30.0, last_sale='Jul02/26', mo={'2026-07': 3}))
    prior = dict(base=prior_base(2027, ly, {}), skuhist={'meta': {'A1': ['480', 'Polo', 50.0], 'B2': ['480', 'Shirt FJ Hoodie', 40.0]}},
                 submap={'skus': {'A1': 's-480-junior'}})
    b = build({'sku_analysis': [rep]}, prior)
    rows = {r['sub']: r for r in build_subcats(b['ctx'])['rows']}
    assert rows['s-480-junior']['units12'] == 10  # set in the program
    assert rows['s-480-other']['units12'] == 3  # from the description



def test_special_orders_are_flagged_from_the_description():
    assert so_auto('200', 'Woods Tit GT1 (Margerum)') == 'member'  # a customer's name
    assert so_auto('480', 'Shirt Sip-N-Shop 25 Summit') == 'group'
    assert so_auto('640', 'Rental Clubs Callaway') == 'notretail'
    assert so_auto('640', 'Misc. Straight Down') == 'member'  # anything in Special Orders
    assert so_auto('300', 'Shoes FJ Fitting Shoes') == ''  # fitting stock is shelf stock
    assert so_auto('160', 'Balls Tit 26 Imprint', 's-160-custom-imprint') == 'member'
    assert so_auto('480', 'Polo Peter Millar (Solid)') == 'member' and so_auto('480', 'Polo Peter Millar') == ''
    assert sells_auto('640', 'Woods TM Qi4d (J Bogard)') == '200'
    assert sells_auto('640', 'Sip-N-Shop 25 Summit') == ''  # the description doesn't say what was sold
    assert sells_auto('480', 'Woods anything') == '480'  # only Special Orders items move


def test_budgets_count_shelf_sales_and_reports_show_special_orders_in_their_category():
    ly = {k: 1000.0 for k in fy_months(2026)}
    units = {k: 10 for k in fy_months(2026)[3:] + ['2026-05', '2026-06']}
    rep = sku_report('2026-06', units)
    rep['rows'] += [dict(sku='B2', cat_no='480', desc='Polo FJ (Smith)', oh=1, cost=40.0, last_sale='Jun02/26', mo=dict(units)),
                    dict(sku='C3', cat_no='640', desc='Hoodie Logo (Jones)', oh=0, cost=30.0, last_sale='Jun02/26', mo={'2026-06': 2})]
    meta = {'A1': ['480', 'Polo', 50.0], 'B2': ['480', 'Polo FJ (Smith)', 50.0], 'C3': ['640', 'Hoodie Logo (Jones)', 60.0]}
    prior = dict(base=prior_base(2027, ly, {}), skuhist={'meta': meta})
    b = build({'sku_analysis': [rep]}, prior)
    v = b['base']['cats']['480']
    assert v['so']['2026-05'] == round(v['act']['2026-05'] / 2, 2) and v['so']['2025-11'] == 500.0  # half the category's sales
    assert v['soOnHand'] == 40.0
    shelf, full = engine.run(b['base']), engine.run(dict(b['base'], cats={c: dict(x, so={}, soOnHand=0) for c, x in b['base']['cats'].items()}))
    r0, r1 = full['cats']['480'][1], shelf['cats']['480'][1]  # August: last August's split carries forward
    assert r1['m'] == '2026-08' and abs(r1['cogs'] - r0['cogs'] / 2) < 0.01 and r1['sales'] == r0['sales']
    assert shelf['cats']['480'][0]['bom'] == full['cats']['480'][0]['bom'] - 40  # special-order stock isn't shelf stock
    # the report: C3 (Special Orders) sells as a sweater, flagged; the call and weeks count the shelf only
    rows = {(r['cat'], r['sub']): r for r in build_subcats(b['ctx'])['rows']}
    assert rows[('490', 's-490-hoodies')]['so'] == 120 and rows[('490', 's-490-hoodies')]['call'] == 'special'
    polo = rows[('480', 's-480-men-s-polos')]
    assert polo['so'] == polo['t12'] / 2 and polo['soOh'] == 40
    # Update subcategories gives the same, and marking B2 shelf stock in Sort SKUs puts its sales back in the budget
    docs = {'base/current': copy.deepcopy(b['base']), 'brandin/current': brand_inputs(b['ctx']), 'submap/current': {'so': {'B2': 'shelf'}}}
    docs.update({f'skuhist/{k}': x for k, x in b['skuhist'].items()})
    ctx = rebuild_ctx(dict(docs, **{'submap/current': {}}))
    special_budget(ctx)
    assert ctx['base']['cats']['480']['so'] == v['so']
    ctx = rebuild_ctx(docs)
    special_budget(ctx)
    assert ctx['base']['cats']['480']['so'] == {} and ctx['base']['cats']['480']['soOnHand'] == 0
    assert [r[7:] for r in brand_skus(b['ctx'])['rows']] == [['480', ''], ['480', 'member'], ['490', 'member']]
    # a SKU rung to the wrong category reports where Sort SKUs puts it; its budget stays with the POS category
    ctx = rebuild_ctx(dict(docs, **{'submap/current': {'cat': {'A1': '620'}}}))
    assert {r['cat'] for r in build_subcats(ctx)['rows'] if r['sub'] == 's-620-other-accessories'} == {'620'}
    special_budget(ctx)
    assert ctx['base']['cats']['480']['so'] == v['so']

if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
