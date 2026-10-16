// Self-unregistering service worker to cleanly retire any previous service worker registered on this origin/port (e.g., localhost:3000)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((client) => {
          if (client.url && "navigate" in client) {
            client.navigate(client.url);
          }
        });
      })
  );
});
