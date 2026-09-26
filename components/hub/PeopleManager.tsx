"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APPS, type AppKey } from "@/lib/hub/apps";
import { addPerson, resetPassword, setAccess, setPersonFlags, type Result } from "@/lib/hub/actions";

export interface PersonRow {
  email: string;
  name: string;
  isSuper: boolean;
  active: boolean;
  grants: Record<string, string>;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function PeopleManager({ me, isSuper, apps, rows }: { me: string; isSuper: boolean; apps: AppKey[]; rows: PersonRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const blank = { name: "", email: "", password: "", grants: {} as Partial<Record<AppKey, string>> };
  const [form, setForm] = useState(blank);
  // Ticking an app starts at its everyday role (manager / staff); the top role is a deliberate choice.
  const startRole = (a: AppKey) => APPS[a].roles[1] ?? APPS[a].roles[0];
  const setGrant = (a: AppKey, role: string | null) => {
    const grants = { ...form.grants };
    if (role) grants[a] = role;
    else delete grants[a];
    setForm({ ...form, grants });
  };
  const chosen = apps.filter((a) => form.grants[a]);

  function run(p: Promise<Result>, ok: string, after?: () => void) {
    start(async () => {
      const r = await p;
      setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }
  const label = (r: PersonRow) => r.name || r.email;

  return (
    <>
      {msg && (
        <div className="notice" style={{ marginBottom: 14, borderColor: msg.ok ? undefined : "var(--danger)", color: msg.ok ? undefined : "var(--danger)" }}>
          {msg.text}
        </div>
      )}

      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <table className="table" style={{ minWidth: 520 + apps.length * 150 }}>
          <thead>
            <tr>
              <th>Person</th>
              {apps.map((a) => (
                <th key={a}>{APPS[a].label}</th>
              ))}
              {isSuper && <th>Super admin</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name || "—"}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{r.email}</div>
                  {!r.active && <span className="badge gray">removed</span>}
                </td>
                {apps.map((a) => (
                  <td key={a}>
                    {r.isSuper ? (
                      <span className="muted" style={{ fontSize: 13 }}>all (super admin)</span>
                    ) : (
                      <select
                        value={r.grants[a] ?? ""}
                        disabled={pending || !r.active || (r.email === me && !isSuper)}
                        aria-label={`${label(r)} — ${APPS[a].label}`}
                        onChange={(e) => {
                          const role = e.target.value || null;
                          run(setAccess(r.email, a, role), role ? `${label(r)} is now ${role} in the ${APPS[a].label}.` : `${label(r)} no longer has the ${APPS[a].label}.`);
                        }}
                      >
                        <option value="">No access</option>
                        {APPS[a].roles.map((role) => (
                          <option key={role} value={role}>
                            {cap(role)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                ))}
                {isSuper && (
                  <td>
                    <input
                      type="checkbox"
                      checked={r.isSuper}
                      disabled={pending || r.email === me || !r.active}
                      aria-label={`${label(r)} is a super admin`}
                      onChange={(e) => {
                        const on = e.target.checked;
                        if (on && !confirm(`Make ${label(r)} a super admin? They'll be able to see and change every app and every person.`)) return;
                        run(setPersonFlags(r.email, { superAdmin: on }), on ? `${label(r)} is now a super admin.` : `${label(r)} is no longer a super admin.`);
                      }}
                    />
                  </td>
                )}
                <td style={{ whiteSpace: "nowrap" }}>
                  {pwFor === r.email ? (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <input type="text" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: 150 }} />
                      <button className="btn small" type="button" disabled={pending} onClick={() => run(resetPassword(r.email, pw), `New password set for ${label(r)}.`, () => { setPwFor(null); setPw(""); })}>
                        Save
                      </button>
                      <button className="btn small secondary" type="button" onClick={() => { setPwFor(null); setPw(""); }}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      {r.active && (!r.isSuper || isSuper) && (
                        <button className="btn small secondary" type="button" onClick={() => setPwFor(r.email)}>
                          Set password
                        </button>
                      )}{" "}
                      {isSuper && r.email !== me && (
                        <button
                          className="btn small secondary"
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (r.active && !confirm(`Remove ${label(r)}? They won't be able to open any app until you restore them.`)) return;
                            run(setPersonFlags(r.email, { active: !r.active }), r.active ? `${label(r)} was removed from every app.` : `${label(r)} is back.`);
                          }}
                        >
                          {r.active ? "Remove" : "Restore"}
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

      <form
        className="card"
        style={{ marginTop: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          const names = chosen.map((a) => APPS[a].label);
          run(
            addPerson(form),
            `${form.name || form.email} is added${names.length ? ` with ${names.join(", ").replace(/, ([^,]*)$/, " and $1")}` : ""}. Give them the web address, their email and the password you set.`,
            () => setForm(blank),
          );
        }}
      >
        <div className="section-title" style={{ marginTop: 0 }}>Add someone</div>
        <div className="row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div className="field">
            <label>Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="field">
            <label>Starting password</label>
            <input type="text" minLength={8} value={form.password} placeholder="8+ characters" onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <div className="hint">Leave blank if they already sign in to a Pasatiempo app.</div>
          </div>
        </div>
        <div className="field">
          <label>Apps they can open</label>
          <div style={{ display: "grid", gap: 8 }}>
            {apps.map((a) => {
              const role = form.grants[a];
              return (
                <div key={a} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 190, margin: 0, fontWeight: 600 }}>
                    <input type="checkbox" checked={!!role} onChange={(e) => setGrant(a, e.target.checked ? startRole(a) : null)} />
                    {APPS[a].label}
                  </label>
                  {role && (
                    <>
                      <select value={role} aria-label={`Role in the ${APPS[a].label}`} onChange={(e) => setGrant(a, e.target.value)} style={{ width: "auto" }}>
                        {APPS[a].roles.map((r) => (
                          <option key={r} value={r}>
                            {cap(r)}
                          </option>
                        ))}
                      </select>
                      <span className="hint" style={{ margin: 0 }}>{(APPS[a].roleHelp as Record<string, string>)[role]}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="hint">Tick every app they use. Leave them all blank to add the person now and give access later.</div>
        </div>
        <button className="btn" type="submit" disabled={pending}>
          Add
        </button>
      </form>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title" style={{ marginTop: 0 }}>What each role can do</div>
        {apps.map((a) => (
          <p key={a} style={{ margin: "6px 0" }}>
            <b>{APPS[a].label}:</b>{" "}
            {APPS[a].roles.map((role) => `${cap(role)} — ${(APPS[a].roleHelp as Record<string, string>)[role]}`).join(". ")}.
          </p>
        ))}
        {isSuper && (
          <p style={{ margin: "6px 0" }}>
            <b>Super admin:</b> every app at its top role, everyone&apos;s access, and the public-site switches.
          </p>
        )}
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          Caddies don&apos;t need an entry here. They sign in to the caddie portal with the QR code from the roster.
        </p>
      </div>
    </>
  );
}
