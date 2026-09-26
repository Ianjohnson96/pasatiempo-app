"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/caddie/actions";

// "Turn on job alerts" — the one control that makes the portal worth keeping.
//
// Three things have to be true before a caddie can be reached, and each fails
// differently, so each gets its own honest message rather than a dead button:
//   1. the browser supports push at all
//   2. on iPhone, the portal has been added to the home screen
//   3. the caddie has granted permission

type State =
  | "checking"
  | "unsupported"
  | "needs-install" // iOS, not yet added to the home screen
  | "off"
  | "on"
  | "blocked";

export default function PushOptIn({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!vapidKey) {
        setState("unsupported");
        return;
      }

      const hasApi =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!hasApi) {
        // Safari on iOS exposes none of this until the site is installed, so
        // an iPhone that is not on the home screen lands here.
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const installed =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true;
        setState(iOS && !installed ? "needs-install" : "unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration("/caddie-sw.js");
      const existing = await reg?.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    }

    check().catch(() => {
      if (!cancelled) setState("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  async function turnOn() {
    if (!vapidKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.register("/caddie-sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      const res = await subscribeToPush({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState("on");
    } catch {
      setError("Could not turn alerts on. Try again, or ask the Pro Shop.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/caddie-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Could not turn alerts off.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;

  const box: React.CSSProperties = {
    marginTop: 18,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--panel)",
  };

  if (state === "on") {
    return (
      <div style={box}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ fontSize: 15 }}>
            <strong>Job alerts are on.</strong> You&apos;ll get a notification
            when a loop is posted.
          </span>
          <button className="btn ghost small" disabled={busy} onClick={turnOff}>
            Turn off
          </button>
        </div>
      </div>
    );
  }

  if (state === "needs-install") {
    return (
      <div style={box}>
        <strong style={{ fontSize: 15 }}>Get job alerts on this iPhone</strong>
        <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
          Tap the Share button at the bottom of Safari, choose{" "}
          <strong>Add to Home Screen</strong>, then open Caddies from your home
          screen and turn alerts on there. Apple only allows alerts from apps
          added this way.
        </p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div style={box}>
        <strong style={{ fontSize: 15 }}>Alerts are blocked</strong>
        <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
          Notifications are turned off for this site. Re-allow them in your
          browser settings, then come back to this page.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div style={box}>
        <strong style={{ fontSize: 15 }}>No job alerts on this device</strong>
        <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>
          This browser can&apos;t do notifications. Check this page for loops,
          or ask the Pro Shop to ring you.
        </p>
      </div>
    );
  }

  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Turn on job alerts</strong>
      <p className="muted" style={{ fontSize: 14, margin: "6px 0 10px" }}>
        Get a notification the moment a loop is posted, so you can claim it
        before anyone else.
      </p>
      {error && (
        <p className="notice err" style={{ marginTop: 0 }}>
          {error}
        </p>
      )}
      <button className="btn" disabled={busy} onClick={turnOn}>
        {busy ? "Turning on…" : "Turn on alerts"}
      </button>
    </div>
  );
}

/** VAPID keys travel as base64url; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  // Backed by a plain ArrayBuffer so it satisfies BufferSource; a bare
  // Uint8Array is generic over ArrayBufferLike and will not narrow.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
