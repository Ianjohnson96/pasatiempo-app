// The event text boxes' small formatting language, as blocks to render:
//   "# " big heading · "## " heading · "- " (or "• ") list item
//   a blank line starts a new paragraph; other lines in a row join with breaks
// Inline **bold** is handled when the blocks are drawn (RichText.tsx).

export type RichBlock =
  | { kind: "h1" | "h2"; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] };

const ITEM = /^[-•]\s+/;

export function parseRichText(text: string): RichBlock[] {
  const out: RichBlock[] = [];
  let open: RichBlock | null = null; // the paragraph or list being added to

  for (const ln of text.split("\n")) {
    if (ln.trim() === "") {
      open = null;
    } else if (ln.startsWith("## ")) {
      out.push({ kind: "h2", text: ln.slice(3) });
      open = null;
    } else if (ln.startsWith("# ")) {
      out.push({ kind: "h1", text: ln.slice(2) });
      open = null;
    } else if (ITEM.test(ln)) {
      const item = ln.replace(ITEM, "");
      if (open?.kind === "ul") open.items.push(item);
      else out.push((open = { kind: "ul", items: [item] }));
    } else if (open?.kind === "p") {
      open.lines.push(ln);
    } else {
      out.push((open = { kind: "p", lines: [ln] }));
    }
  }
  return out;
}

export interface RichGroup {
  heading: string | null; // the "## " line that starts it; null for text before any
  boxed: boolean; // a heading with a list under it reads best as its own panel
  blocks: RichBlock[];
}

/** Blocks gathered under their "## " headings, for drawing as panels. */
export function groupRichBlocks(blocks: RichBlock[]): RichGroup[] {
  const groups: RichGroup[] = [];
  let cur: RichGroup | null = null;
  for (const b of blocks) {
    if (b.kind === "h2") {
      cur = { heading: b.text, boxed: false, blocks: [] };
      groups.push(cur);
    } else {
      if (!cur) groups.push((cur = { heading: null, boxed: false, blocks: [] }));
      cur.blocks.push(b);
    }
  }
  for (const g of groups) g.boxed = g.heading !== null && g.blocks.some((b) => b.kind === "ul");
  return groups;
}

const TIME_ITEM = /^\*\*(\d{1,2}(?::\d{2})?\s?(?:AM|PM|am|pm))\*\*\s*(?:[·—–-]\s*)?(.*)$/;

/** A bullet that starts with a bold time ("**7:30 AM** · Range opens"), split for a time column. */
export function timeItem(item: string): { time: string; rest: string } | null {
  const m = item.match(TIME_ITEM);
  return m ? { time: m[1], rest: m[2] } : null;
}
