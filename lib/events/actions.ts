"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { eventToRow, rowToEvent, rowToReg } from "./map";
import { newId, newSlug, slugify } from "./ids";
import { availability } from "./data";
import { formatSlot } from "./format";
import type {
  CustomField,
  EventRec,
  EventType,
  GalleryMode,
  RegStatus,
  Registration,
  RosterStyle,
  ScheduleMode,
  Slot,
} from "./types";

const PHOTO_BUCKET = "event-photos";

// Email of the signed-in admin (best-effort; null before auth is wired or when
// signed out). Used to stamp the event creator.
async function currentEmail(): Promise<string | null> {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Event create / update (admin)
// ---------------------------------------------------------------------------

export interface EventInput {
  id?: string;
  slug?: string;
  title: string;
  type: EventType;
  description: string;
  info: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  scheduleMode: ScheduleMode;
  allowMultiSlot: boolean;
  slotsPrompt: string;
  slots: Slot[];
  capacity: number | null;
  waitlistEnabled: boolean;
  allowGuests: boolean;
  maxGuests: number | null;
  collectGuestNames: boolean;
  inviteOnly: boolean;
  allowlist: string[];
  inviteOnlyMessage: string;
  customFields: CustomField[];
  pricingEnabled: boolean;
  pricing: string;
  showRoster: boolean;
  rosterStyle: RosterStyle;
  managers: string[];
  status: "draft" | "open" | "closed";
}

export type SaveEventResult =
  | { ok: true; event: EventRec }
  | { ok: false; error: string };

export async function saveEvent(input: EventInput): Promise<SaveEventResult> {
  try {
    return await saveEventInner(input);
  } catch (e) {
    // Surface the real reason to the client (production redacts thrown errors).
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "Could not save the event.";
    return { ok: false, error: msg };
  }
}

async function saveEventInner(input: EventInput): Promise<SaveEventResult> {
  const supa = createAdminClient("events");

  const cleanSlots: Slot[] = input.slots
    .filter((s) => s.date || s.label.trim() || s.startTime)
    .map((s) => ({
      id: s.id && !s.id.startsWith("tmp_") ? s.id : newId(),
      date: s.date || null,
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      label: s.label.trim(),
      note: (s.note || "").trim().slice(0, 80),
      capacity: s.capacity == null ? null : Math.max(1, Math.floor(s.capacity)),
    }));

  const cleanFields: CustomField[] = input.customFields
    .filter((f) => f.label.trim())
    .map((f) => ({
      ...f,
      id: f.id && !f.id.startsWith("tmp_") ? f.id : newId(),
      label: f.label.trim(),
      options: f.options.map((o) => o.trim()).filter(Boolean),
    }));

  const fields: Partial<EventRec> = {
    title: input.title.trim() || "Untitled event",
    type: input.type,
    description: input.description,
    info: input.info,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    scheduleMode: input.scheduleMode,
    allowMultiSlot: input.scheduleMode === "slots" ? input.allowMultiSlot : false,
    slotsPrompt: input.scheduleMode === "slots" ? input.slotsPrompt.trim() : "",
    slots: input.scheduleMode === "slots" ? cleanSlots : [],
    capacity: input.capacity,
    waitlistEnabled: input.waitlistEnabled,
    allowGuests: input.allowGuests,
    maxGuests: input.maxGuests,
    collectGuestNames: input.collectGuestNames,
    inviteOnly: input.inviteOnly,
    allowlist: input.allowlist.map((e) => e.trim().toLowerCase()).filter(Boolean),
    inviteOnlyMessage: input.inviteOnlyMessage.trim(),
    customFields: cleanFields,
    pricingEnabled: input.pricingEnabled,
    pricing: input.pricingEnabled ? input.pricing.trim() : "",
    showRoster: input.showRoster,
    rosterStyle: input.rosterStyle,
    managers: input.managers.map((e) => e.trim().toLowerCase()).filter(Boolean),
    status: input.status,
  };

  const requestedSlug = input.slug ? slugify(input.slug) : "";

  async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    let q = supa.from("events").select("id").eq("slug", slug).limit(1);
    if (exceptId) q = q.neq("id", exceptId);
    const { data } = await q;
    return (data?.length ?? 0) > 0;
  }

  let saved: EventRec;

  if (input.id) {
    const { data: existingRow, error: e1 } = await supa
      .from("events")
      .select("slug")
      .eq("id", input.id)
      .maybeSingle();
    if (e1) throw e1;
    if (!existingRow) throw new Error("Event not found");

    let slug = existingRow.slug as string;
    if (requestedSlug && requestedSlug !== slug) {
      if (await slugTaken(requestedSlug, input.id))
        throw new Error(`The link "/e/${requestedSlug}" is already taken.`);
      slug = requestedSlug;
    }
    const { data, error } = await supa
      .from("events")
      .update({ ...eventToRow(fields), slug })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    saved = rowToEvent(data);
  } else {
    let slug = requestedSlug || newSlug();
    if (requestedSlug && (await slugTaken(requestedSlug)))
      throw new Error(`The link "/e/${requestedSlug}" is already taken.`);
    while (await slugTaken(slug)) slug = newSlug();

    const { data, error } = await supa
      .from("events")
      .insert({
        ...eventToRow(fields),
        slug,
        photos: [],
        gallery_mode: "slideshow",
        created_by: await currentEmail(),
      })
      .select("*")
      .single();
    if (error) throw error;
    saved = rowToEvent(data);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${saved.id}`);
  revalidatePath(`/events/e/${saved.slug}`);
  return { ok: true, event: saved };
}

export async function setEventStatus(
  id: string,
  status: "draft" | "open" | "closed",
): Promise<void> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("events")
    .update({ status })
    .eq("id", id)
    .select("slug")
    .single();
  if (error) throw error;
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  revalidatePath(`/events/e/${data.slug}`);
}

export async function deleteEvent(id: string): Promise<void> {
  const supa = createAdminClient("events");
  // remove any stored photos for this event, then the row (registrations cascade)
  try {
    const { data: files } = await supa.storage.from(PHOTO_BUCKET).list(id);
    if (files?.length)
      await supa.storage
        .from(PHOTO_BUCKET)
        .remove(files.map((f) => `${id}/${f.name}`));
  } catch {
    /* ignore */
  }
  const { error } = await supa.from("events").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
  revalidatePath("/admin/events");
}

// ---------------------------------------------------------------------------
// Photos (Supabase Storage bucket "event-photos")
// ---------------------------------------------------------------------------

function storagePath(publicUrl: string): string | null {
  const marker = `/${PHOTO_BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  return i === -1 ? null : publicUrl.slice(i + marker.length);
}

async function setPhotos(
  supa: ReturnType<typeof createAdminClient>,
  eventId: string,
  photos: string[],
): Promise<string[]> {
  const { error } = await supa
    .from("events")
    .update({ photos })
    .eq("id", eventId);
  if (error) throw error;
  return photos;
}

export async function uploadPhoto(
  eventId: string,
  formData: FormData,
): Promise<{ ok: boolean; photos?: string[]; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "No file received." };
  if (file.size > 8 * 1024 * 1024)
    return { ok: false, error: "Please use an image under 8 MB." };

  const supa = createAdminClient("events");
  const ext = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const objectPath = `${eventId}/${newId()}.${ext || "jpg"}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supa.storage
    .from(PHOTO_BUCKET)
    .upload(objectPath, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = supa.storage.from(PHOTO_BUCKET).getPublicUrl(objectPath);

  const { data: ev, error } = await supa
    .from("events")
    .select("photos")
    .eq("id", eventId)
    .single();
  if (error) return { ok: false, error: error.message };

  const photos = [...((ev.photos as string[]) ?? []), pub.publicUrl];
  await setPhotos(supa, eventId, photos);
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, photos };
}

export async function removePhoto(
  eventId: string,
  photoUrl: string,
): Promise<string[]> {
  const supa = createAdminClient("events");
  const path = storagePath(photoUrl);
  if (path) await supa.storage.from(PHOTO_BUCKET).remove([path]).catch(() => {});
  const { data: ev } = await supa
    .from("events")
    .select("photos")
    .eq("id", eventId)
    .single();
  const photos = ((ev?.photos as string[]) ?? []).filter((p) => p !== photoUrl);
  await setPhotos(supa, eventId, photos);
  revalidatePath(`/admin/events/${eventId}`);
  return photos;
}

export async function movePhoto(
  eventId: string,
  photoUrl: string,
  dir: -1 | 1,
): Promise<string[]> {
  const supa = createAdminClient("events");
  const { data: ev } = await supa
    .from("events")
    .select("photos")
    .eq("id", eventId)
    .single();
  const photos = [...(((ev?.photos as string[]) ?? []))];
  const i = photos.indexOf(photoUrl);
  const j = i + dir;
  if (i !== -1 && j >= 0 && j < photos.length) {
    [photos[i], photos[j]] = [photos[j], photos[i]];
    await setPhotos(supa, eventId, photos);
  }
  revalidatePath(`/admin/events/${eventId}`);
  return photos;
}

export async function setGalleryMode(
  eventId: string,
  mode: GalleryMode,
): Promise<void> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("events")
    .update({ gallery_mode: mode })
    .eq("id", eventId)
    .select("slug")
    .single();
  if (error) throw error;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/e/${data.slug}`);
}

