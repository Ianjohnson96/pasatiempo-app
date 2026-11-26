"use client";

import { useCallback, useState } from "react";
import { SPINNER_DELAY_MS, holdUntil } from "@/lib/events/busy";

export type SubmitPhase = "idle" | "busy" | "spin" | "done";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TICK_MS = 300;

/**
 * Runs a submission with honest feedback: the button keeps its label, a
 * spinner appears only if it takes over a second (and then stays at least
 * half a second), and success shows a tick before the page moves on.
 */
export function useSubmit() {
  const [phase, setPhase] = useState<SubmitPhase>("idle");

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, succeeded: (r: T) => boolean): Promise<T> => {
      setPhase("busy");
      let shownAt: number | null = null;
      const timer = setTimeout(() => {
        shownAt = Date.now();
        setPhase("spin");
      }, SPINNER_DELAY_MS);
      try {
        const result = await fn();
        clearTimeout(timer);
        await sleep(holdUntil(shownAt, Date.now()));
        if (succeeded(result)) {
          setPhase("done");
          await sleep(TICK_MS);
        }
        return result;
      } finally {
        clearTimeout(timer);
        setPhase("idle");
      }
    },
    [],
  );

  return { phase, busy: phase !== "idle", run };
}

export default function SubmitButton({
  phase,
  className = "btn",
  type = "submit",
  onClick,
  disabled,
  children,
}: {
  phase: SubmitPhase;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      className={`${className} submit-btn is-${phase}`}
      onClick={onClick}
      disabled={disabled || phase !== "idle"}
      aria-busy={phase === "busy" || phase === "spin"}
    >
      <span className="sb-label">{children}</span>
      <span className="sb-spin" aria-hidden />
      <svg className="sb-tick" viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span className="sr-only" role="status">
        {phase === "spin" ? "Sending…" : phase === "done" ? "Done" : ""}
      </span>
    </button>
  );
}
