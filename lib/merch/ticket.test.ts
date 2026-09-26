import { describe, expect, it } from "vitest";
import { checkReportTicket, reportTicket } from "./ticket";

// The Python report reader (api/merch/reports.py, check_ticket) accepts this
// exact pass for the same secret and time; keep the two in step.
const SECRET = "test-secret";
const NOW = 1790000000000;
const KNOWN =
  "eyJlIjoib3duZXJAZXhhbXBsZS5jb20iLCJ4IjoxNzkwMDAwOTAwfQ.H_P6MAhmm1vs0jALnHhkfdvV06M1Ar96SCIHYhC5Bxw";

describe("report ticket", () => {
  it("matches the pass the Python reader was checked against", () => {
    expect(reportTicket("owner@example.com", NOW, SECRET)).toBe(KNOWN);
  });
  it("is good for 15 minutes", () => {
    expect(checkReportTicket(KNOWN, NOW, SECRET)).toBe("owner@example.com");
    expect(checkReportTicket(KNOWN, NOW + 15 * 60 * 1000, SECRET)).toBe("owner@example.com");
    expect(checkReportTicket(KNOWN, NOW + 15 * 60 * 1000 + 1000, SECRET)).toBeNull();
  });
  it("rejects a changed pass or another key", () => {
    expect(checkReportTicket(KNOWN.slice(0, -2) + "xx", NOW, SECRET)).toBeNull();
    expect(checkReportTicket("x" + KNOWN, NOW, SECRET)).toBeNull();
    expect(checkReportTicket(KNOWN, NOW, "other")).toBeNull();
    expect(checkReportTicket("not-a-pass", NOW, SECRET)).toBeNull();
  });
});
