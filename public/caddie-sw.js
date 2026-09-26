/* Service worker for the caddie portal.
 *
 * Its only job is job alerts: wake on a push, show it, and put the caddie on
 * the loop when they tap. Deliberately no offline caching — a stale tee sheet
 * is worse than no tee sheet, and a caddie with no signal cannot accept a loop
 * anyway.
 */

self.addEventListener("install", () => {
  // Take over straight away rather than waiting for every tab to close; the
  // caddie just pressed a button and expects alerts to work now.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Pasatiempo Caddies";
  const options = {
    body: data.body || "A loop is available.",
    tag: data.tag || "caddie-job",
    // Replace rather than stack: five alerts about the same loop is noise.
    renotify: true,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: { url: data.url || "/caddie" },
    // Job offers are time-sensitive and often land before dawn, when the phone
    // is face down on a nightstand.
    requireInteraction: true,
    vibrate: [90, 60, 90],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/caddie";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse an open portal window if there is one, rather than piling up
        // duplicates every time an alert is tapped.
        for (const client of clients) {
          if (client.url.includes("/caddie") && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