// ---------------------------------------------------------------------------
// Public registration
// ---------------------------------------------------------------------------

export interface RegisterInput {
  slug: string;
  name: string;
  email: string;
  phone: string;
  partySize: number;
  guestNames: string[];
  slotIds: string[];
  answers: Record<string, string>;
}

export interface RegisterResult {
  ok: boolean;
  status?: RegStatus;
  error?: string;
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!email || !email.includes("@"))
    return { ok: false, error: "Please enter a valid email." };

  const supa = createAdminClient("events");
  const { data: evRow, error: evErr } = await supa
    .from("events")
    .select("*")
    .eq("slug", input.slug)
    .maybeSingle();
  if (evErr) return { ok: false, error: "Something went wrong." };
  if (!evRow) return { ok: false, error: "Event not found." };
  const ev = rowToEvent(evRow);

  if (ev.status !== "open")
    return { ok: false, error: "Registration for this event is closed." };
  if (ev.inviteOnly && !ev.allowlist.includes(email))
    return {
      ok: false,
      error:
        ev.inviteOnlyMessage ||
        "This event is invite-only and that email isn't on the list.",
    };

  const { data: regRows } = await supa
    .from("registrations")
    .select("*")
    .eq("event_id", ev.id);
  const regs: Registration[] = (regRows ?? []).map(rowToReg);

  const partySize = Math.max(1, Math.floor(input.partySize || 1));

  let slotIds: string[] = [];
  if (ev.scheduleMode === "slots") {
    const chosen = input.slotIds.filter((id) =>
      ev.slots.some((s) => s.id === id),
    );
    if (chosen.length === 0)
      return { ok: false, error: "Please choose at least one date/time." };
    if (!ev.allowMultiSlot && chosen.length > 1)
      return { ok: false, error: "Please choose just one option." };
    slotIds = chosen;
  }

  let status: RegStatus;
  if (ev.scheduleMode === "slots") {
    const allFit = slotIds.every((id) => {
      const a = availability(ev, regs, id);
      return a.capacity == null || partySize <= (a.remaining ?? Infinity);
    });
    if (allFit) status = "confirmed";
    else if (ev.waitlistEnabled) status = "waitlist";
    else return { ok: false, error: "Sorry, that option is full." };
  } else {
    const a = availability(ev, regs, null);
    if (a.capacity == null || partySize <= (a.remaining ?? Infinity))
      status = "confirmed";
    else if (ev.waitlistEnabled) status = "waitlist";
    else
      return {
        ok: false,
        error: a.remaining
          ? `Only ${a.remaining} spot(s) left — too few for a party of ${partySize}.`
          : "Sorry, this event is full.",
      };
  }

  const { error: insErr } = await supa.from("registrations").insert({
    event_id: ev.id,
    name,
    email,
    phone: input.phone.trim(),
    party_size: partySize,
    guest_names: input.guestNames
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, Math.max(0, partySize - 1)),
    slot_ids: slotIds,
    answers: input.answers,
    status,
  });
  if (insErr) return { ok: false, error: "Could not save your registration." };

  revalidatePath(`/events/e/${input.slug}`);
  return { ok: true, status };
}

