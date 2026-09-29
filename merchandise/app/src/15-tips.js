/* ---------- what the headings mean ----------
   Column headings and figure labels that need explaining get a small (i). Hover it, focus it or tap it and the
   explanation floats next to it. Headings are matched by their text wherever they appear, so a new table
   picks the explanation up without touching its markup. */
const TIPS = [
  [/^gmroi$/, 'GMROI', 'Gross margin earned in the last 12 months for every $1 of stock at cost. Above 2 is strong for apparel; under 1 means the stock isn\'t paying its way. Equipment runs lower because margins are thin.'],
  [/^aged$|^not sold 12\+ mo(nths)?$/, 'Aged', 'Stock on hand (at cost) that hasn\'t sold in 12 months, as a share of the stock or in dollars. Over 10% is more than a pro shop should carry; the analysis pages shade it red above 15%.'],
  [/^weeks( of supply)?$/, 'Weeks of supply', 'How many weeks the stock on hand lasts at the last 12 months\' selling pace. Twelve to sixteen is healthy for most categories; over 30 is too much stock.'],
  [/^trend$/, 'Trend', 'Units sold in the last 3 months against the same 3 months a year earlier.'],
  [/^24 months$/, '24 months', 'Sales for each of the last 24 months, oldest on the left.'],
  [/^call$/, 'Call', 'What to do with the brand next season: Grow, Keep, Watch, Reduce or Drop. Suggested from its sales, GMROI, stock and trend; the owner can set their own (✎).'],
  [/^margin$/, 'Margin', 'Gross margin: the share of each sales dollar left after the cost of the goods. (Sales − cost) ÷ sales.'],
  [/^gross margin \$$/, 'Gross margin $', 'Sales minus the cost of the goods sold, in dollars.'],
  [/^(sales, 12 mo|sales 12 mo|12-mo sales)$/, 'Sales, 12 months', 'Retail sales over the last 12 months, before tax.'],
  [/^on hand$/, 'On hand', 'Stock on the shelf, at cost, from the latest SKU Analysis.'],
  [/^at cost$/, 'At cost', 'What you pay the vendor, not the retail price. Every budget and stock figure here is at cost.'],
  [/^on order( fy\d+)?$/, 'On order', 'Orders written but not yet received, at cost.'],
  [/^bought (fy\d+|next yr)$/, 'Bought for next year', 'Orders already written that arrive in next year\'s budget.'],
  [/^committed( by then)?$/, 'Committed', 'Orders arriving in the period, plus anything already received.'],
  [/^(room|room by month-end|room through .+)$/, 'Room', 'How much the plan lets you receive from the start of the year to the end of this month.'],
  [/^left( to buy)?$/, 'Left to buy', 'Room minus committed. Negative means more is due in than the plan allows by then.'],
  [/^plan for month$/, 'Plan for month', 'Open-to-buy for that month alone: target end-of-month stock − opening stock + the month\'s cost of sales.'],
  [/^still to come$/, 'Still to come', 'The part of the order that hasn\'t arrived yet, at cost.'],
  [/^cancel by$/, 'Cancel by', 'The date you can cancel the order without penalty. Orders past it are flagged.'],
  [/^delivery$/, 'Delivery', 'The month the order is expected. It counts against that month\'s budget.'],
  [/^lead$/, 'Lead time', 'Weeks from placing an order with this vendor to it arriving.'],
  [/^book( \(\$\))?$/, 'Book', 'What the system says is on hand, at cost, when the count was taken.'],
  [/^counted( \(\$\))?$/, 'Counted', 'What the physical count found, at cost.'],
  [/^difference$/, 'Difference', 'Counted minus book. Negative is stock the count couldn\'t find.'],
  [/^shrink$/, 'Shrink', 'Stock the system says you have but the count doesn\'t find (theft, damage, mis-rings), as a share of book.'],
  [/^vs ly$/, 'vs LY', 'This year\'s forecast against last year\'s actual sales.'],
  [/^extra growth$/, 'Extra growth', 'Added to the monthly growth for this category\'s open months, for a category you expect to beat or trail the shop.'],
  [/^target weeks$/, 'Target weeks', 'Weeks of supply to hold at each month-end. Sets the target stock the budget buys toward.'],
  [/^target by apr 30$/, 'Target by Apr 30', 'The stock the plan aims to hold at the end of the fiscal year, at cost.'],
  [/^extra stock carried in$/, 'Carried in', 'Stock above plan that next year starts with, because this year\'s orders ran past this year\'s budget.'],
  [/^fy\d+ growth$/, 'Next-year growth', 'How much next year\'s sales grow on this year\'s, for the category.'],
  [/^shop \$ per round/, 'Shop $ per round', 'Pro shop sales divided by rounds played that month.'],
  [/^read$/, 'Read', 'A plain-English reading of the figures in the row.'],
  [/^fy\d+ budget$/, 'Budget', 'What the plan lets you receive over the whole fiscal year, at cost.'],
  [/^to do$/, 'To do', 'Order problems and item suggestions still open: reorders, stock-outs, aged stock, data errors.']
];
const tipFor = text => { const k = text.replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); return k ? TIPS.find(t => t[0].test(k)) : null; };

