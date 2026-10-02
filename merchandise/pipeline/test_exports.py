from datetime import datetime

import exports
import refresh


def cells(*v):
    return [(x, '') for x in v]


def sku_rows():
    rows = []
    for i in range(12):
        mo = [i + 1] * 5 + [0] * 7  # newest five months sell
        rows.append(cells('0000000620', 'General Accessories', f'6200{i:02d}', f'Item {i}', datetime(2026, 3, 1),
                          datetime(2026, 9, 30 if i == 0 else 20), 10.0, 4, sum(mo), *mo, 'NA', 'Not Applicable', '~'))
    rows.append(cells('0000000620', 'General Accessories', 'ZDEL-0000000620', 'Deleted', None, None, None, *[0] * 14))
    return rows


def test_headerless_sku_analysis_months_run_newest_first():
    rows = sku_rows()
    assert exports.detect(rows) == 'sku_analysis'
    d = exports.parse_sku_analysis(rows)
    assert d['as_of'] == '2026-09' and d['months'][0] == '2026-09' and d['months'][-1] == '2025-10'
    assert len(d['rows']) == 12 and d['rows'][0]['cat_no'] == '620' and d['rows'][0]['last_sale'] == 'Sep30/26'


def test_sales_exports_get_their_period_from_the_sku_analysis():
    item = [cells('7', 'Pro Shop', f'6200{i:02d}', f'Item {i}', 20.0, (i + 1) * 5, (i + 1) * 100) for i in range(12)]
    item += [cells(None, 'All Sales Areas', *r[2:]) for r in [[v for v, _ in x] for x in item]]
    files = [('sku.xlsx', sku_rows()), ('item.csv', item)]
    reports, found = {}, []
    sku = exports.parse_sku_analysis(files[0][1])
    assert exports.detect(item) == 'sales_by_item'
    d = exports.parse_sales_by_item(item)
    assert d['620000']['units'] == 5  # the All Sales Areas pass isn't added again
    per = exports.infer_period(exports.units_of('sales_by_item', d), sku)
    assert per == ('2026-05', '2026-09')
    assert exports.period_text(*per) == ('May 1/26', 'Sep 30/26')


def test_an_identical_second_file_is_left_out(tmp_path):
    import csv, io
    buf = io.StringIO()
    csv.writer(buf).writerows([[v for v, _ in r] for r in sku_rows()])
    data = buf.getvalue().encode()
    _, found = refresh.read_reports([('Top 100.csv', data), ('Sku.csv', data)])
    assert found[0]['ok'] and found[0]['name'] == 'Sku.csv'
    assert not found[1]['ok'] and 'same rows' in found[1]['note']


def test_headerless_best100_reads_cost_and_margin():
    rows = [cells('0000000620', 'General Accessories', f'{i + 1:3d}', f'6200{i:02d}', f'Item {i}', (i + 1) * 5, 200.0, 120.0, 0.4, 3)
            for i in range(12)]
    assert exports.detect(rows) == 'best100'
    d = exports.parse_best100(rows)
    assert d['rows'][0] == dict(cat_no='620', cat='General Accessories', sku='620000', desc='Item 0', qty=5, gross=200, cost=120,
                                margin_pct=40.0, markdown=3)
    assert exports.infer_period(exports.units_of('best100', d), exports.parse_sku_analysis(sku_rows())) == ('2026-05', '2026-09')
