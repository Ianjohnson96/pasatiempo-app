"""Forecast and open-to-buy engine. Mirrors the in-app engine (app/engine.js) so the two can be checked against each other.

  sales      FY27 closed months = actual; open months = last year x (1 + growth for that month [+ category tweak])
             FY28 = FY27 x (1 + FY28 growth for the category); beyond FY28 repeats FY28
  cost       sales x (1 - realized margin)
  target EOM weeks of supply x next four months' cost / 17.3 weeks
  OTB        target EOM - opening inventory + cost of sales for the month  (the current month counts only what is left)
"""
from model import add_months, fy_months


def sales_plan(base, a):
    fy = int(base['fy'][2:])
    m27, m28 = fy_months(fy), fy_months(fy + 1)
    beyond = [add_months(m28[-1], i + 1) for i in range(4)]
    g27, g28 = a.get('g27', base['defaults']['g27']), a.get('g28', base['defaults']['g28'])
    g27c = a.get('g27cat', {})
    out = {}
    for c, v in base['cats'].items():
        s = {}
        for k in m27:
            if k in v['act']:
                s[k] = v['act'][k]
            else:
                s[k] = v['hist'].get(add_months(k, -12), 0) * (1 + g27.get(k, 0) + g27c.get(c, 0))
        for k in m28:
            s[k] = s[add_months(k, -12)] * (1 + g28.get(c, 0))
        for k in beyond:
            s[k] = s[add_months(k, -12)]
        out[c] = s
    return out, m27, m28


def run(base, a=None, carry=None):
    """Monthly OTB by category from the current month through the end of next fiscal year.
    carry: {cat: $} inventory above plan entering next year (committed orders beyond this year's budget)."""
    a = a or {}
    carry = carry or {}
    wos = a.get('wos', base['defaults']['wos'])
    S, m27, m28 = sales_plan(base, a)
    part = base.get('partial')
    start = part['m'] if part else add_months(base['actualThrough'], 1)
    share = 1.0
    if part:
        share = 1 - part['actual'] / sum(S[c][part['m']] for c in S)
    months = [k for k in m27 + m28 if k >= start]
    res = {}
    for c, v in base['cats'].items():
        cr = 1 - v['gm']
        bom = v['onHand']
        rows = []
        for k in months:
            if k == m28[0]:
                bom += carry.get(c, 0)
            sales = S[c][k] * (share if part and k == part['m'] else 1)
            cogs = sales * cr
            eom = wos[c] * sum(S[c][add_months(k, i + 1)] for i in range(4)) / 17.3 * cr
            rows.append(dict(m=k, sales=sales, cogs=cogs, bom=bom, eom=eom, otb=eom - bom + cogs))
            bom = eom
        res[c] = rows
    return dict(sales=S, months=months, cats=res, share=share, m27=m27, m28=m28)


def totals(r, cats, fy_months_):
    return sum(x['otb'] for c in cats for x in r['cats'][c] if x['m'] in fy_months_)
