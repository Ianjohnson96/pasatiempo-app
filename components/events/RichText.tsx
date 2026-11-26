import React from "react";
import { parseRichText } from "@/lib/events/rich-text";

// Renders a tiny, SAFE markdown subset (no raw HTML injection):
//   **bold**            -> <strong>
//   line starting "# "  -> large heading
//   line starting "## " -> medium heading
//   line starting "- "  -> bulleted list (lib/events/rich-text.ts)
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

export default function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {parseRichText(text).map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h1":
          case "h2":
            return (
              <p key={key} className={`rt-${b.kind}`}>
                {inline(b.text, `${key}-`)}
              </p>
            );
          case "ul":
            return (
              <ul key={key} className="rt-ul">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${key}-${j}-`)}</li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={key} className="rt-p">
                {b.lines.map((ln, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(ln, `${key}-${j}-`)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
