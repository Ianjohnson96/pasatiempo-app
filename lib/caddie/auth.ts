import { assertApp, requireApp, roleIn } from "@/lib/hub/access";

export interface ShopViewer {
  email: string;
  /** Caddie Program admin (or super admin): adds the fair-share ledger. */
  isGlobalAdmin: boolean;
}

// The Pro Shop side of the Caddie Program (/admin/caddie). Caddies themselves
// sign in with their own cookie (./session.ts) and never pass through here.

export async function requireCaddieStaff(): Promise<ShopViewer> {
  const p = await requireApp("caddie");
  return { email: p.email, isGlobalAdmin: roleIn(p, "caddie") === "admin" };
}

/** For shop-side server actions: throws unless the caller has Caddie Program access. */
export async function assertCaddieStaff(): Promise<ShopViewer> {
  const p = await assertApp("caddie");
  return { email: p.email, isGlobalAdmin: roleIn(p, "caddie") === "admin" };
}
