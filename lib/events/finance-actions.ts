"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "./auth";
import { financeToRow } from "./map";
import { isTender } from "./finance-types";
import type { Instructor } from "./finance-types";

// Server actions for the clinic financials page.
//
// EVERY action re-checks global-admin here, server-side. The page already hides
// itself from non-admins, but a hidden button is not a permission check — these
// are POST endpoints that anyone signed in could call directly.

export interface Result {
  ok: boolean;
  error?: string;
}

const DENIED: Result = { ok: false, error: "Not authorised." };

async function requireAdmin(): Promise<boolean> {
  const viewer = await getViewer();
  return !!viewer?.isGlobalAdmin;
}

function refresh(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/financials`);
  revalidatePath(`/admin/events/${eventId}`);
}

// ---- payments -------------------------------------------------------------

export interface PaymentInput {
  eventId: string;
  regId: string;
  paid: boolean;
  feeCents: number | null; // null = use the event default
  tender: string | null;
  paidOn: string | null; // "yyyy-mm-dd"
  paymentNote: string;
}

export async function savePayment(input: PaymentInput): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  if (input.feeCents != null && !Number.isInteger(input.feeCents)) {
    return { ok: false, error: "That fee amount isn't a valid number." };
  }
  if (input.tender != null && input.tender !== "" && !isTender(input.tender)) {
    return { ok: false, error: "Pick cash, check, Venmo or Zelle." };
  }

  const supa = createAdminClient("events");
  const { error } = await supa
    .from("registrations")
    .update({
      paid: input.paid,
      fee_cents: input.feeCents,
      tender: input.tender ? input.tender : null,
      paid_on: input.paidOn ? input.paidOn : null,
      payment_note: input.paymentNote,
    })
    .eq("id", input.regId);
  if (error) return { ok: false, error: error.message };

  refresh(input.eventId);
  return { ok: true };
}

// ---- fee / organizer cut / instructors ------------------------------------

export interface SettingsInput {
  eventId: string;
  feeCents: number;
  organizerName: string;
  organizerCutCents: number;
}

export async function saveFinanceSettings(
  input: SettingsInput,
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  if (!Number.isInteger(input.feeCents) || input.feeCents < 0) {
    return { ok: false, error: "The fee has to be zero or more." };
  }
  if (!Number.isInteger(input.organizerCutCents)) {
    return { ok: false, error: "That organiser cut isn't a valid number." };
  }

  const supa = createAdminClient("events");
  const { error } = await supa
    .from("event_finance")
    .update(
      financeToRow({
        feeCents: input.feeCents,
        organizerName: input.organizerName.trim(),
        organizerCutCents: input.organizerCutCents,
      }),
    )
    .eq("event_id", input.eventId);
  if (error) return { ok: false, error: error.message };

  refresh(input.eventId);
  return { ok: true };
}

export async function saveInstructors(
  eventId: string,
  instructors: Instructor[],
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const cleaned = instructors
    .map((i) => ({ id: i.id, name: i.name.trim() }))
    .filter((i) => i.id && i.name);

  const supa = createAdminClient("events");
  const { error } = await supa
    .from("event_finance")
    .update(financeToRow({ instructors: cleaned }))
    .eq("event_id", eventId);
  if (error) return { ok: false, error: error.message };

  refresh(eventId);
  return { ok: true };
}

// Tick/untick one pro on one clinic date. Read-modify-write of the presence map:
// a single admin edits this page, so a row lock would be ceremony.
export async function setPresence(
  eventId: string,
  slotId: string,
  instructorId: string,
  present: boolean,
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("event_finance")
    .select("presence")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const presence: Record<string, string[]> = data?.presence ?? {};
  const current = new Set(presence[slotId] ?? []);
  if (present) current.add(instructorId);
  else current.delete(instructorId);
  presence[slotId] = [...current];

  const { error: upErr } = await supa
    .from("event_finance")
    .update({ presence })
    .eq("event_id", eventId);
  if (upErr) return { ok: false, error: upErr.message };

  refresh(eventId);
  return { ok: true };
}

// ---- prize purchases ------------------------------------------------------

export interface PrizeInput {
  eventId: string;
  purchasedOn: string | null; // "yyyy-mm-dd"
  description: string;
  amountCents: number;
}

export async function addPrize(input: PrizeInput): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;
  if (!Number.isInteger(input.amountCents)) {
    return { ok: false, error: "That amount isn't a valid number." };
  }
  if (!input.description.trim()) {
    return { ok: false, error: "Say what the prize was." };
  }

  const supa = createAdminClient("events");
  const { error } = await supa.from("prize_purchases").insert({
    event_id: input.eventId,
    purchased_on: input.purchasedOn ? input.purchasedOn : null,
    description: input.description.trim(),
    amount_cents: input.amountCents,
  });
  if (error) return { ok: false, error: error.message };

  refresh(input.eventId);
  return { ok: true };
}

export async function deletePrize(
  eventId: string,
  prizeId: string,
): Promise<Result> {
  if (!(await requireAdmin())) return DENIED;

  const supa = createAdminClient("events");
  const { error } = await supa
    .from("prize_purchases")
    .delete()
    .eq("id", prizeId)
    .eq("event_id", eventId);
  if (error) return { ok: false, error: error.message };

  refresh(eventId);
  return { ok: true };
}
