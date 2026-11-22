import re
"""Planning constants for the Pro Shop merchandise program. Edit here, re-run the refresh."""

# Merchandise categories (POS category number -> name). Special Orders are reported but not bought against OTB.
CATS = {
    '620': 'General Accessories', '440': 'Clothing Accessories', '480': 'Fancy Shirts', '490': 'Sweaters',
    '400': 'Solid Shirts', '200': 'Golf Clubs', '500': 'Ladies Apparel', '470': 'Jackets', '160': 'Golf Balls',
    '640': 'Special Orders', '320': 'Gloves', '350': 'Golf Bags', '300': 'Shoes', '660': 'Yardage Books',
    '220': 'Demo Clubs', '430': 'Pants/Shorts',
}
OTB_EXCLUDE = {'640'}

# Categories bought to replace what sells rather than to a seasonal assortment.
REPLENISH = {'200', '160', '350'}

# Each category's job in the shop (mirrors ROLE_OF in app/src/17-metrics.js). fashion: logo apparel, judged on
# sell-through and markdowns; impulse: accessories and hats; consumable: balls and gloves, never run out; hardgoods:
# stock clubs, shoes and bags that back fittings and special orders; demo: the demo fleet, a fitting tool.
# All soft goods carry the club's logo (they can't go back to the vendor) and members get 25% off them.
ROLE_OF = {'400': 'fashion', '430': 'fashion', '470': 'fashion', '480': 'fashion', '490': 'fashion', '500': 'fashion',
           '440': 'impulse', '620': 'impulse', '660': 'impulse', '160': 'consumable', '320': 'consumable',
           '200': 'hardgoods', '300': 'hardgoods', '350': 'hardgoods', '220': 'demo', '640': 'special'}
MEMBER_DISCOUNT = 0.25
ROLE_KEYS = {'fashion', 'impulse', 'consumable', 'hardgoods', 'demo'}


def guided(g):
    """(role map, member discount) for one month-end run: these defaults with the owner's saved Guidelines on top
    (guidelines/current, sent by the Month-end page). Anything missing or invalid keeps its default."""
    role_of, md = dict(ROLE_OF), MEMBER_DISCOUNT
    if isinstance(g, dict):
        ro = g.get('roleOf')
        if isinstance(ro, dict):
            for c, r in ro.items():
                if isinstance(c, str) and re.fullmatch(r'\d{3}', c) and c != '640' and r in ROLE_KEYS:
                    role_of[c] = r
        v = g.get('memberDiscount')
        if isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 0.9:
            md = float(v)
    return role_of, md

# Turns targets (17-metrics.js BENCH_DEFAULT.turns): balls and gloves turn faster; the rest by Scorecard segment.
TURNS_DEFAULT = {'apparel': 2, 'accessories': 2, 'equipment': 2, 'fast': 3}
FAST_TURN = {'160', '320'}


def seg_of(c):
    return 'equipment' if c in ('160', '200', '220', '300', '320', '350') else 'accessories' if c in ('440', '620', '660') else 'apparel'


def _num(v, lo, hi):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and lo <= v <= hi


def turns_targets(g):
    """The turns targets from saved Guidelines (bench.turns), the defaults where missing or invalid."""
    t = dict(TURNS_DEFAULT)
    s = (((g or {}).get('bench') or {}).get('turns') or {}) if isinstance(g, dict) else {}
    for k in t:
        if isinstance(s, dict) and _num(s.get(k), 0, 52):
            t[k] = s[k]
    return t


def suggested_total(rows, turns):
    """Shelf stock the last 12 months' sales support: each category's cost of shelf sales ((t12 - special orders) x
    (1 - margin)) over its turns target. Mirrors suggestedTotal() in app/src/19-guides.js."""
    stock = 0.0
    for r in rows or []:
        c = r.get('cat') if isinstance(r, dict) else None
        if not c or c == '640':
            continue
        t = turns['fast'] if c in FAST_TURN else turns[seg_of(c)]
        if t > 0:
            stock += max(0.0, (r.get('t12') or 0) - (r.get('so') or 0)) * (1 - (r.get('gm') or 0)) / t
    return int(stock + 0.5)


