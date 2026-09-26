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
