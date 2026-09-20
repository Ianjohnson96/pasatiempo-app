import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests cover the two places where being wrong is expensive and invisible:
// lib/events/finance.ts, where a bug moves real money, and lib/caddie's
// dispatch ranking, where a bug sends the wrong caddie to the wrong tee time.
// Everything else in this app is verified in the browser.
export default defineConfig({
  resolve: {
    // Match the "@/..." paths in tsconfig, so tests can import modules the way
    // the app does rather than reaching around with relative paths.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
