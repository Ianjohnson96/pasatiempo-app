import { defineConfig } from "vitest/config";

// Tests cover lib/events/finance.ts only — the payout math, where a bug costs
// real money. Everything else in this app is verified in the browser.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
