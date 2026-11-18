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
    return {'cur': {c: round(engine.totals(r, [c], r['m27']), 4) for c in base['cats']},
            'next': {c: round(engine.totals(r, [c], r['m28']), 4) for c in base['cats']},
            'nextWithCarry': {c: round(engine.totals(rc, [c], rc['m28']), 4) for c in base['cats']}}


def test_python_engine_matches_the_shared_fixture():
    fx = json.load(open(FIX))
    got = compute(fx)
    for part, by_cat in fx['expected'].items():
        for c, v in by_cat.items():
            assert abs(got[part][c] - v) < 0.01, (part, c, got[part][c], v)


def regenerate():
    fx = json.load(open(FIX))
    fx['expected'] = compute(fx)
    json.dump(fx, open(FIX, 'w'), indent=1)