def mix_total(g, rows=None):
    """The total stock the budget's target weeks are linked to (engine.mix_scale), from saved Guidelines: the suggested
    total from these assort rows and the saved turns targets while mix.follow is 'suggested', else mix.total; None for
    none. Mirrors mixTotalOf() in app/src/19-guides.js."""
    m = ((g or {}).get('mix') or {}) if isinstance(g, dict) else {}
    m = m if isinstance(m, dict) else {}
    typed = float(m['total']) if _num(m.get('total'), 1, 1e9) else None
    if m.get('follow') == 'suggested':
        s = suggested_total(rows, turns_targets(g))
        return float(s) if s > 0 else typed
    return typed

# Target weeks of supply at cost for end-of-month inventory.
TARGET_WOS = {'620': 14, '440': 13, '480': 10, '490': 11, '400': 10, '200': 14, '500': 12, '470': 12, '160': 14,
              '640': 10, '320': 13, '350': 14, '300': 14, '660': 10, '220': 10, '430': 12}

# Planned markdown rate (share of retail) by category.
MARKDOWN = {'620': .10, '440': .10, '480': .08, '490': .10, '400': .09, '200': .10, '500': .15, '470': .11, '160': .07,
            '640': .03, '320': .15, '350': .15, '300': .15, '660': .05, '220': .00, '430': .15}

# FY2027 forecast growth vs the same month last year, for months not yet closed.
G27_DEFAULT = {'2026-09': .37, '2026-10': .30, '2026-11': .30, '2026-12': .25, '2027-01': .20, '2027-02': .20,
               '2027-03': .18, '2027-04': .18}

# FY2028 growth vs FY2027 by category: grow the brands and categories that earn, shrink the ones being exited.
G28_DEFAULT = {'620': .08, '440': .08, '480': .06, '400': .06, '490': .03, '470': 0, '320': .03, '660': 0, '200': 0,
               '160': .03, '350': -.10, '500': -.15, '300': -.25, '220': -.25, '430': -.15, '640': 0}

# Forecast growth by fiscal year, each year against the one before: "months" by calendar month (YYYY-MM), "cats" an
# extra by category on top. The plan's current year and the year after read their own entry (engine.resolve), so
# nothing has to be re-keyed when the year turns; a year with no entry repeats the year before until growth is set
# on the Forecast page (plan/assumptions, the same shape). Add the next year's defaults here at each year-end.
GROWTH_DEFAULT = {
    '2027': {'months': G27_DEFAULT, 'cats': {}},
    '2028': {'months': {}, 'cats': G28_DEFAULT},
}

# Daily Sales Report category headings -> category number.
DAILY_NAMES = {'Golf Balls': '160', 'Golf Clubs': '200', 'Demo Golf Clubs': '220', 'Shoes': '300', 'Gloves': '320',
               'Golf Bags': '350', 'Solid Shirts': '400', 'Pants/Shorts': '430', 'Clothing Accessories': '440',
               'Jackets': '470', 'Fancy Shirts': '480', 'Sweaters': '490', 'Ladies Apparrel': '500',
               'General Accessories': '620', 'Special Orders-All Types': '640', 'Yardage Books/Story Boods': '660'}

# SKUs known to carry several products, styles or sizes.
COMBINED = {
    '162100': 'Two different balls (Pro V1 and Pro V1x) on one SKU.',
    '625300': 'Three makers (Winston, Vanto, Seamus) and two cover types (fairway and hybrid) on one SKU.',
    '625200': 'Three makers on one SKU.', '626400': 'Three makers on one SKU.',
    '624500': 'Several ball-marker designs on one SKU.', '624300': 'Divot tools and hat clips on one SKU.',
    '626000': 'PRG and Winston towels on one SKU.', '165600': 'Two different balls (TP5 and TP5x) on one SKU.',
    '625000': 'Two products on one SKU.', '620121': 'Every PRG headcover design on one SKU.',
    '628100': 'Every flag design on one SKU.', '444400': 'The whole Melin hat line on one SKU.',
    '442600': 'An entire Imperial hat line on one SKU.',
    '404400': 'The whole Straight Down shirt line on one SKU — styles, colors and sizes.',
    '488900': 'The whole Peter Millar shirt line on one SKU.', '497400': 'The whole Peter Millar sweater line on one SKU.',
    '445400': 'The whole Legendary hat line on one SKU.', '446200': 'The whole Branded Bills line on one SKU.',
    '321300': 'Every size and hand of the custom glove on one SKU.', '472100': 'Every color and size of the FJ hoodie on one SKU.',
}