function decorateTips(root){
  for (const el of root.querySelectorAll('th, .drawer .lab')){
    if (el.dataset.tipped) continue;
    el.dataset.tipped = '1';
    const tip = tipFor(el.textContent); if (!tip) continue;
    const i = document.createElement('button');
    i.type = 'button'; i.className = 'tipi'; i.textContent = 'i';
    i.dataset.tip = String(TIPS.indexOf(tip)); i.setAttribute('aria-label', 'What ' + tip[1] + ' means');
    const sortBtn = el.querySelector('button.sorth, button[data-sort]');
    if (el.matches('th')) el.classList.add('withtip');
    if (sortBtn) sortBtn.after(i);   // beside the sort button, never inside it
    else (el.querySelector('.h') || el).appendChild(i);
  }
}

const tipBox = (() => { const d = document.createElement('div'); d.id = 'tip'; d.setAttribute('role', 'tooltip'); d.hidden = true; document.body.appendChild(d); return d; })();
let tipOn = null;
function showTip(btn){
  // A heading's (i) carries an index into TIPS; a chart mark carries its own title and readout (16-charts.js).
  const t = btn.dataset.cv != null ? [null, btn.dataset.cvt || '', btn.dataset.cv] : TIPS[+btn.dataset.tip]; if (!t) return;
  if (tipOn && tipOn !== btn) tipOn.setAttribute('aria-expanded', 'false');
  tipOn = btn; btn.setAttribute('aria-expanded', 'true');
  const b = document.createElement('b'); b.textContent = t[1];
  tipBox.replaceChildren(...(t[1] ? [b] : []), ...String(t[2]).split(' · ').flatMap((x, i) => i ? [document.createElement('br'), document.createTextNode(x)] : [document.createTextNode(x)]));
  tipBox.hidden = false;
  const r = btn.getBoundingClientRect(), w = tipBox.offsetWidth, h = tipBox.offsetHeight, cx = r.left + r.width / 2;
  const left = Math.max(12, Math.min(innerWidth - w - 12, cx - w / 2)), below = r.bottom + h + 14 < innerHeight;
  tipBox.style.left = left + 'px'; tipBox.style.top = (below ? r.bottom + 9 : r.top - h - 9) + 'px';
  tipBox.dataset.side = below ? 'below' : 'above'; tipBox.style.setProperty('--ax', (cx - left) + 'px');
}
function hideTip(){ if (tipBox.hidden) return; tipBox.hidden = true; if (tipOn) tipOn.setAttribute('aria-expanded', 'false'); tipOn = null; }

const tipHost = t => t.closest && t.closest('.tipi, [data-cv]');
document.addEventListener('mouseover', e => { const b = tipHost(e.target); if (b) showTip(b); else if (tipOn && document.activeElement !== tipOn) hideTip(); });
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('.tipi, [data-cv][tabindex]')) showTip(e.target); else hideTip(); });
// A tap shows it (and never sorts the column the (i) sits in); a tap anywhere else puts it away.
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.tipi');
  if (b){ e.preventDefault(); e.stopImmediatePropagation(); showTip(b); return; }
  const c = e.target.closest && e.target.closest('[data-cv]');   // a chart mark: show its readout, and let its own click run
  if (c) showTip(c); else hideTip(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
addEventListener('scroll', hideTip, {passive: true, capture: true});
addEventListener('resize', hideTip);
/* Tables on a phone: each row becomes a small card of label and value pairs (shell.html, table.rt), so nothing scrolls
   sideways. Every cell gets its column's heading as data-l. Tables you type into, and the size grids, keep their columns. */
function labelTables(root){
  for (const t of root.querySelectorAll('table:not([data-lab])')){
    t.dataset.lab = '1';
    if (t.querySelector('input, select, textarea') || t.closest('.sizegrid, .prev')) continue;
    const heads = [];
    for (const th of t.querySelectorAll('thead tr:last-child th')){
      const h = th.querySelector('button.sorth, button[data-sort], .h');
      const txt = [...(h || th).childNodes].filter(n => !(n.classList && n.classList.contains('tipi'))).map(n => n.textContent).join('').replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim();
      for (let k = 0; k < (th.colSpan || 1); k++) heads.push(txt);
    }
    if (!heads.length) continue;
    t.classList.add('rt');
    for (const tr of t.querySelectorAll('tbody tr')){
      let i = 0;
      for (const td of tr.children){ if (!td.dataset.l && heads[i] && (td.colSpan || 1) === 1) td.dataset.l = heads[i]; if ((td.colSpan || 1) > 1) td.classList.add('rt-wide'); i += td.colSpan || 1; }
    }
  }
}
new MutationObserver(() => { decorateTips(document.body); labelTables(document.body); }).observe(document.body, {childList: true, subtree: true});
decorateTips(document.body); labelTables(document.body);
