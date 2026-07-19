"use client";

import { useEffect, useState } from "react";

// Renders the public event link and a one-click Copy button.
// The full URL is built client-side from window.location so it works on
// localhost, the deployed domain, or any preview host without configuration.
export default function CopyLink({
  slug,
  compact = false,
}: {
  slug: string;
  compact?: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin}/events/e/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked (e.g. insecure context) — fall back to selection
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="sharebox">
      <code title={url}>{origin ? url : `…/events/e/${slug}`}</code>
      <button
        type="button"
        className={`btn small ${compact ? "secondary" : ""}`}
        onClick={copy}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
