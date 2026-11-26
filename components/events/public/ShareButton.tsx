"use client";

import { useState } from "react";
import Icon from "@/components/events/Icon";

// "Share" for members passing the event to a partner or guest: the phone's
// own share sheet where there is one, otherwise the link is copied.
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // closing the share sheet is not an error worth showing
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="share-btn" onClick={share}>
      <Icon name={copied ? "check" : "share"} />
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
