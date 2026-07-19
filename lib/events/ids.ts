import { randomBytes, randomUUID } from "crypto";

// Short opaque id for internal records.
export function newId(): string {
  return randomUUID();
}

// Turn a human label into a URL-safe slug: "Twilight Dinner!" -> "twilight-dinner".
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Unguessable URL token for an event's public link (~26 base32 chars of entropy).
// Lower-case, no ambiguous characters, so it copies/pastes and reads cleanly.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function newSlug(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  // group for readability: xxxx-xxxx-xxxx-xxxx
  return out.match(/.{1,4}/g)!.join("-");
}
