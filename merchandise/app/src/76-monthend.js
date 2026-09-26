
/* ---------- month-end page ---------- */
let REFRESHES = [], CHECKS = {};
const MONTH_END = [
  {k: 'sku', t: 'SKU Analysis', d: 'PRSHP – SKU Analysis as of the last day, all categories. Must be run on the last day: on-hand can\'t be recreated later.'},
  {k: 'daily', t: 'Daily Sales Report by Item', d: 'Run for the last day of the month. Gives month-to-date and fiscal-year-to-date sales by category.'},
  {k: 'cat', t: 'Sales by Category', d: 'Net Sales by Category – Pro Shop, fiscal year to date from May 1.'},
  {k: 'item', t: 'Sales by Item', d: 'Net Sales by Item – Pro Shop, fiscal year to date. Gives each SKU\'s average selling price.'},
  {k: 'best', t: 'Cost & margin report', d: 'PRSHP – BEST 100 based on Quantity Sold, fiscal year to date — past the top 100 if the system allows.'},
  {k: 'pos', t: 'Every purchase order is in the Order Book', d: 'Including phone and show orders. Mark anything received this month.'},
  {k: 'recv', t: 'Receipts entered in the POS', d: 'Every box that came in is received in the POS before the SKU Analysis runs.'},
  {k: 'send', t: 'Send the five reports to Claude', d: 'Upload them together and ask for the month-end refresh.'}
];
function nextRefreshMonth(){ return BASE ? (BASE.partial ? BASE.partial.m : addMonths(BASE.actualThrough, 1)) : THIS_MONTH; }
function renderMonthEnd(){
  if (!BASE){ $('#pane').innerHTML = `<section class="panel"><div class="note">Month-end status appears after the first refresh.</div></section>`; return; }
  const due = nextRefreshMonth(), dueEnd = due + '-' + pad(new Date(+due.slice(0,4), +due.slice(5,7), 0).getDate());
  const late = todayISO > dueEnd ? daysBetween(dueEnd, todayISO) : 0;
  const chk = CHECKS[due] || {items: {}}, done = MONTH_END.filter(x => chk.items && chk.items[x.k]).length;
  const hist = REFRESHES.slice().sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
  const fyNow = curFY(), closed = fyMonths(fyNow).filter(k => monthStatus(k) === 'actual');
  const fcFor = k => { const r = hist.filter(h => h.forecast && h.forecast[k] != null && h.asOf < k + '-01').sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)))[0]; return r ? r.forecast[k] : null; };
  const res = closed.map(k => ({k, act: monthTotal(k), ly: monthLY(k), fc: fcFor(k)}));
  $('#pane').innerHTML = `<div class="grid">
    <div class="stack">
      <section class="panel"><header><h2>Where the data stands</h2><span class="lab">Updated ${dateLabel(BASE.asOf)}</span></header>
        <div class="note" style="font-size:13.5px;color:var(--ink)">
          <p style="margin-top:0">Sales, stock and suggestions are as of <b>${dateLabel(BASE.asOf)}</b>. Closed months run through <b>${monthFull(BASE.actualThrough)} ${BASE.actualThrough.slice(0,4)}</b>${BASE.partial ? `; ${monthFull(BASE.partial.m)} had ${money(BASE.partial.actual)} of sales by day ${BASE.partial.day}` : ''}.</p>
          <p>${late ? `<b class="neg">The ${monthFull(due)} refresh is ${late} day${late === 1 ? '' : 's'} overdue.</b> Budgets are still using ${dateLabel(BASE.asOf)} stock, so anything received since then isn't reflected yet.` : `Next refresh: after <b>${monthFull(due)} ${due.slice(0,4)}</b> closes (${dateLabel(dueEnd)}).`}</p>
          <p style="margin-bottom:0">Orders, vendors, counts, budget changes and brand calls are live — they never wait for a refresh.</p></div></section>
      <section class="panel"><header><h2>${monthFull(due)} month-end checklist</h2><span class="lab">${done} of ${MONTH_END.length} done</span></header>
        <ul class="checks">${MONTH_END.map(x => { const on = !!(chk.items && chk.items[x.k]); return `<li><label><input type="checkbox" data-chk="${x.k}" data-chkm="${due}" ${on ? 'checked' : ''} ${canAct() ? '' : 'disabled'}><span><b>${x.t}</b><span class="d">${x.d}</span>${on && chk.by && chk.by[x.k] ? `<span class="who">✓ <span class="person" data-uid="${esc(chk.by[x.k])}"></span></span>` : ''}</span></label></li>`; }).join('')}</ul>
        <div class="note">Anyone who can log orders can tick these off; everyone sees the same list. Save each report as Excel or CSV if you can, PDF otherwise, with the date in the file name.</div></section>
    </div>
    <div class="stack">
      <section class="panel"><header><h2>What happens at a refresh</h2></header><div class="note" style="font-size:13.5px;color:var(--ink)">
        <ol style="margin:0;padding-left:18px">
          <li>Upload the five reports to Claude and ask for the <b>month-end refresh</b>.</li>
          <li>The month just closed becomes an actual. The forecast moves forward from there.</li>
          <li>On-hand stock resets to the new SKU Analysis. Every budget, this year's and next year's, is worked out again.</li>
          <li>The To do list and the brand scorecard are rebuilt from the new numbers. Anything you'd marked done or dismissed stays that way.</li>
          <li>A line is added to the history below, so you can see how the plan moved.</li></ol></div></section>
      <section class="panel"><header><h2>Month results</h2><span class="lab">${fyLabel(fyNow)} closed months</span></header>
        <table class="mini" style="margin:8px 16px 4px;width:calc(100% - 32px)"><thead><tr><th>Month</th><th class="r">Actual</th><th class="r">Last year</th><th class="r">vs LY</th><th class="r">Forecast</th><th class="r">vs forecast</th></tr></thead>
        <tbody>${res.map(r => `<tr><td>${monthLabel(r.k)}</td><td class="r num">${money(r.act)}</td><td class="r num">${money(r.ly)}</td><td class="r num">${pct(r.act / r.ly - 1)}</td><td class="r num">${r.fc == null ? '—' : money(r.fc)}</td><td class="r num ${r.fc != null && r.act < r.fc ? 'neg' : ''}">${r.fc == null ? '—' : pct(r.act / r.fc - 1)}</td></tr>`).join('')}</tbody></table>
        <div class="note">"Forecast" is what the plan expected for the month at the refresh before it. It fills in from the next refresh on.</div></section>
      <section class="panel"><header><h2>Refresh history</h2></header>
        ${hist.length ? `<table class="mini" style="margin:8px 16px 14px;width:calc(100% - 32px)"><thead><tr><th>Data as of</th><th class="r">Sales YTD</th><th class="r">On hand</th><th class="r">This year budget</th><th class="r">Next year budget</th></tr></thead><tbody>${hist.map(h => `<tr title="${esc((h.notes || []).join(' '))}"><td>${dateLabel(h.asOf)}</td><td class="r num">${moneyK(num(h.ytd))}</td><td class="r num">${moneyK(num(h.onHand))}</td><td class="r num">${moneyK(num(h.otbCur))}</td><td class="r num">${moneyK(num(h.otbNext))}</td></tr>${(h.notes || []).length ? `<tr><td colspan="5" style="font-size:12px;color:var(--muted);border-top:none;padding-top:0">${h.notes.map(esc).join(' · ')}</td></tr>` : ''}`).join('')}</tbody></table>` : '<div class="note">No refreshes recorded yet.</div>'}</section>
    </div></div>`;
  fillPeople();
}
async function toggleCheck(m, k, on){
  const cur = CHECKS[m] || {items: {}, by: {}};
  const body = {items: {...(cur.items || {}), [k]: on}, by: {...(cur.by || {}), [k]: on ? myId : null}, month: m};
  await write('checklist/' + m, body);
}