// ---------------------------------------------------------------------------
// Self-service (public): an attendee looks up and cancels their own sign-up.
// Identified by the email they registered with (club context — no login).
// ---------------------------------------------------------------------------

export interface MyRegistration {
  id: string;
  name: string;
  status: RegStatus;
  partySize: number;
  slots: { id: string; label: string }[]; // resolved slot labels (series)
}

export async function lookupMyRegistrations(
  slug: string,
  email: string,
): Promise<{ ok: boolean; registrations?: MyRegistration[]; error?: string }> {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@"))
    return { ok: false, error: "Please enter the email you registered with." };

  const supa = createAdminClient("events");
  const { data: evRow } = await supa
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!evRow) return { ok: false, error: "Event not found." };
  const ev = rowToEvent(evRow);

  const { data: regRows } = await supa
    .from("registrations")
    .select("*")
    .eq("event_id", ev.id)
    .eq("email", e);
  const regs = (regRows ?? [])
    .map(rowToReg)
    .filter((r) => r.status !== "cancelled");

  return {
    ok: true,
    registrations: regs.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      partySize: r.partySize,
      slots: r.slotIds
        .map((id) => ev.slots.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({ id: s.id, label: formatSlot(s) })),
    })),
  };
}

// Cancel an entire registration (verifies the email matches).
export async function cancelMyRegistration(
  slug: string,
  email: string,
  regId: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase();
  const supa = createAdminClient("events");
  const { data: reg } = await supa
    .from("registrations")
    .select("id,email")
    .eq("id", regId)
    .maybeSingle();
  if (!reg || reg.email !== e)
    return { ok: false, error: "That registration wasn't found for that email." };
  const { error } = await supa
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", regId);
  if (error) return { ok: false, error: "Could not cancel. Please try again." };
  revalidatePath(`/events/e/${slug}`);
  return { ok: true };
}