# Subcategory of a SKU from its description, for subcategory reporting (model.sub_auto). The ids are the
# program's subcategories (subcats/{id}, the ones order lines use). Checked in order, first match wins;
# "." catches the rest of the category. Brands -> Subcategories -> Sort SKUs corrects any SKU.
SUB_RULES = {
    '160': [('s-160-custom-imprint', r'(?<!no )imprint|custom|\('), ('s-160-logo-balls', r'logo|pasatiempo|\bind\b'), ('s-160-stock-balls', r'.')],
    '200': [('s-200-putters', r'putter'), ('s-200-drivers-woods', r'wood|driver|\bdr\b|fwy|hyb'),
            ('s-200-irons-wedges', r'iron|wedge|\bsm\d|vokey'), ('s-200-custom-fitting-orders', r'\(')],
    '220': [('s-220-demo-clubs', r'.')],
    '300': [('s-300-junior-shoes', r'\bjr\b|junior'), ('s-300-shoe-accessories', r'spike|lace|shoe bag|tree'),
            ("s-300-women-s-shoes", r'\bw\b|wmn|women|ladies'), ("s-300-men-s-shoes", r'.')],
    '320': [('s-320-rain-winter-pairs', r'rain|winter|weather'), ("s-320-women-s-gloves", r'\bw\b|ladies|women|kalea'), ("s-320-men-s-gloves", r'.')],
    '350': [('s-350-travel-covers', r'travel'), ('s-350-backpacks-duffels', r'back ?pack|bpack|duffel'), ('s-350-cart-bags', r'cart'),
            ('s-350-staff-tour-bags', r'staff|tour\b|signature'), ('s-350-stand-carry-bags', r'.')],
    '400': [('s-400-junior', r'\bjr\b|junior'), ('s-400-hoodies', r'hood'), ('s-400-t-shirts', r't-?shirt|\btee\b|\bt$'), ('s-400-polos', r'.')],
    '430': [('s-430-rain-pants', r'rain'), ("s-430-men-s-shorts", r'short'), ("s-430-men-s-pants", r'.')],
    '440': [('s-440-beanies', r'beanie'), ('s-440-bucket-sun-hats', r'bucket|\bsun\b|visor|straw|aussie'), ('s-440-belts', r'belt'),
            ('s-440-socks', r'sock'), ('s-440-hats-caps', r'hat|caps?\b|snap'), ('s-440-other', r'.')],
    '470': [('s-470-junior', r'\bjr\b|junior'), ('s-470-rain-jackets', r'rain'), ('s-470-vests', r'vest'), ('s-470-hoodies', r'hood'),
            ('s-470-wind-hybrid-jackets', r'.')],
    '480': [('s-480-junior', r'\bjr\b|junior'), ("s-480-men-s-long-sleeve-sweater-polos", r'\bls\b|long ?sl|sweater polo'),
            ('s-480-other', r'hood|t-?shirt|\btee\b|vest|jacket'), ("s-480-men-s-polos", r'.')],
    '490': [('s-490-hoodies', r'hood'), ('s-490-vests', r'vest'), ('s-490-quarter-zips-pullovers', r'.')],
    '500': [('s-500-junior-girls', r'\bjr\b|junior|girl'), ('s-500-skorts-skirts', r'skort|skirt|short'), ('s-500-pants', r'pant|capri|tregging'),
            ('s-500-jackets-vests', r'jacket|vest'), ('s-500-sweaters-layers', r'sweater|hood|pullover|1/4'), ('s-500-tops-polos', r'.')],
    '620': [('s-620-grips-training-aids', r'\bgrips?\b|regrip'), ('s-620-headcovers', r'headcover|cover|\bdr c|fwy/|putt|dormie plate'),
            ('s-620-towels', r'towel'), ('s-620-bag-tags', r'bag tag'), ('s-620-totes-pouches', r'flag bag|tote|pouch|toiletry|duffel|shoe bag'),
            ('s-620-ball-markers-poker-chips', r'marker|\bmark\b|coin|poker|chip|jewel|ballmark'), ('s-620-divot-tools-hat-clips', r'divot|hat ?cl'),
            ('s-620-sunglasses-rangefinders', r'sunglass|maui|oakley|bushnell|rangefinder|\bmj\b|lens'),
            ('s-620-drinkware', r'mug|yeti|tumbler|tervis|glass|\bglas\b|flask|tempercraft|coaster|bottle|colster|wine|shot|cup\b|mule|decant|director'),
            ('s-620-flags', r'flag'), ('s-620-yardage-books-scorecard-holders', r'yardage|score'),
            ('s-620-books-posters', r'book|poster|\bmap\b|print\b|photo|painting|note card'),
            ('s-620-grips-training-aids', r'align|\bsticks?\b|squid|battery|mgi|remote|training'), ('s-620-other-accessories', r'.')],
    '640': [('s-640-customer-special-order', r'.')],
    '660': [('s-660-greens-yardage-books', r'.')],
}

