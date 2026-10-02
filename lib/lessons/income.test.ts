import { describe, expect, it } from "vitest";
import { incomeCsv, METHOD_LABEL } from "./income";

describe("incomeCsv", () => {
  const rows = [
    {
      paidOn: "2026-03-02",
      clientName: "Smith, Jo",
      label: 'The "big" one',
      size: 5,
      priceCents: 50000,
      method: "venmo" as const,
    },
    {
      paidOn: "2026-01-15",
      clientName: "Ray gorski",
      label: null,
      size: 3,
      priceCents: 31050,
      method: null,
    },
  ];

  it("lists paid packages oldest first, quoting commas and quotes", () => {
    const lines = incomeCsv(rows).split("\r\n");
    expect(lines[0]).toBe("Paid on,Client,Package,Lessons,Amount,Method");
    expect(lines[1]).toBe(
      "2026-01-15,Ray gorski,3-lesson package,3,310.50,Not recorded",
    );
    expect(lines[2]).toBe(
      '2026-03-02,"Smith, Jo","The ""big"" one",5,500.00,Venmo',
    );
  });

  it("ends with totals per method and overall", () => {
    const lines = incomeCsv(rows).split("\r\n");
    expect(lines).toContain(",,,,500.00,Total Venmo");
    expect(lines).toContain(",,,,310.50,Total Not recorded");
    expect(lines[lines.length - 1]).toBe(",,,,810.50,Total");
  });

  it("neutralises a cell a spreadsheet would run as a formula", () => {
    const csv = incomeCsv([{ ...rows[1], clientName: "=HYPERLINK(1)" }]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });

  it("labels every method the database allows", () => {
    expect(Object.keys(METHOD_LABEL).sort()).toEqual(
      ["cash", "member_charge", "other", "venmo"].sort(),
    );
  });
});
