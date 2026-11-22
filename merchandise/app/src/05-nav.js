/* ---------- navigation model: sidebar groups, page ids, old-id aliases (pure; no page globals) ---------- */
/* Sidebar by the shop's phases: Buy, Sell & stock, Month-end, with Home above them and Settings at the foot. A sidebar
   page can hold several views (its old pages, which keep their ids, so every saved link and bookmark still opens). */
const NAV = [
  {key: 'buy', label: 'Buy', pages: [['budget', 'Budget'], ['orders', 'Orders & receiving'], ['seasons', 'Season plan']]},
  {key: 'sell', label: 'Sell & stock', pages: [['scorecard', 'Scorecard'], ['trends', 'Trends & rounds'], ['brands', 'Brands'], ['stuck', 'Markdowns']]},
  {key: 'close', label: 'Month-end', pages: [['monthend', 'Upload & count']]}
];
const HOME_PAGE = ['home', 'Home'];
// Pages linked from the foot of the sidebar rather than a group.
const FOOT_PAGES = [['settings', 'Settings']];
// The views inside a sidebar page: [page id, label]. The first is where the sidebar entry opens.
const VIEWS = {
  orders: [['orders', 'Orders'], ['receiving', 'Receiving'], ['vendors', 'Vendors']],
  monthend: [['monthend', 'Upload & close'], ['inventory', 'Stock & counts']],
  settings: [['guidelines', 'Guidelines'], ['forecast', 'Forecast']]
};
// A sidebar entry whose page id differs from the page it opens.
const SIDE_OPENS = {home: 'today', budget: 'overview', settings: 'guidelines'};
// Pages that belong to a sidebar entry without being one of its views.
const PAGE_PARENT = {today: 'home', attention: 'home', overview: 'budget'};
// Old page ids (saved in a browser, linked from an email, or used by an older button) and where they live now.
const TAB_ALIAS = {summary: 'today', otb: 'overview', subcats: 'scorecard', rounds: 'trends', reports: 'monthend', help: 'monthend', ...SIDE_OPENS};
const VIEW_LABEL = Object.fromEntries(Object.values(VIEWS).flat());
const NAV_IDS = NAV.flatMap(g => g.pages.map(p => p[0])).concat(Object.values(VIEWS).flat().map(v => v[0]), Object.keys(PAGE_PARENT));
function resolveTab(id){
  id = String(id == null ? '' : id);
  if (Object.prototype.hasOwnProperty.call(TAB_ALIAS, id)) return TAB_ALIAS[id];
  return NAV_IDS.indexOf(id) >= 0 ? id : 'today';
}
/** The sidebar entry a page id belongs to: itself for a sidebar page, else the page holding it as a view. */
function navParent(id){
  if (PAGE_PARENT[id]) return PAGE_PARENT[id];
  for (const [p, vs] of Object.entries(VIEWS)) if (vs.some(v => v[0] === id)) return p;
  return id;
}
function pageLabel(id){
  if (id === 'today' || id === 'home') return HOME_PAGE[1];
  if (id === 'attention') return 'To do';
  if (VIEW_LABEL[id] && !NAV.some(g => g.pages.some(p => p[0] === id))) return VIEW_LABEL[id];
  for (const g of NAV) for (const p of g.pages) if (p[0] === id || SIDE_OPENS[p[0]] === id) return p[1];
  for (const p of FOOT_PAGES) if (p[0] === id) return p[1];
  return VIEW_LABEL[id] || '';
}
function pageGroup(id){
  const p = navParent(id);
  for (const g of NAV) if (g.pages.some(x => x[0] === p)) return g.key;
  return FOOT_PAGES.some(x => x[0] === p) ? 'foot' : '';
}
// data-go="tab" or "tab:key"
function parseGo(s){ s = String(s == null ? '' : s); const i = s.indexOf(':'); return i < 0 ? {tab: s, key: null} : {tab: s.slice(0, i), key: s.slice(i + 1)}; }
