const FALLBACK = __FALLBACK__;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = +v; return isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const money = n => (n < -0.5 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const moneyK = n => { const a = Math.abs(n); const s = a >= 1e6 ? (a/1e6).toFixed(2)+'M' : a >= 1e4 ? Math.round(a/1e3)+'k' : a >= 1e3 ? (a/1e3).toFixed(1)+'k' : Math.round(a)+''; return (n < 0 ? '−$' : '$') + s; };
const money2 = n => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const int = n => Math.round(n).toLocaleString('en-US');
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MFULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad = n => String(n).padStart(2,'0');
const todayISO = (() => { const d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); })();
const THIS_MONTH = todayISO.slice(0,7);
const monthLabel = m => m ? MN[+m.slice(5,7)-1] + ' ' + m.slice(0,4) : '—';
const monthFull = m => MFULL[+m.slice(5,7)-1];
const monthShort = m => MN[+m.slice(5,7)-1];
const dateLabel = d => d ? MN[+d.slice(5,7)-1] + ' ' + (+d.slice(8,10)) + ', ' + d.slice(0,4) : '—';
const daysBetween = (a,b) => Math.round((Date.parse(b+'T00:00:00') - Date.parse(a+'T00:00:00')) / 864e5);
const addMonths = (m, k) => { let y = +m.slice(0,4), mo = +m.slice(5,7) - 1 + k; y += Math.floor(mo/12); mo = ((mo%12)+12)%12; return y + '-' + pad(mo+1); };
const MONTH_OPTS = (() => { const o = []; for (let m = '2026-06'; m <= '2028-06'; m = addMonths(m,1)) o.push(m); return o; })();
const uid = () => Math.random().toString(36).slice(2,10);
const STATUS = {open:'Open', partial:'Partly received', received:'Received', cancelled:'Cancelled'};
const CALLTXT = {buy:'Buy', replenish:'Replenish', stop:'Stop', excluded:'Not in OTB'};
const CALLHELP = {buy:'Growing and productive — buy within budget.', replenish:'Reorder proven sellers only; no new lines.', stop:'Already overbought — order only against a customer commitment.', excluded:'Customer-ordered; tracked but not budgeted.'};
const BCALL = {grow:'Grow', keep:'Keep', watch:'Watch', reduce:'Reduce', drop:'Drop', inactive:'Not stocked', special:'Special orders'};
const BCALLHELP = {grow:'Earning well and turning — give it more of the budget.', keep:'Doing its job — buy at the current level.', watch:'New or changing fast — judge after another season.', reduce:'Carry less: buy tighter and deeper on the winners only.', drop:'Stop buying; sell through what is left.', inactive:'Not in stock now.', special:'Bought when a member or a group orders; nothing to stock or budget.'};
const SEGS = {mens:"Men's apparel", ladies:"Ladies' apparel", hats:'Hats', accessories:'Accessories', equipment:'Equipment & shoes'};
const RISK_VENDORS = /winston|vanto|seamus|\bprg\b/i;
const RUNS = {
  none:{label:'No sizes — quantity only'},
  mens:{label:"Men's apparel", cols:['XS','S','M','L','XL','XXL','3XL']},
  womens:{label:"Women's apparel", cols:['XS','S','M','L','XL','XXL']},
  womens_num:{label:"Women's numeric", cols:['0','2','4','6','8','10','12','14','16']},
  youth:{label:'Youth / junior', cols:['YXS','YS','YM','YL','YXL']},
  waist:{label:"Men's waist", cols:['30','32','33','34','35','36','38','40','42','44']},
  hats:{label:'Headwear', cols:['OSFA','S/M','M/L','L/XL']},
  belts:{label:'Belts', cols:['30','32','34','36','38','40','42','44','OSFA']},
  socks:{label:'Socks', cols:['S','M','L','XL']},
  mens_shoe:{label:"Men's shoes", cols:['7','7.5','8','8.5','9','9.5','10','10.5','11','11.5','12','13','14'], rows:['Medium','Wide']},
  womens_shoe:{label:"Women's shoes", cols:['5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','11'], rows:['Medium','Wide']},
  youth_shoe:{label:'Junior shoes', cols:['1','2','3','4','5','6']},
  mens_glove:{label:"Men's gloves", cols:['S','M','ML','L','XL','XXL','CM','CML','CL'], rows:['Left hand','Right hand'], note:'Left hand = worn on the left hand, for right-handed golfers. C sizes are cadet.'},
  womens_glove:{label:"Women's gloves", cols:['S','M','ML','L','XL'], rows:['Left hand','Right hand'], note:'Left hand = worn on the left hand, for right-handed golfers.'},
  glove_pair:{label:'Glove pairs', cols:['S','M','ML','L','XL','XXL']},
  custom:{label:'Custom sizes'}
};
const KINDS = {order:'Orders', reorder:'Reorder', stockout:'Out of stock', overstock:'Overstocked', aged:'Not selling', margin:'Margin', split:'Combined SKU', data:'Data issue'};
const KIND_SEV = {order:'crit', reorder:'good', stockout:'good', overstock:'warn', aged:'warn', margin:'crit', split:'info', data:'crit'};

