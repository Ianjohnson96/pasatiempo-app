import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import { caddieLedger, listCaddies } from "@/lib/caddie/data";
import { nextUpOrder } from "@/lib/caddie/ledger";

// Who has had what, and how they have behaved getting it.
//
// Global admins only. This is one caddie's earnings next to another's, plus a
// record of who hands loops back late — the caddie master's business, not the
// counter's. The gate lives here as well as on the tab, because a hidden link
// is not a permission.
export const dynamic = "force-dynamic";

const money = (cents: number) =>
  cents === 0 ? "—" : `$${(cents / 100).toFixed(0)}`;

export default async function CaddieLedgerPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isGlobalAdmin) redirect("/admin/caddie");

  const [caddies, ledger] = await Promise.all([listCaddies(), caddieLedger(60)]);

  const active = caddies.filter((c) => c.status === "Active");
  const order = nextUpOrder(
    ledger,
    active.map((c) => c.id),
  );
  const byId = new Map(active.map((c) => [c.id, c]));

  const totalWorked = [...ledger.values()].reduce(
    (n, r) => n + r.loopsWorked,
    0,
  );

  return (
    <>
      <CaddieHeader email={viewer.email} active="ledger" isGlobalAdmin />
      <main className="container">
        <h2 className="section-title">Fair share — last 60 days</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Ordered by who is furthest behind on earnings, so the top of this list
          is who is next up. Loops and money are both shown because neither is
          fair alone: three single bags are not three forecaddies, and a caddie
          who takes every short loop is not idle.
        </p>

        {totalWorked === 0 && (
          <p className="notice">
            No completed loops in the window yet, so everyone reads as level.
            This fills in as loops are worked.
          </p>
        )}

        <div className="card" style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <Th>Next up</Th>
                <Th>Caddie</Th>
                <Th>Tier</Th>
                <Th num>Loops</Th>
                <Th num>Earned</Th>
                <Th num>Offered</Th>
                <Th num>Declined</Th>
                <Th num>No answer</Th>
                <Th num>Handed back</Th>
                <Th num>No show</Th>
              </tr>
            </thead>
            <tbody>
              {order.map((id, i) => {
                const c = byId.get(id)!;
                const r = ledger.get(id);
                const late = r?.droppedLate ?? 0;
                const noShow = r?.noShows ?? 0;
                return (
                  <tr key={id} style={{ borderTop: "1px solid var(--line)" }}>
                    <Td>{i + 1}</Td>
                    <Td>
                      <strong>{c.fullName}</strong>
                    </Td>
                    <Td>
                      <span className="badge gray">{c.tierName ?? "—"}</span>
                    </Td>
                    <Td num>{r?.loopsWorked ?? 0}</Td>
                    <Td num>{money(r?.earnedCents ?? 0)}</Td>
                    <Td num>{r?.offered ?? 0}</Td>
                    <Td num>{r?.declined ?? 0}</Td>
                    <Td num>{r?.ignored ?? 0}</Td>
                    <Td num>
                      {r?.dropped ?? 0}
                      {late > 0 && (
                        <span
                          className="badge closed"
                          style={{ marginLeft: 6 }}
                        >
                          {late} late
                        </span>
                      )}
                    </Td>
                    <Td num>
                      {noShow > 0 ? (
                        <span className="badge closed">{noShow}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
              {order.length === 0 && (
                <tr>
                  <Td>—</Td>
                  <Td>No active caddies on the roster yet.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          <strong>Handed back</strong> is a loop accepted and then given up;{" "}
          <em>late</em> means inside 24 hours of the tee time, which is the one
          the shop struggles to refill. <strong>No answer</strong> is an offer
          that simply ran out — silence stalls the next tier as surely as a
          decline does. Offers the shop withdrew count against nobody.
        </p>
      </main>
    </>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th
      style={{
        padding: "8px 10px",
        fontSize: 12,
        color: "var(--muted)",
        fontWeight: 600,
        textAlign: num ? "right" : "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <td
      style={{
        padding: "10px",
        fontSize: 15,
        textAlign: num ? "right" : "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
