/* Bench Boss: Netball (V2) Service Worker */

const CACHE_NAME = "benchboss-v2-cache-v1";

// Keep this list in sync with files inside /benchboss-v2/
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./bb-netball.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./sw.js"
];

/**
 * Install: pre-cache the app shell
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate: clean up old Bench Boss caches + take control
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // remove old caches from prior SW versions or other Bench Boss variants
          const isBenchBoss = key.startsWith("benchboss");
          const isThisCache = key === CACHE_NAME;
          if (isBenchBoss && !isThisCache) return caches.delete(key);
        })
      );
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch strategy
 * - For navigations (HTML): Network-first, fallback to cache (better for updates)
 * - For everything else: Cache-first, fallback to network
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-first for navigation requests (index.html / routes)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);

        // Only cache GET responses that look valid
        if (req.method === "GET" && fresh && fresh.status === 200) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        // If offline and not cached, last resort: show index (keeps app opening)
        return caches.match("./index.html");
      }
    })()
  );
});

/**
 * Optional: allow the page to trigger an update immediately
 * In your page JS you could postMessage({type:"SKIP_WAITING"})
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});