"use client";

import { useRef } from "react";

// A textarea with a small formatting toolbar. Inserts a safe markdown subset
// (**bold**, "# " large, "## " medium) that RichText renders on the public page.
export default function RichTextField({
  value,
  onChange,
  placeholder,
  minHeight = 90,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = value.slice(s, e) || "text";
    const next = value.slice(0, s) + marker + sel + marker + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + marker.length;
      ta.selectionEnd = s + marker.length + sel.length;
    });
  }

  function prefixLine(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    // if the line already has this prefix, toggle it off
    const rest = value.slice(lineStart);
    let next: string;
    let delta: number;
    if (rest.startsWith(prefix)) {
      next = value.slice(0, lineStart) + rest.slice(prefix.length);
      delta = -prefix.length;
    } else {
      // strip any other heading prefix first
      const stripped = rest.replace(/^#{1,2} /, "");
      const removed = rest.length - stripped.length;
      next = value.slice(0, lineStart) + prefix + stripped;
      delta = prefix.length - removed;
    }
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s + delta);
    });
  }

  return (
    <div>
      <div className="rt-toolbar">
        <button type="button" onClick={() => wrap("**")} title="Bold selected text">
          <b>B</b>
        </button>
        <button
          type="button"
          onClick={() => prefixLine("# ")}
          title="Make this line large"
        >
          A<span style={{ fontSize: 11 }}>+</span>
        </button>
        <button
          type="button"
          onClick={() => prefixLine("## ")}
          title="Make this line medium"
        >
          A<span style={{ fontSize: 9 }}>+</span>
        </button>
        <span className="rt-hint">
          Select text, then <b>B</b> for bold; A+ for a bigger line.
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight }}
      />
    </div>
  );
}