/* ---------- live state ---------- */
let PLAN = FALLBACK.plan, INV = FALLBACK.inventory, INS = FALLBACK.insights;
let ADJ = [], POS = [], VENDORS = [], SUBCATS = [], COUNTS = [], ISTATE = {};
let db = null, userNS = null, canWrite = null, isAdmin = false, myId = null, dbState = 'connecting', readOnly = false;
let SEL = (() => { try { return localStorage.getItem('ob.month') || null; } catch (_) { return null; } })();
let TAB = (() => { try { return localStorage.getItem('ob.tab2') || localStorage.getItem('ob.tab') || 'summary'; } catch (_) { return 'summary'; } })();
let filt = {status:'active', cat:'all', q:'', arriving:false}, sort = {key:'deliveryMonth', dir:1};
let afilt = {kind:'all', showResolved:false, cat:'all'};

const WIN = () => PLAN.months.map(x => x.m);
const LAST = () => PLAN.window.to;
const catList = () => PLAN.order.map(code => ({code, ...PLAN.cats[code]}));
const CAT = code => PLAN.cats[code] || {name: code, call: 'buy'};
const inOTB = code => code !== '640' && PLAN.cats[code] && PLAN.cats[code].plan != null;
function selMonth(){ const w = WIN(); if (SEL === 'season') return 'season'; if (SEL && w.includes(SEL)) return SEL; return w.includes(THIS_MONTH) ? THIS_MONTH : 'season'; }
const through = () => { const s = selMonth(); return s === 'season' ? LAST() : s; };

/* ---------- order arithmetic ---------- */
function lineUnits(l){ if (!l.run || l.run === 'none') return num(l.units); return Object.values(l.qty || {}).reduce((a,b) => a + num(b), 0); }
const lineExt = l => r2(lineUnits(l) * num(l.cost));
function poTotal(p){ return (p.lines && p.lines.length) ? r2(p.lines.reduce((a,l) => a + lineExt(l), 0)) : num(p.cost); }
function poUnits(p){ return (p.lines && p.lines.length) ? p.lines.reduce((a,l) => a + lineUnits(l), 0) : num(p.units); }
function committed(p){ const cost = poTotal(p), rec = num(p.received);
  if (p.status === 'cancelled') return rec; if (p.status === 'received') return rec || cost; return Math.max(cost, rec); }
function onOrder(p){ return (p.status === 'open' || p.status === 'partial') ? Math.max(poTotal(p) - num(p.received), 0) : 0; }
/* Deliveries on an order: receipts [{date, amount, byCat?, source}]. Orders from before deliveries were kept
   one by one have a single delivery of `received` on `receivedDate`. */
function poReceipts(p){
  if (Array.isArray(p.receipts) && p.receipts.length) return p.receipts;
  return num(p.received) > 0 ? [{date: p.receivedDate || p.orderDate || todayISO, amount: num(p.received), source: 'manual'}] : [];
}
function inWindow(m, P){ const w = P.months.map(x => x.m); return m < w[0] ? 'before' : m > w[w.length - 1] ? 'later' : m; }
/* Where the still-to-come part of an order counts: its expected month, or this month once it's late. */
function bucket(p, P = PLAN){
  let m = p.deliveryMonth;
  if (!m) return null;
  if ((p.status === 'open' || p.status === 'partial') && m < THIS_MONTH) m = THIS_MONTH;
  return inWindow(m, P);
}
function poParts(p){
  return (p.lines && p.lines.length) ? p.lines.map(l => ({cat: l.cat || p.cat, sub: l.sub || '', ext: lineExt(l), units: lineUnits(l)}))
                                     : [{cat: p.cat, sub: '', ext: poTotal(p), units: num(p.units)}];
}
/* Delivered so far by category: a delivery matched from the SKU Analysis says which categories it was;
   one recorded by hand is spread over the order's lines. */