// Drop a single date from a series registration (removes one slot). If it was
// the only slot, the whole registration is cancelled.
export async function dropMySlot(
  slug: string,
  email: string,
  regId: string,
  slotId: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase();
  const supa = createAdminClient("events");
  const { data: reg } = await supa
    .from("registrations")
    .select("id,email,slot_ids")
    .eq("id", regId)
    .maybeSingle();
  if (!reg || reg.email !== e)
    return { ok: false, error: "That registration wasn't found for that email." };

  const remaining = ((reg.slot_ids as string[]) ?? []).filter(
    (id) => id !== slotId,
  );
  const patch =
    remaining.length === 0
      ? { status: "cancelled" as RegStatus }
      : { slot_ids: remaining };
  const { error } = await supa
    .from("registrations")
    .update(patch)
    .eq("id", regId);
  if (error) return { ok: false, error: "Could not update. Please try again." };
  revalidatePath(`/events/e/${slug}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manage registrations (admin)
// ---------------------------------------------------------------------------

export async function setRegStatus(
  regId: string,
  status: RegStatus,
): Promise<void> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("registrations")
    .update({ status })
    .eq("id", regId)
    .select("event_id")
    .single();
  if (error) throw error;
  revalidatePath(`/admin/events/${data.event_id}`);
}

export async function deleteRegistration(regId: string): Promise<void> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("registrations")
    .delete()
    .eq("id", regId)
    .select("event_id")
    .single();
  if (error) throw error;
  revalidatePath(`/admin/events/${data.event_id}`);
}
