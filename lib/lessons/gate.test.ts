import { describe, expect, it } from "vitest";
import { gateFirst } from "./gate";

const later = <T>(ms: number, v: T) =>
  new Promise<T>((r) => setTimeout(() => r(v), ms));
const failLater = (ms: number, e: Error) =>
  new Promise<never>((_, j) => setTimeout(() => j(e), ms));

describe("gateFirst", () => {
  it("surfaces the gate's redirect even when the reads fail first", async () => {
    // Signed out: the RPC is refused at once, the auth check answers later.
    const redirect = new Error("NEXT_REDIRECT");
    await expect(
      gateFirst(
        failLater(20, redirect),
        failLater(1, new Error("permission denied")),
      ),
    ).rejects.toBe(redirect);
  });

  it("returns the viewer and the data when both succeed", async () => {
    await expect(gateFirst(later(5, "ian"), later(1, 42))).resolves.toEqual([
      "ian",
      42,
    ]);
  });

  it("still reports a read failure once the gate has passed", async () => {
    const boom = new Error("db down");
    await expect(gateFirst(later(1, "ian"), failLater(5, boom))).rejects.toBe(
      boom,
    );
  });
});
