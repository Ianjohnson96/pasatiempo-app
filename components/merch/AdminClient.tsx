"use client";

import { useState } from "react";
import type { MerchMember } from "@/lib/merch/auth";
import type { MerchRole } from "@/lib/merch/rules";

const ROLE_HELP: Record<MerchRole, string> = {
  owner: "Everything, including the forecast, budgets, brand calls and this page",
  staff: "Orders, receipts, vendors, counts, the to-do list and the checklist",
  viewer: "Can look at everything, can't change anything",
};

interface Bundle {
  kind: string;
  note?: string;
  docs: Record<string, unknown>;
}

export default function AdminClient({ base, me, initial }: { base: string; me: string; initial: MerchMember[] }) {
  const [members, setMembers] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" as MerchRole, password: "" });
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(body: Partial<MerchMember> & { password?: string }, done: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch(base + "/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || "That didn't save." }), false;
    setMembers(j.members);
    setMsg({ ok: true, text: done });
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await save({ ...form, active: true }, `${form.name || form.email} can now sign in. Give them the web address, their email and the password you set.`);
    if (ok) setForm({ name: "", email: "", role: "staff", password: "" });
  }

  async function pick(file: File | undefined) {
    setDataMsg(null);
    setBundle(null);
    if (!file) return;
    try {
      const b = JSON.parse(await file.text()) as Bundle;
      if (b.kind !== "pasatiempo-merch-bundle" || !b.docs) throw new Error();
      setBundle(b);
    } catch {
      setDataMsg({ ok: false, text: "That file isn't a Merchandise Program data file." });
    }
  }

  async function load() {
    if (!bundle) return;
    setBusy(true);
    const r = await fetch(base + "/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bundle) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setDataMsg({ ok: false, text: j.error || "That didn't load." });
    setBundle(null);
    setDataMsg({ ok: true, text: `Loaded ${j.loaded} documents. Open the program to see the update.` });
  }

  const groups = bundle
    ? Object.entries(
        Object.keys(bundle.docs).reduce<Record<string, number>>((a, p) => ((a[p.split("/")[0]] = (a[p.split("/")[0]] || 0) + 1), a), {}),
      )
    : [];

  return (
    <main className="m-wrap">
      <div className="m-top">
        <div>
          <p className="m-kicker">Merchandise Program</p>
          <h1>People &amp; data</h1>
        </div>
        <a className="m-btn" href={base || "/"}>← Back to the program</a>
      </div>

      <section className="m-card">
        <h2>Who can open the program</h2>
        <p className="m-note" style={{ marginTop: 0 }}>
          Each person signs in with their own email and a password you set here. They can change it later from the program&apos;s More menu. No other account is needed.
        </p>
        {msg && <p className={msg.ok ? "m-ok" : "m-error"}>{msg.text}</p>}
        <div className="m-scroll">
          <table className="m-table" style={{ minWidth: 640 }}>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Access</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.email}>
                  <td>{m.name || "—"}</td>
                  <td>{m.email}</td>
                  <td>
                    <select className="m-select" style={{ width: "auto", padding: "5px 8px" }} value={m.role} disabled={busy || m.email === me}
                      onChange={(e) => save({ ...m, role: e.target.value as MerchRole }, `${m.name || m.email} is now ${e.target.value}.`)}>
                      <option value="owner">Owner</option>
                      <option value="staff">Staff</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td>{m.active ? <span className="m-pill owner">Active</span> : <span className="m-pill">Removed</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {pwFor === m.email ? (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <input className="m-input" style={{ width: 150, padding: "5px 8px" }} type="text" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
                        <button className="m-btn sm primary" type="button" disabled={busy} onClick={async () => { if (await save({ ...m, password: pw }, `New password set for ${m.name || m.email}.`)) { setPwFor(null); setPw(""); } }}>Save</button>
                        <button className="m-btn sm" type="button" onClick={() => { setPwFor(null); setPw(""); }}>Cancel</button>
                      </span>
                    ) : (
                      <>
                        <button className="m-btn sm" type="button" onClick={() => setPwFor(m.email)}>Set password</button>{" "}
                        {m.email !== me && (
                          <button className="m-btn sm" type="button" disabled={busy}
                            onClick={() => save({ ...m, active: !m.active }, m.active ? `${m.name || m.email} can no longer open the program.` : `${m.name || m.email} is back in.`)}>
                            {m.active ? "Remove" : "Restore"}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={add} style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 15 }}>Add someone</h2>
          <div className="m-grid">
            <label className="m-field"><span>Name</span><input className="m-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="m-field"><span>Email</span><input className="m-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className="m-field"><span>Access</span>
              <select className="m-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MerchRole })}>
                <option value="staff">Staff</option><option value="viewer">Viewer</option><option value="owner">Owner</option>
              </select>
            </label>
            <label className="m-field"><span>Starting password</span><input className="m-input" type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ characters" /></label>
          </div>
          <p className="m-note" style={{ marginTop: -4 }}>{ROLE_HELP[form.role]}. Leave the password blank if they already sign in to the club app.</p>
          <button className="m-btn primary" type="submit" disabled={busy}>Add</button>
        </form>
      </section>

      <section className="m-card">
        <h2>Load month-end data</h2>
        <p className="m-note" style={{ marginTop: 0 }}>
          Load a Merchandise Program data file (.json): the forecast base, stock, suggestions and brand scorecard. It replaces those parts of the program. Orders, vendors, counts, budget changes and brand calls are never touched.
        </p>
        {dataMsg && <p className={dataMsg.ok ? "m-ok" : "m-error"}>{dataMsg.text}</p>}
        <input type="file" accept=".json,application/json" onChange={(e) => pick(e.target.files?.[0])} />
        {bundle && (
          <div style={{ marginTop: 14 }}>
            {bundle.note && <p style={{ margin: "0 0 6px" }}><b>{bundle.note}</b></p>}
            <p className="m-note" style={{ margin: "0 0 12px" }}>
              {Object.keys(bundle.docs).length} documents: {groups.map(([g, n]) => `${g} ${n}`).join(" · ")}
            </p>
            <button className="m-btn primary" type="button" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load it"}</button>
          </div>
        )}
      </section>
    </main>
  );
}