function receivedByCat(p){
  const parts = poParts(p), tot = parts.reduce((a, x) => a + x.ext, 0), out = {};
  for (const r of poReceipts(p)){
    if (r.byCat) for (const [c, v] of Object.entries(r.byCat)) out[c] = (out[c] || 0) + num(v);
    else for (const x of parts) out[x.cat] = (out[x.cat] || 0) + num(r.amount) * (tot > 0 ? x.ext / tot : 1 / parts.length);
  }
  return out;
}
/* What an order commits, month by month. Each delivery counts in the month it arrived, and not at all once
   it's in the on-hand stock (on or before the SKU Analysis); what's still to come counts in the expected month. */
function ledger(list, P = PLAN){
  const out = [];
  for (const p of list){
    const parts = poParts(p), tot = parts.reduce((a, x) => a + x.ext, 0), recs = poReceipts(p);
    const catExt = {}; for (const x of parts) catExt[x.cat] = (catExt[x.cat] || 0) + x.ext;
    const push = (x, b, amount, open) => out.push({po: p.id, cat: x.cat, sub: x.sub, b, committed: amount, open,
      units: x.ext > 0 ? x.units * amount / x.ext : (amount ? x.units : 0), status: p.status});
    for (const r of recs){
      const b = r.date < P.start ? 'before' : inWindow(r.date.slice(0, 7), P);
      if (r.byCat){
        for (const [c, v] of Object.entries(r.byCat)){
          const xs = parts.filter(x => x.cat === c);
          if (!xs.length) push({cat: c, sub: '', ext: 0, units: 0}, b, num(v), 0);
          for (const x of xs) push(x, b, num(v) * (catExt[c] > 0 ? x.ext / catExt[c] : 1 / xs.length), 0);
        }
      } else for (const x of parts) push(x, b, num(r.amount) * (tot > 0 ? x.ext / tot : 1 / parts.length), 0);
    }
    if (p.status !== 'open' && p.status !== 'partial') continue;
    const rc = receivedByCat(p), b = bucket(p, P);
    for (const x of parts){
      const got = catExt[x.cat] > 0 ? num(rc[x.cat]) * x.ext / catExt[x.cat] : 0, owed = Math.max(x.ext - got, 0);
      if (owed > 0.005 || !recs.length) push(x, b, owed, owed);
    }
  }
  return out;
}
function adjThrough(code, m){ return ADJ.filter(a => a.cat === code && (a.month || LAST()) <= m).reduce((s,a) => s + num(a.amount), 0); }
function adjTotal(code){ return ADJ.filter(a => a.cat === code).reduce((s,a) => s + num(a.amount), 0); }
function roomThrough(code, m){
  const c = PLAN.cats[code]; if (!c || c.plan == null) return null;
  let r = 0; for (const k of WIN()) if (k <= m) r += num(c.mplan ? c.mplan[k] : 0);
  return r + adjThrough(code, m);
}
const seasonBudget = code => { const c = PLAN.cats[code]; return c.plan == null ? null : c.plan + adjTotal(code); };
function firstRoomMonth(code, committedByMonth){
  for (const k of WIN()){ const r = roomThrough(code, k); const used = committedByMonth ? committedByMonth(k) : 0; if (r - used > 0) return k; }
  return null;
}
function stats(list){
  const L = ledger(list || POS), m = through(), w = WIN();
  const byCat = {}, byCatMonth = {}, bySub = {};
  let commit = 0, open = 0, later = 0, soOpen = 0, arriving = 0;
  for (const e of L){
    if (e.cat === '640'){ soOpen += e.open; continue; }
    if (e.b === 'later'){ later += e.committed; continue; }
    if (!e.b || e.b === 'before') continue;
    (byCatMonth[e.cat] = byCatMonth[e.cat] || {})[e.b] = ((byCatMonth[e.cat] || {})[e.b] || 0) + e.committed;
    if (e.b <= m){ byCat[e.cat] = (byCat[e.cat] || 0) + e.committed; commit += e.committed; }
    if (e.b === m) arriving += e.committed;
    open += e.open;
    const sk = e.cat + '|' + e.sub; const s = bySub[sk] = bySub[sk] || {units:0, dollars:0}; s.units += e.units; s.dollars += e.committed;
  }
  const cm = (code, k) => { let s = 0; const bm = byCatMonth[code] || {}; for (const x of w) if (x <= k) s += bm[x] || 0; return s; };
  let room = 0; for (const c of catList()) if (inOTB(c.code)) room += roomThrough(c.code, m);
  const receivedSince = POS.reduce((s, p) => s + poReceipts(p).filter(r => r.date > INV.asOf).reduce((a, r) => a + num(r.amount), 0), 0);
  return {L, m, byCat, byCatMonth, bySub, commit, open, later, soOpen, arriving, room, left: room - commit, cm, receivedSince};
}
