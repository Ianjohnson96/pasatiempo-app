"""Turn POS report PDFs into text.

The Pro Shop POS prints most reports portrait (pdfplumber reads them cleanly) but the
SKU Analysis and Rounds Summary are printed rotated; pdfplumber returns reversed
fragments for those, so we fall back to pypdf, which honours the text matrix.
"""
import pdfplumber
from pypdf import PdfReader

MARKERS = ('Pasatiempo', 'Net Sales', 'Daily Sales')


def pdf_text(path):
    with pdfplumber.open(path) as pdf:
        text = '\n'.join((p.extract_text() or '') for p in pdf.pages)
    if any(m in text[:500] for m in MARKERS):
        return text
    return '\n'.join(p.extract_text() or '' for p in PdfReader(path).pages)


def detect_kind(text):
    head = text[:1500]
    if 'SKU Analysis as of' in head:
        return 'sku_analysis'
    if 'BEST' in head and 'Quantity Sold' in head:
        return 'best100'
    if 'Net Sales by Category' in head:
        return 'sales_by_category'
    if 'Net Sales by Item' in head:
        return 'sales_by_item'
    if 'Daily Sales Report' in head:
        return 'daily_sales'
    if 'Rounds Summary' in head:
        return 'rounds'
    return None
