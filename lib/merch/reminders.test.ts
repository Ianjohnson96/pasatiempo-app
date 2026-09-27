import { describe, expect, it } from "vitest";
import { reminderEmail } from "./reminders";
import { remindersFor } from "./schedule";

describe("reminder email", () => {
  it("leads with the SKU Analysis on the last day of the month and lists only what's left", () => {
    const due = remindersFor("2026-09-30", { "2026-09": { daily: true } });
    const m = reminderEmail("2026-09-30", due, "https://example.test/merch#reports");
    expect(m.subject).toBe("Pro Shop reports: Sep month-end due today · Week of Sep 28 overdue");
    expect(m.text).toContain("Run the SKU Analysis today");
    expect(m.text).toContain("Sep month-end (due today), 8 left:");
    expect(m.text).not.toContain("Daily Sales Report by Item");
    expect(m.html).toContain('href="https://example.test/merch#reports"');
  });

  it("says overdue once a checklist is late, and escapes names in the HTML", () => {
    const due = remindersFor("2026-10-04", { "2026-09": { sku: true } });
    const m = reminderEmail("2026-10-04", due, "https://example.test/?a=1&b=<2>");
    expect(m.subject).toBe("Pro Shop reports: Sep month-end overdue");
    expect(m.text).toContain("overdue — was due Sep 30");
    expect(m.text).not.toContain("Run the SKU Analysis today");
    expect(m.html).toContain("a=1&amp;b=&lt;2&gt;");
  });
});
