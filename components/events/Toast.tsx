"use client";

import { useEffect } from "react";

// A small popup notification (auto-dismisses). Used for registration errors
// like the invite-only rejection message.
export default function Toast({
  message,
  onClose,
  tone = "error",
}: {
  message: string;
  onClose: () => void;
  tone?: "error" | "ok";
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div className="toast-wrap" role="alert">
      <div className={`toast ${tone}`}>
        <span className="toast-ico">{tone === "ok" ? "✓" : "!"}</span>
        <span className="toast-msg">{message}</span>
        <button
          type="button"
          className="toast-x"
          aria-label="Dismiss"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
