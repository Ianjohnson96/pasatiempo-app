import type { EventType, RosterStyle, Slot } from "./types";

export const TYPE_LABEL: Record<EventType, string> = {
  dinner: "Dinner / Social",
  clinic: "Clinic / Lesson",
  general: "General",
};

export function formatWhen(
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (!startsAt) return "Date TBD";
  const start = new Date(startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (endsAt) {
    const end = new Date(endsAt);
    const sameDay = start.toDateString() === end.toDateString();
    const endTime = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (sameDay) return `${dateStr} · ${timeStr} – ${endTime}`;
    return `${dateStr} ${timeStr} – ${end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })} ${endTime}`;
  }
  return `${dateStr} · ${timeStr}`;
}

function to12h(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

// A human label for one slot, e.g. "Sat, Jul 18 · 6:00 – 8:00 PM — Beginner".
export function formatSlot(slot: Slot): string {
  const parts: string[] = [];
  if (slot.date) {
    // parse as local date (avoid TZ shift on yyyy-mm-dd)
    const [y, mo, d] = slot.date.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    parts.push(
      dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    );
  }
  if (slot.startTime) {
    const t = slot.endTime
      ? `${to12h(slot.startTime)} – ${to12h(slot.endTime)}`
      : to12h(slot.startTime);
    parts.push(t);
  }
  const head = parts.join(" · ");
  if (slot.label) return head ? `${head} — ${slot.label}` : slot.label;
  return head || "Option";
}

export function rosterName(name: string, style: RosterStyle): string {
  const parts = name.trim().split(/\s+/);
  if (style === "first_initial" && parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  return name.trim();
}
