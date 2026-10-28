const CACHE_NAME = "tapin-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./styles.css",
  "./admin.css",
  "./app.js",
  "./demo-runtime.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png"
];
const CONFIG_URL = new URL("./config.js", self.location.href).href;
const EXCLUDED_CACHE_PATHS = ["/admin.js"];

function isExcludedPath(pathname) {
  return EXCLUDED_CACHE_PATHS.some((path) => pathname.endsWith(path));
}

async function refreshConfig() {
  const response = await fetch(CONFIG_URL, { cache: "no-store" });
  const cache = await caches.open(CACHE_NAME);
  // Config is executable JavaScript. Parse only our JSON assignment, never evaluate it.
  // Cache a whitelist of public demo values, not arbitrary live configuration/secrets.
  let demoConfig = null;
  if (response.ok) {
    try {
      const text = await response.clone().text();
      const match = text.match(/^\s*window\.TAPIN_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
      const config = match ? JSON.parse(match[1]) : null;
      if (config && config.DEMO_MODE === true && config.GAS_WEB_APP_URL === "") {
        demoConfig = {
          DEMO_MODE: true,
          GAS_WEB_APP_URL: "",
          DEFAULT_OFFICE_STATIC_IP: String(config.DEFAULT_OFFICE_STATIC_IP || "203.0.113.10"),
          MAX_GPS_ACCURACY_METERS: Number(config.MAX_GPS_ACCURACY_METERS) || 120
        };
      }
    } catch (_error) {
      // A live/custom config is network-only, including configs that are not JSON.
    }
  }
  if (demoConfig) {
    await cache.put(CONFIG_URL, new Response("window.TAPIN_CONFIG = " + JSON.stringify(demoConfig) + ";\n", {
      headers: { "Content-Type": "application/javascript; charset=utf-8" }
    }));
  } else {
    await cache.delete(CONFIG_URL);
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    await refreshConfig();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("tapin-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || isExcludedPath(url.pathname)) return;

  if (url.href === CONFIG_URL) {
    event.respondWith(refreshConfig().catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(CONFIG_URL)) || Response.error();
    }));
    return;
  }

  // API endpoints and arbitrary same-origin resources must never enter the shell cache.
  const asset = ASSETS.some((path) => new URL(path, self.location.href).pathname === url.pathname);
  if (!asset && event.request.mode !== "navigate") return;

  event.respondWith(fetch(event.request, { cache: "no-store" }).then(async (response) => {
    if (asset && response.status === 200 && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (event.request.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  }));
});
