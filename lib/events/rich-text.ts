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