# Special orders: items bought for one customer or one group rather than for the shelf. They sell as ordinary
# categorized items, so reports show them in their category (flagged), while budgets count shelf sales and
# stock only. model.so_auto sets the flag from the description; Subcategories -> Sort SKUs corrects any SKU.
SO_KINDS = {'member': 'Member special order', 'group': 'Group & event order', 'notretail': 'Not retail'}
SO_NOT_RETAIL = r'rental|\bdemo\b|fit cart|scoring kit|caddie bib|tee prize|sanford|clean up|exchange|repair|replace'  # only in 640
SO_GROUP = (r'sip-n-|invitational|\binv\b|mack? ?g\b|mem/mem|member.?guest|mac cup|team play|gathering|ucsc|bay cit|ymca|lutz ?-|'
            r'lnp[cg]|rutan|mauna kea|\bmc\b|staff uni')
SO_SHELF = r'fitting (shoes|putter)|sm11 fitting|fitting$'  # fitting stock, bought for the shelf
SO_MEMBER = r"\((?!\d)[A-Za-z .&'/-]{2,}"  # a customer's name in brackets
SO_MEMBER_SUBS = {'s-200-custom-fitting-orders', 's-160-custom-imprint'}

# The category a Special Orders (640) item sells as, from its description. Checked in order, first match wins;
# no match leaves it in Special Orders until someone picks one in Sort SKUs.
SELLS_AS = [(r'push cart|mgi|remote|motor|legs', '620'), (r'sunglass|maui jim|\bmj\b|oakley|meta glasses', '620'),
            (r'tote|bag tag|towel|marker', '620'),
            (r'\bputters?\b|\bwoods?\b|\birons?\b|\bwedges?\b|\bdriver\b|\bfwy\b|\bhyb\b|\bgts\b|\bsm1\d\b|fairway wood', '200'),
            (r'\bballs?\b|pro-?v1', '160'), (r'\bshoes?\b', '300'), (r'\bgloves?\b', '320'), (r'\bbag staff\b|^bag\b|cart bag|stand bag', '350'),
            (r'\bhats?\b|visor|beanie|belt', '440'), (r'skort|skirt|ladies|women', '500'),
            (r'hood|sweater|cashmere|1/4|quarter|crew|\bvests?\b', '490'), (r'jacket|pullover|rain', '470'),
            (r'pants|shorts?\b|tegging', '430'), (r'shirts?|polo|\btee\b|t-shirt', '480')]
