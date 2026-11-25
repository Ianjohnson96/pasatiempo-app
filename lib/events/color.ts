// Small colour helpers for per-event looks: hex parsing, WCAG contrast, and
// nudging a colour lighter or darker. Pure — used on the server and in the
// editor alike.

/** "#abc" / "#AABBCC" (trimmed) → "#aabbcc"; anything else → null. */
export function parseHex(s: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return `#${h}`;
}

function rgb(hex: string): [number, number, number] {
  const h = parseHex(hex) ?? "#000000";
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Move a colour's HSL lightness by `deltaPct` points, clamped to 0–100. */
export function shiftLightness(hex: string, deltaPct: number): string {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const nl = Math.min(1, Math.max(0, l + deltaPct / 100));
  if (s === 0) return toHex(nl * 255, nl * 255, nl * 255);
  const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
  const p = 2 * nl - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return toHex(hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255);
}
