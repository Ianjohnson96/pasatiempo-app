/* Runs the Merchandise Program page on the club app instead of claude.ai.
   Provides the same window.claude.use('db' | 'user' | 'downloads') surface the
   page was written against, backed by the club app's /api/db route (polled for
   changes) and the signed-in member from window.MERCH_HOST. */
(() => {
  const H = window.MERCH_HOST, API = H.base + '/api/db', POLL_MS = 15000;
  const store = new Map();                 // path -> {data, version}
  const docL = new Map(), colL = new Map(); // path -> Set(listener)
  let rev = 0, loaded = null;
  const parent = p => p.slice(0, p.lastIndexOf('/'));
  const err = (code, message) => Object.assign(new Error(message || code), {code});
  const docSnap = p => { const d = store.get(p); return {id: p.split('/').pop(), exists: !!d, data: () => d ? JSON.parse(JSON.stringify(d.data)) : undefined}; };
  const colSnap = c => ({docs: [...store.keys()].filter(k => parent(k) === c).map(k => ({id: k.split('/').pop(), data: () => JSON.parse(JSON.stringify(store.get(k).data))}))});
  function notify(paths){
    const cols = new Set();
    for (const p of paths){ (docL.get(p) || []).forEach(f => f.next(docSnap(p))); cols.add(parent(p)); }
    for (const c of cols) (colL.get(c) || []).forEach(f => f.next(colSnap(c)));
  }
  function apply(docs){
    const changed = [];
    for (const d of docs){ if (d.data == null) store.delete(d.path); else store.set(d.path, {data: d.data, version: d.version}); changed.push(d.path); }
    if (changed.length) notify(changed);
  }
  async function pull(){
    const r = await fetch(API + '?since=' + rev, {credentials: 'same-origin', cache: 'no-store'});
    if (r.status === 401) throw err('revoked', 'Signed out');
    if (!r.ok) throw err('unavailable');
    const j = await r.json(); rev = Math.max(rev, j.rev || 0); apply(j.docs || []);
  }
  function start(){
    if (!loaded) loaded = pull().then(() => {
      setInterval(() => pull().catch(e => { if (e.code === 'revoked') location.reload(); }), POLL_MS);
    }, e => { loaded = null; throw e; });
    return loaded;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && loaded) pull().catch(() => {}); });
  async function write(path, data){
    let r;
    try { r = await fetch(API, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({path, data})}); }
    catch (_){ throw err('unavailable'); }
    if (r.status === 401) throw err('revoked');
    if (r.status === 403 || r.status === 400 || r.status === 413) throw err('invalid_argument');
    if (!r.ok) throw err('unavailable');
    const j = await r.json();
    if (data == null) store.delete(path); else store.set(path, {data: JSON.parse(JSON.stringify(data)), version: j.version});
    notify([path]);
  }
  const listen = (map, key, next, error, snap) => {
    const f = {next}; (map.get(key) || map.set(key, new Set()).get(key)).add(f);
    start().then(() => next(snap(key))).catch(e => error && error(e));
    return () => map.get(key).delete(f);
  };
  const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const docRef = p => ({id: p.split('/').pop(), path: p, set: d => write(p, d), delete: () => write(p, null),
    onSnapshot: (next, error) => listen(docL, p, next, error, docSnap)});
  const db = Object.freeze({doc: docRef, collection: c => ({path: c, doc: id => docRef(c + '/' + (id || uid())),
    onSnapshot: (next, error) => listen(colL, c, next, error, colSnap)})});

  const me = H.me, names = H.members || {};
  const initials = s => (s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
  const color = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 38% 42%)`; };
  const avatar = (id, name) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="${color(id)}"/><text x="16" y="21" font-family="sans-serif" font-size="13" fill="#fff" text-anchor="middle">${initials(name || id)}</text></svg>`);
  const profile = id => ({id, name: names[id] || '', avatarUrl: avatar(id, names[id]), color: color(id), email: id, isMe: id === me.email, guest: false});
  const user = Object.freeze({
    isOwner: async () => me.role === 'owner', canEdit: async () => me.role === 'owner',
    can: async n => n === 'data.write' ? me.role !== 'viewer' : (n === 'files.write' || n === 'assets.write') ? me.role === 'owner' : false,
    id: async () => me.email, name: async () => me.name, email: async () => me.email, avatarUrl: async () => avatar(me.email, me.name),
    me: async () => ({id: me.email, name: me.name, avatarUrl: avatar(me.email, me.name), color: color(me.email), email: me.email, isOwner: me.role === 'owner', canEdit: me.role === 'owner'}),
    profiles: async ids => Object.fromEntries([...new Set([].concat(ids))].map(i => [i, profile(i)])),
    search: async q => Object.keys(names).filter(e => (e + ' ' + names[e]).toLowerCase().includes(String(q).toLowerCase())).slice(0, 8).map(profile)
  });
  const downloads = Object.freeze({save: async ({filename, data}) => {
    const blob = data instanceof Blob ? data : new Blob([data]), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); return {status: 'saved'};
  }});
  const caps = {db, user, downloads};
  window.claude = Object.freeze({use: async n => caps[n] || null});
})();
