"""python merchandise/pipeline/test_brands.py"""
from brands import brand_of, brand_split


def test_description_when_nothing_is_assigned():
    assert brand_split({}, '480100', 'Shirt Peter Millar') == [('Peter Millar', 1.0)]
    assert brand_split(None, '620600', 'Misc UV Sleeve') == []


def test_assignment_beats_the_description():
    m = {'628100': [{'b': 'Pasatiempo Logo', 's': 100}]}
    assert brand_split(m, '628100', 'Misc. Pasatiempo Flags') == [('Pasatiempo Logo', 1.0)]


def test_lab_squid_and_the_clubs_own_goods():
    assert brand_of('Putter LAB 486') == 'LAB'
    assert brand_of('Misc Squid Sticks') == 'Squid Designs'
    assert brand_of('Misc. Pasa Stickers') == 'Pasatiempo'
    assert brand_of('Misc. Pasatiempo Holiday') == 'Pasatiempo'
    assert brand_of('Hat Titleist Pasatiempo Logo') == 'Titleist'
    assert brand_of('Misc. Label Maker') is None


def test_a_sku_split_between_brands():
    m = {'626000': [{'b': 'PRG', 's': 60}, {'b': 'Winston / Vanto / Seamus', 's': 40}]}
    assert brand_split(m, '626000', 'Towel PRG/Winston Large') == [('PRG', 0.6), ('Winston / Vanto / Seamus', 0.4)]


def test_shares_are_normalised_and_bad_entries_ignored():
    m = {'1': [{'b': 'A', 's': 1}, {'b': 'B', 's': 3}, {'b': '', 's': 50}, {'b': 'C', 's': 0}]}
    assert brand_split(m, '1', '') == [('A', 0.25), ('B', 0.75)]
    assert brand_split({'2': [{'b': 'A', 's': 0}]}, '2', 'Shirt Peter Millar') == [('Peter Millar', 1.0)]


def test_words_added_in_the_program_name_a_brand():
    bl = {'words': {'Pasatiempo Logo': ['pasatiempo', 'pasa logo'], 'Cutter & Buck': ['c&b']}}
    assert brand_of('Misc. Pasatiempo Flags', bl) == 'Pasatiempo Logo'
    assert brand_of('Polo C&B navy', bl) == 'Cutter & Buck'
    assert brand_of('Pasatiempos', bl) is None  # whole words only
    assert brand_split({}, '628100', 'Misc. Pasatiempo Flags', bl=bl) == [('Pasatiempo Logo', 1.0)]


def test_added_words_come_before_the_built_in_list():
    assert brand_of('Hat TM logo white') == 'Travis Mathew'
    assert brand_of('Hat TM logo white', {'words': {'TaylorMade': ['tm logo']}}) == 'TaylorMade'


def test_renames_and_merges_apply_everywhere():
    bl = {'rename': {'Winston / Vanto / Seamus': 'Seamus', 'PRG': 'Seamus'}}
    assert brand_of('Towel Winston large', bl) == 'Seamus'
    m = {'626000': [{'b': 'PRG', 's': 60}, {'b': 'Winston / Vanto / Seamus', 's': 40}]}
    assert brand_split(m, '626000', '', bl=bl) == [('Seamus', 1.0)]
    assert brand_of('Shirt Peter Millar', {'rename': {'A': 'B', 'B': 'A'}}) == 'Peter Millar'  # a loop can't hang it


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
