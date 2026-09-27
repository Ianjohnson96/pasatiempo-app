"""python merchandise/pipeline/test_brands.py"""
from brands import brand_split


def test_description_when_nothing_is_assigned():
    assert brand_split({}, '480100', 'Shirt Peter Millar') == [('Peter Millar', 1.0)]
    assert brand_split(None, '628100', 'Misc. Pasatiempo Flags') == []


def test_assignment_beats_the_description():
    m = {'628100': [{'b': 'Pasatiempo Logo', 's': 100}]}
    assert brand_split(m, '628100', 'Misc. Pasatiempo Flags') == [('Pasatiempo Logo', 1.0)]


def test_a_sku_split_between_brands():
    m = {'626000': [{'b': 'PRG', 's': 60}, {'b': 'Winston / Vanto / Seamus', 's': 40}]}
    assert brand_split(m, '626000', 'Towel PRG/Winston Large') == [('PRG', 0.6), ('Winston / Vanto / Seamus', 0.4)]


def test_shares_are_normalised_and_bad_entries_ignored():
    m = {'1': [{'b': 'A', 's': 1}, {'b': 'B', 's': 3}, {'b': '', 's': 50}, {'b': 'C', 's': 0}]}
    assert brand_split(m, '1', '') == [('A', 0.25), ('B', 0.75)]
    assert brand_split({'2': [{'b': 'A', 's': 0}]}, '2', 'Shirt Peter Millar') == [('Peter Millar', 1.0)]


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
