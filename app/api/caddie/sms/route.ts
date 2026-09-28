import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTee, getSettings } from "@/lib/caddie/data";
import { portalLink } from "@/lib/caddie/sms";
import { parseReply, signatureMatches, twiml } from "@/lib/caddie/sms-words";

// Where Twilio delivers a caddie's text back.
//
// A reply of Y takes the offer, N passes, and both go through
// caddie.respond_to_offer() — the same row-locking function as a tap in the
// portal — so a text and a tap racing for the last seat cannot both win.
//
// Every request is checked against Twilio's signature before anything is read,
// and every message is stored once by its Twilio id: Twilio retries a webhook
// that is slow to answer, and a retried "Y" must not take a second loop.
//
// Point the Twilio number's "A message comes in" webhook (HTTP POST) at
//   https://<the vercel.app host>/api/caddie/sms
// If the URL Twilio calls differs from what this server sees — a proxy, a
// custom domain — set TWILIO_WEBHOOK_URL to exactly the URL typed into Twilio.

export const dynamic = "force-dynamic";

type Intent = ReturnType<typeof parseReply>;

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml" } });
}

function publicUrl(req: Request): string {
  if (process.env.TWILIO_WEBHOOK_URL) return process.env.TWILIO_WEBHOOK_URL;
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}${u.pathname}${u.search}`;
}

export async function POST(req: Request): Promise<Response> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return new Response("Texting is not configured.", { status: 503 });

  const params = Object.fromEntries(new URLSearchParams(await req.text()));
  if (!signatureMatches(publicUrl(req), params, token, req.headers.get("x-twilio-signature"))) {
    return new Response("Bad signature.", { status: 403 });
  }

  const sid = params.MessageSid ?? params.SmsSid ?? "";
  const from = params.From ?? "";
  const body = params.Body ?? "";
  if (!sid || !from) return xml(twiml());

  const supa = createAdminClient("caddie");

  // Stored first, keyed on Twilio's id: a retry of the same message stops here.
  const { data: inbound, error: logErr } = await supa
    .from("inbound_messages")
    .insert({
      provider: "twilio",
      provider_message_id: sid,
      from_number: from,
      to_number: params.To ?? null,
      body,
    })
    .select("id")
    .single();
  if (logErr) {
    if (logErr.code === "23505") return xml(twiml());
    throw logErr;
  }

  const intent = parseReply(body);
  const { reply, outcome, caddieId, assignmentId } = await handle(from, intent);

  await supa
    .from("inbound_messages")
    .update({
      matched_caddie_id: caddieId,
      matched_assignment_id: assignmentId,
      parsed_intent: intent.toUpperCase(),
      outcome,
    })
    .eq("id", inbound.id);

  if (assignmentId) {
    revalidatePath("/admin/caddie");
    revalidatePath("/caddie");
  }
  return xml(twiml(reply));
}

interface Handled {
  reply: string | null;
  outcome: string;
  caddieId: string | null;
  assignmentId: string | null;
}

async function handle(from: string, intent: Intent): Promise<Handled> {
  const supa = createAdminClient("caddie");
  const { data: caddie } = await supa
    .from("caddies")
    .select("id, status")
    .eq("phone", from)
    .maybeSingle();

  const none = (reply: string | null, outcome: string): Handled => ({
    reply,
    outcome,
    caddieId: caddie ? String(caddie.id) : null,
    assignmentId: null,
  });

  // STOP, START and HELP are answered by Twilio itself; a reply from here
  // after STOP would be refused anyway. The app only records what happened.
  if (intent === "stop") {
    if (caddie) {
      await supa
        .from("caddies")
        .update({ sms_opt_in: false, sms_opt_out_at: new Date().toISOString() })
        .eq("id", caddie.id);
    }
    return none(null, "opted out");
  }
  if (intent === "start") {
    if (caddie) {
      await supa
        .from("caddies")
        .update({
          sms_opt_in: true,
          sms_opt_out_at: null,
          sms_opt_in_at: new Date().toISOString(),
          sms_consent: "Replied START by text.",
        })
        .eq("id", caddie.id);
    }
    return none(null, "opted back in");
  }
  if (intent === "help") return none(null, "help");

  if (!caddie) {
    return none(
      "This number isn't on the Pasatiempo caddie roster. Please call the Pro Shop.",
      "unknown number",
    );
  }
  if (caddie.status !== "Active") {
    return none("Your caddie account isn't active. Please call the Pro Shop.", "inactive");
  }

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const nowMs = Date.now();

  const { data: rows } = await supa
    .from("assignments")
    .select(
      "id, offered_at, offer_expires_at, loops!inner(id, tee_time, player_name, loop_type, status, booking_id)",
    )
    .eq("caddie_id", caddie.id)
    .eq("confirmation_status", "Pending")
    .order("offered_at", { ascending: false });

  type Offer = {
    id: string;
    teeTime: string;
    playerName: string;
    loopType: string;
    bookingId: string | null;
  };
  const offers: Offer[] = [];
  for (const r of rows ?? []) {
    if (r.offer_expires_at && new Date(String(r.offer_expires_at)).getTime() <= nowMs) continue;
    const l = r.loops as unknown as {
      tee_time: string;
      player_name: string;
      loop_type: string;
      status: string;
      booking_id: string | null;
    };
    if (new Date(String(l.tee_time)).getTime() <= nowMs) continue;
    if (l.status === "Cancelled" || l.status === "Completed") continue;
    offers.push({
      id: String(r.id),
      teeTime: String(l.tee_time),
      playerName: String(l.player_name),
      loopType: String(l.loop_type),
      bookingId: l.booking_id ? String(l.booking_id) : null,
    });
  }

  const link = portalLink();
  if (intent === "unknown") {
    return none(
      offers.length > 0
        ? "Reply Y to take your offer or N to pass. For anything else, please call the Pro Shop."
        : `Nothing is waiting on an answer from you. Your loops are at ${link}`,
      "unrecognised",
    );
  }
  if (offers.length === 0) {
    return none(`Nothing is waiting on an answer from you right now. ${link}`, "no open offer");
  }

  // A reply answers the most recent offer. When that offer is one tee time in
  // a group, the whole group is what they were asked about: a Y takes the
  // first seat still open in it, an N passes on all of it.
  const latest = offers[0];
  const batch = latest.bookingId
    ? offers
        .filter((o) => o.bookingId === latest.bookingId)
        .sort((a, b) => a.teeTime.localeCompare(b.teeTime))
    : [latest];
  const others = offers.length - batch.length;
  const tail = others > 0 ? ` You have ${others} more offer${others === 1 ? "" : "s"} at ${link}` : "";

  const label = (o: Offer) =>
    `${new Date(o.teeTime).toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    })} ${formatTee(o.teeTime, tz)}, ${o.playerName} (${o.loopType})`;

  if (intent === "decline") {
    let declined: string | null = null;
    for (const o of batch) {
      const { data } = await supa.rpc("respond_to_offer", {
        p_assignment_id: o.id,
        p_accept: false,
        p_channel: "sms",
      });
      if ((data as { ok?: boolean } | null)?.ok) declined ??= o.id;
    }
    return {
      reply: `Passed on ${label(batch[0])}. Thanks for letting us know.${tail}`,
      outcome: declined ? "declined" : "decline failed",
      caddieId: String(caddie.id),
      assignmentId: declined,
    };
  }

  for (const o of batch) {
    const { data, error } = await supa.rpc("respond_to_offer", {
      p_assignment_id: o.id,
      p_accept: true,
      p_channel: "sms",
    });
    // An error here is the guard refusing a clash with another loop they hold.
    if (error) continue;
    if ((data as { ok?: boolean } | null)?.ok) {
      return {
        reply: `You're on: ${label(o)}. See you there. Can't make it? Hand it back at ${link}`,
        outcome: "accepted",
        caddieId: String(caddie.id),
        assignmentId: o.id,
      };
    }
  }
  return {
    reply: `Sorry, that loop has already been filled.${tail}`,
    outcome: "already filled",
    caddieId: String(caddie.id),
    assignmentId: null,
  };
}
