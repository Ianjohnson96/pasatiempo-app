import { describe, expect, it } from "vitest";
import { catchUpGaps, markPaidOn, paidTotals, seriesPaidOn } from "./catchup";

const bill = (p: {
  paymentStatus?: "unpaid" | "pending" | "paid";
  priceCents?: number | null;
  paymentMethod?: string | null;
}) => ({
  paymentStatus: p.paymentStatus ?? "paid",
  priceCents: p.priceCents === undefined ? 10000 : p.priceCents,
  paymentMethod: p.paymentMethod === undefined ? "venmo" : p.paymentMethod,
});

describe("paidTotals", () => {
  it("adds up only paid bills, split by how they were paid", () => {
    expect(
      paidTotals([
        bill({ priceCents: 50000, paymentMethod: "venmo" }),
        bill({ priceCents: 8500, paymentMethod: "member_charge" }),
        bill({ priceCents: 9000, paymentMethod: "venmo" }),
        bill({ paymentStatus: "unpaid", priceCents: 40000, paymentMethod: null }),
        bill({ paymentStatus: "pending", priceCents: 8500, paymentMethod: "member_charge" }),
      ]),
    ).toEqual({
      totalCents: 67500,
      byMethod: { venmo: 59000, member_charge: 8500 },
    });
  });

  it("files a paid bill with no method under none", () => {
    expect(paidTotals([bill({ priceCents: 25000, paymentMethod: null })])).toEqual({
      totalCents: 25000,
      byMethod: { none: 25000 },
    });
  });

  it("counts a paid bill with no price as nothing, not NaN", () => {
    expect(paidTotals([bill({ priceCents: null })])).toEqual({
      totalCents: 0,
      byMethod: {},
    });
  });
});

describe("catchUpGaps", () => {
  it("is empty for a bill that is paid, priced and has a method", () => {
    expect(catchUpGaps(bill({}))).toEqual([]);
  });

  it("flags unpaid and pending bills", () => {
    expect(catchUpGaps(bill({ paymentStatus: "unpaid", paymentMethod: null }))).toEqual([
      "unpaid",
    ]);
    expect(catchUpGaps(bill({ paymentStatus: "pending" }))).toEqual(["pending"]);
  });

  it("flags a paid bill with no price or no method", () => {
    expect(catchUpGaps(bill({ priceCents: null }))).toEqual(["no price"]);
    expect(catchUpGaps(bill({ paymentMethod: null }))).toEqual(["no type"]);
  });

  it("does not ask an unpaid bill how it was paid", () => {
    expect(
      catchUpGaps(bill({ paymentStatus: "unpaid", priceCents: null, paymentMethod: null })),
    ).toEqual(["unpaid", "no price"]);
  });
});

describe("seriesPaidOn", () => {
  it("dates a series by its first lesson", () => {
    expect(
      seriesPaidOn({ kind: "package", soldOn: "2026-03-01", paidOn: null }, "2026-03-14"),
    ).toBe("2026-03-14");
  });

  it("keeps a date already recorded on a paid bill", () => {
    expect(
      seriesPaidOn({ kind: "package", soldOn: "2026-03-01", paidOn: "2026-04-02" }, "2026-03-14"),
    ).toBe("2026-04-02");
  });

  it("falls back to the sold date when the series has no lessons yet", () => {
    expect(
      seriesPaidOn({ kind: "package", soldOn: "2026-03-01", paidOn: null }, null),
    ).toBe("2026-03-01");
  });

  it("dates a single by its lesson day", () => {
    expect(
      seriesPaidOn({ kind: "single", soldOn: "2026-05-09", paidOn: null }, "2026-05-09"),
    ).toBe("2026-05-09");
  });

  it("returns null when nothing is known, so the form asks", () => {
    expect(seriesPaidOn({ kind: "package", soldOn: null, paidOn: null }, null)).toBeNull();
  });
});

describe("markPaidOn", () => {
  const base = {
    alreadyPaidOn: null,
    venmoOn: null,
    firstLessonOn: "2025-06-04",
    soldOn: "2025-06-01",
    today: "2026-11-10",
  };

  it("dates a bill marked paid today by its first lesson, not today", () => {
    expect(markPaidOn(base)).toBe("2025-06-04");
  });

  it("uses the day the tied Venmo payment arrived when there is one", () => {
    expect(markPaidOn({ ...base, venmoOn: "2025-06-02" })).toBe("2025-06-02");
  });

  it("keeps the date of a bill that was already paid", () => {
    expect(markPaidOn({ ...base, alreadyPaidOn: "2025-07-01", venmoOn: "2025-06-02" })).toBe(
      "2025-07-01",
    );
  });

  it("falls back to the sold date, then today, when nothing else is known", () => {
    expect(markPaidOn({ ...base, firstLessonOn: null })).toBe("2025-06-01");
    expect(markPaidOn({ ...base, firstLessonOn: null, soldOn: null })).toBe("2026-11-10");
  });
});
