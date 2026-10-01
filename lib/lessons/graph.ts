// Microsoft Graph, app-only. Reads Ian's Outlook calendar for the sync.
//
// Why Graph and not an ICS feed: a published Outlook calendar hands back
// events titled "Busy" with the subject stripped, and the subject is the only
// place the student's name appears. Graph skips the publishing layer entirely.
// That was tried and failed before - do not revisit it.
//
// Client-credentials flow, so it runs from a cron with nobody signed in. The
// app registration needs Calendars.Read as an APPLICATION permission with
// admin consent, and should then be narrowed to Ian's mailbox with an Exchange
// application access policy - otherwise those credentials can read every
// calendar in the tenant.

const TOKEN_HOST = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

export interface GraphEvent {
  uid: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  isCancelled: boolean;
}

export function graphConfigured(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_CLIENT_SECRET &&
      process.env.MS_LESSON_MAILBOX,
  );
}

async function accessToken(): Promise<string> {
  const tenant = process.env.MS_TENANT_ID!;
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`${TOKEN_HOST}/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    // Surface Microsoft's own error code. AADSTS700016 (app not found in this
    // tenant), AADSTS7000215 (wrong client secret) and AADSTS900023 (bad
    // tenant id) each point at a different fix, and "HTTP 400" points at none
    // of them. The body carries a code, timestamp and correlation id - it
    // never echoes the client secret back, so this is safe to surface.
    let detail = "";
    try {
      const body = (await res.json()) as {
        error?: string;
        error_description?: string;
      };
      const code = /AADSTS\d+/.exec(body.error_description ?? "")?.[0];
      detail = [body.error, code].filter(Boolean).join(" ");
      if (!detail) detail = (body.error_description ?? "").slice(0, 160);
    } catch {
      // Non-JSON error body - the status alone will have to do.
    }
    throw new Error(
      `Graph token request failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Graph returned no access token");
  return json.access_token;
}

/**
 * Every event in a window, expanded.
 *
 * calendarView rather than /events on purpose: /events returns a recurring
 * booking as ONE series master, while calendarView returns each occurrence
 * with its own id. A weekly lesson is many lessons, and the series master
 * would import as a single one.
 */
export async function fetchCalendarEvents(
  fromIso: string,
  toIso: string,
): Promise<GraphEvent[]> {
  if (!graphConfigured()) throw new Error("Microsoft Graph is not configured");

  const token = await accessToken();
  const mailbox = encodeURIComponent(process.env.MS_LESSON_MAILBOX!);
  const out: GraphEvent[] = [];

  let url =
    `${GRAPH}/users/${mailbox}/calendarView` +
    `?startDateTime=${encodeURIComponent(fromIso)}` +
    `&endDateTime=${encodeURIComponent(toIso)}` +
    `&$select=id,subject,start,end,isCancelled` +
    `&$top=200`;

  // Graph pages. Following nextLink matters: without it a busy year silently
  // stops at the first 200 events and the book looks complete when it is not.
  let guard = 0;
  while (url && guard++ < 50) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Without this the times arrive in the mailbox's own zone with no
        // offset attached, and everything lands hours out.
        Prefer: 'outlook.timezone="UTC"',
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `Graph calendarView failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }

    const page = (await res.json()) as {
      value?: {
        id: string;
        subject?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
        isCancelled?: boolean;
      }[];
      "@odata.nextLink"?: string;
    };

    for (const e of page.value ?? []) {
      if (!e.start?.dateTime || !e.end?.dateTime) continue;
      out.push({
        uid: e.id,
        subject: (e.subject ?? "").trim(),
        // With Prefer set, Graph returns naive UTC strings. Marking them as
        // UTC is what makes Postgres store the right instant.
        startsAt: new Date(`${e.start.dateTime}Z`).toISOString(),
        endsAt: new Date(`${e.end.dateTime}Z`).toISOString(),
        isCancelled: e.isCancelled === true,
      });
    }

    url = page["@odata.nextLink"] ?? "";
  }

  return out;
}
