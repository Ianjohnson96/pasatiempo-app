"""Brand and segment assignment from POS item descriptions."""
import re

ALIAS = [
    ('Peter Millar', r'peter millar|\bpm\b'), ('Straight Down', r'straight down|\bsdr?\b|\bsd mack|\bsd mens'),
    ('Holderness & Bourne', r'holderness|\bh&b\b|\bhb\b'), ('Travis Mathew', r'travis\s*mathew|\btm logo'), ('Melin', r'melin'),
    ('Imperial', r'imperial'), ('Branded Bills', r'branded bills'), ('Legendary', r'legendary'), ('Angus & Grace', r'angus'),
    ('Greyson', r'greyson'), ('KJUS', r'kjus'), ('Zero Restriction', r'\bzero\b'), ('Sunice', r'sunice'), ('Amble', r'amble'),
    ('Anderson Ord', r'anderson\s*ord'), ('B. Draddy', r'draddy'), ('Bad Birdie', r'bad birdie'),
    ('Fairway & Greene', r'fairway\s*&\s*greene|f&g'), ('GG Blue', r'gg blue'), ('Kastel', r'kastel'), ('SanSoleil', r'sansoleil'),
    ('Johnnie-O', r'johnnie'), ('RLX', r'\brlx\b'), ('Linksoul', r'linksoul'), ('Garb', r'\bgarb\b'), ('Adidas', r'adidas'),
    ('PUMA', r'puma'), ('Nike', r'nike'), ('G/FORE', r'g/?fore|gallivan'), ('FootJoy', r'\bfj\b|foot\s*joy|footjoy'),
    ('Asics', r'asics'), ('d. hudson', r'd\. ?hudson'), ('Argali', r'argali'), ('Richardson', r'richardson'),
    ('Titleist', r'titleist|\btit\.?\b|titl\.|pro-?v1|scotty|vokey|\bsm1[01]\b'),
    ('TaylorMade', r'taylor\s*made|taylormade|\btm\b|tp5|talormade'), ('Callaway', r'callaway|\bcal\b|odys'), ('PING', r'\bping\b'),
    ('XXIO', r'xxio'), ('Vessel', r'vessel'), ('Sun Mountain', r'sun m'), ('Winston / Vanto / Seamus', r'winston|vanto|seamus'),
    ('PRG', r'\bprg\b'), ('Smathers & Branson', r'smathers'), ('NexBelt', r'nexbelt'), ('Bushnell', r'bushnell'),
    ('Oakley', r'oakley'), ('Maui Jim', r'maui jim'), ('YETI', r'yeti'), ('Tervis', r'tervis'), ('Sterling', r'sterling'),
    ('STRACKA', r'stracka'), ('Wallaroo', r'wallaroo'), ('Ahead', r'\bahead\b'), ('Sloop', r'sloop'), ('Vimhue', r'vimhue'),
    ('Donald Ross', r'donald ross'), ('Bobby Jones', r'bobby jones'), ('J. Lindeberg', r'lindeberg'),
    ('Greg Norman', r'greg norman'), ('Kradul', r'kradul'),
]
_RX = [(b, re.compile(rx)) for b, rx in ALIAS]
HAT = re.compile(r'^(hat|hats|visor|beanie|bucket)|\bhat\b|\bbeanie\b|\bvisor\b|bucket', re.I)

SEGMENTS = {'mens': "Men's apparel", 'ladies': "Ladies' apparel", 'hats': 'Hats', 'accessories': 'Accessories',
            'equipment': 'Equipment & shoes'}
_SEG = {'400': 'mens', '430': 'mens', '470': 'mens', '480': 'mens', '490': 'mens', '500': 'ladies', '620': 'accessories',
        '660': 'accessories', '160': 'equipment', '200': 'equipment', '220': 'equipment', '300': 'equipment', '320': 'equipment',
        '350': 'equipment'}


def brand_of(desc):
    d = (desc or '').lower()
    for b, rx in _RX:
        if rx.search(d):
            return b
    return None


def is_hat(desc):
    return bool(HAT.search(desc or ''))


def segment_of(cat, desc):
    if cat == '440':
        return 'hats' if is_hat(desc) else 'accessories'
    return _SEG.get(cat, 'other')
