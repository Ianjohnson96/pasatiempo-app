"""The Python engine against fixtures/engine_parity.json. lib/merch/engine-parity.test.ts runs app/src/20-engine.js on
the same file and must get the same numbers, so the month-end reader and the page can't drift apart.

If the model changes on purpose, change both engines, then regenerate the expected numbers with
python -c "import test_parity; test_parity.regenerate()" and check the JS test still passes."""
import json
import os

import engine

FIX = os.path.join(os.path.dirname(__file__), 'fixtures', 'engine_parity.json')


def compute(fx):
    base, carry = fx['base'], fx['carry']
    r, rc = engine.run(base), engine.run(base, None, carry)
    rm = engine.run(base, None, carry, fx['mixTotal'])
    return {'cur': {c: round(engine.totals(r, [c], r['m27']), 4) for c in base['cats']},
            'next': {c: round(engine.totals(r, [c], r['m28']), 4) for c in base['cats']},
            'nextWithCarry': {c: round(engine.totals(rc, [c], rc['m28']), 4) for c in base['cats']},
            'curWithMix': {c: round(engine.totals(rm, [c], rm['m27']), 4) for c in base['cats']},
            'nextWithMix': {c: round(engine.totals(rm, [c], rm['m28']), 4) for c in base['cats']}}


def test_python_engine_matches_the_shared_fixture():
    fx = json.load(open(FIX))
    got = compute(fx)
    for part, by_cat in fx['expected'].items():
        for c, v in by_cat.items():
            assert abs(got[part][c] - v) < 0.01, (part, c, got[part][c], v)


def test_a_mix_total_sets_the_average_target_stock():
    """Linked to the mix total, the budgeted categories' target month-end stock averages the total over the first
    12 months planned, and every category's weeks move by the same factor."""
    fx = json.load(open(FIX))
    base, total = fx['base'], fx['mixTotal']
    r0, rm = engine.run(base), engine.run(base, None, None, total)
    cats = [c for c in base['cats'] if c not in (base.get('exclude') or ['640'])]
    year = rm['months'][:12]
    avg = sum(x['eom'] for c in cats for x in rm['cats'][c] if x['m'] in year) / len(year)
    assert abs(avg - total) < 0.01
    for c in base['cats']:
        for a, b in zip(r0['cats'][c], rm['cats'][c]):
            assert abs(b['eom'] - a['eom'] * rm['scale']) < 1e-6
            assert abs(b['cogs'] - a['cogs']) < 1e-9 and abs(b['sales'] - a['sales']) < 1e-9
    assert engine.run(base, None, None, None)['scale'] == 1.0 and engine.run(base, None, None, 0)['scale'] == 1.0


def regenerate():
    fx = json.load(open(FIX))
    fx['expected'] = compute(fx)
    json.dump(fx, open(FIX, 'w'), indent=1)
