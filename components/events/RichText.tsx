import React from "react";

// Renders a tiny, SAFE markdown subset (no raw HTML injection):
//   **bold**            -> <strong>
//   line starting "# "  -> large heading
//   line starting "## " -> medium heading
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
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length === 0) return;
    const key = `p${out.length}`;
    out.push(
      <p key={key} className="rt-p">
        {para.map((ln, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {inline(ln, `${key}-${li}-`)}
          </React.Fragment>
        ))}
      </p>,
    );
    para = [];
  };

  lines.forEach((ln) => {
    if (ln.trim() === "") {
      flush();
    } else if (ln.startsWith("## ")) {
      flush();
      out.push(
        <p key={`h${out.length}`} className="rt-h2">
          {inline(ln.slice(3), `h${out.length}-`)}
        </p>,
      );
    } else if (ln.startsWith("# ")) {
      flush();
      out.push(
        <p key={`h${out.length}`} className="rt-h1">
          {inline(ln.slice(2), `h${out.length}-`)}
        </p>,
      );
    } else {
      para.push(ln);
    }
  });
  flush();

  return <div className={className}>{out}</div>;
}
