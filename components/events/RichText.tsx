import React from "react";
import {
  groupRichBlocks,
  parseRichText,
  timeItem,
  type RichBlock,
} from "@/lib/events/rich-text";

// Renders a tiny, SAFE markdown subset (no raw HTML injection):
//   **bold**            -> <strong>
//   line starting "# "  -> large heading
//   line starting "## " -> medium heading
//   line starting "- "  -> bulleted list (lib/events/rich-text.ts)
// A "## " heading with a list under it is drawn as its own panel, and a
// bullet starting with a bold time gets a time column.
//   blank line          -> paragraph break; consecutive plain lines join with <br>
// Used for event Description / What-to-know, edited via the toolbar in the admin.

function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={keyBase + i}>{part}</strong>
    ) : (
      <React.Fragment key={keyBase + i}>{part}</React.Fragment>
    ),
  );
}

function Block({ b, k }: { b: RichBlock; k: string }) {
  switch (b.kind) {
    case "h1":
    case "h2":
      // real headings under the section's h2, so screen readers can jump between them
      return <h3 className={`rt-${b.kind}`}>{inline(b.text, `${k}-`)}</h3>;
    case "ul": {
      const timed = b.items.map(timeItem);
      // a list that is mostly times lines its times up in a column
      const schedule = timed.filter(Boolean).length >= 2;
      return (
        <ul className={`rt-ul${schedule ? " rt-sched" : ""}`}>
          {b.items.map((it, j) => {
            const t = schedule ? timed[j] : null;
            return schedule ? (
              // untimed rows keep the text column, so everything lines up
              <li key={j} className="rt-timed">
                <span className="rt-time">{t?.time ?? ""}</span>
                <span>{inline(t ? t.rest : it, `${k}-${j}-`)}</span>
              </li>
            ) : (
              <li key={j}>{inline(it, `${k}-${j}-`)}</li>
            );
          })}
        </ul>
      );
    }
    default:
      return (
        <p className="rt-p">
          {b.lines.map((ln, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {inline(ln, `${k}-${j}-`)}
            </React.Fragment>
          ))}
        </p>
      );
  }
}

export default function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {groupRichBlocks(parseRichText(text)).map((g, i) => {
        const inner = (
          <>
            {g.heading !== null && (
              <h3 className="rt-h2">{inline(g.heading, `g${i}h-`)}</h3>
            )}
            {g.blocks.map((b, j) => (
              <Block key={j} b={b} k={`g${i}b${j}`} />
            ))}
          </>
        );
        return g.boxed ? (
          <div key={i} className="rt-panel">
            {inner}
          </div>
        ) : (
          <React.Fragment key={i}>{inner}</React.Fragment>
        );
      })}
    </div>
  );
}
