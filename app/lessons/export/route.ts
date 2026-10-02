import { NextResponse, type NextRequest } from "next/server";
import { assertLessonBook } from "@/lib/lessons/auth";
import { courseDay } from "@/lib/lessons/calc";
import { lessonBookClient } from "@/lib/lessons/db";
import { incomeCsv, type PaymentMethod } from "@/lib/lessons/income";

// GET /lessons/export?year=2026 - every package paid that year, as CSV, for
// taxes. Owner only: the access check here, and RLS under it. A paid package
// with no price recorded has no amount to report and is left out; the
// dashboard's "no price" banner is where that gets fixed.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await assertLessonBook();
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const thisYear = Number(courseDay(new Date().toISOString()).slice(0, 4));
  const asked = Number(request.nextUrl.searchParams.get("year"));
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : thisYear;

  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_packages")
    .select("paid_on, label, size, price_cents, payment_method, lesson_clients(name)")
    .eq("payment_status", "paid")
    .not("price_cents", "is", null)
    .not("paid_on", "is", null)
    .gte("paid_on", `${year}-01-01`)
    .lt("paid_on", `${year + 1}-01-01`);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = incomeCsv(
    (data ?? []).map((r) => ({
      paidOn: r.paid_on as string,
      clientName:
        ((r.lesson_clients as { name?: string } | null)?.name as string) ?? "",
      label: (r.label as string | null) ?? null,
      size: Number(r.size),
      priceCents: Number(r.price_cents),
      method: (r.payment_method as PaymentMethod | null) ?? null,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson-income-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
