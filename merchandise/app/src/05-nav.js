/* ---------- navigation model: sidebar groups, page ids, old-id aliases (pure; no page globals) ---------- */
const NAV = [
  {key: 'daily', label: 'Every day', pages: [['today', 'Today'], ['orders', 'Orders'], ['receiving', 'Receiving'], ['attention', 'To do'], ['vendors', 'Vendors']]},
  {key: 'plan', label: 'Plan & buy', pages: [['overview', 'Budget & open-to-buy'], ['seasons', 'Season buys'], ['forecast', 'Forecast']]},
  {key: 'analyse', label: 'Analyze', pages: [['scorecard', 'Scorecard'], ['brands', 'Brands'], ['stuck', 'Stuck money & markdowns'], ['trends', 'Trends & rounds']]},
  {key: 'close', label: 'Month-end', pages: [['monthend', 'Upload & close'], ['inventory', 'Stock & counts']]}
];
// Old page ids (saved in a browser, linked from an email, or used by an older button) and where they live now.
const TAB_ALIAS = {summary: 'today', otb: 'overview', subcats: 'scorecard', rounds: 'trends', reports: 'monthend', help: 'monthend'};
// Pages linked from the foot of the sidebar rather than a group.
const FOOT_PAGES = [['guidelines', 'Guidelines']];
const NAV_IDS = NAV.flatMap(g => g.pages.map(p => p[0])).concat(FOOT_PAGES.map(p => p[0]));
function resolveTab(id){
  id = String(id == null ? '' : id);
  if (Object.prototype.hasOwnProperty.call(TAB_ALIAS, id)) return TAB_ALIAS[id];
  return NAV_IDS.indexOf(id) >= 0 ? id : 'today';
}
function pageLabel(id){ for (const g of NAV) for (const p of g.pages) if (p[0] === id) return p[1]; for (const p of FOOT_PAGES) if (p[0] === id) return p[1]; return ''; }
function pageGroup(id){ for (const g of NAV) for (const p of g.pages) if (p[0] === id) return g.key; return FOOT_PAGES.some(p => p[0] === id) ? 'foot' : ''; }
// data-go="tab" or "tab:key"
function parseGo(s){ s = String(s == null ? '' : s); const i = s.indexOf(':'); return i < 0 ? {tab: s, key: null} : {tab: s.slice(0, i), key: s.slice(i + 1)}; }
