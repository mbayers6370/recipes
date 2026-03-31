const STATIC_CACHE = "ab-ovo-static-v2";
const PAGE_CACHE = "ab-ovo-pages-v2";
const RUNTIME_CACHE = "ab-ovo-runtime-v2";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const activeCaches = new Set([STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE]);

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (activeCaches.has(key)) {
              return Promise.resolve();
            }

            return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ success: false, error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleNextStaticRequest(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleAssetRequest(request));
  }
});

async function handleNavigationRequest(request) {
  const pageCache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await pageCache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedPage = await pageCache.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    const offlinePage = await caches.match(OFFLINE_URL);

    return offlinePage || Response.error();
  }
}

async function handleAssetRequest(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await runtimeCache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        void runtimeCache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkFetch;
}

async function handleNextStaticRequest(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await runtimeCache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await runtimeCache.match(request);
    return cachedResponse || Response.error();
  }
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/i.test(pathname);
}
