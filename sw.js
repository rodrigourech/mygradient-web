// Service Worker der MyGradient-Web-App: App-Hülle und Schriften offline verfügbar.
// Daten (Neon Data API, Auth-Proxy) laufen immer übers Netz und werden hier nicht abgefangen.
const CACHE = "mygradient-1ed081ef1071";
const FONTS = "mygradient-fonts";
const SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mygradient-") && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netz zuerst (höchstens 4 s), sonst die gespeicherte App
function page(req) {
  const net = fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); }
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 4000)).then(() => caches.match("./"));
  return Promise.race([net.catch(() => caches.match("./")), slow.then((m) => m || net)]).then((r) => r || net);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") { e.respondWith(page(req)); return; }
    e.respondWith(caches.match(req).then((m) => m || fetch(req)));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((m) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => m || Response.error());
      return m || net;
    })));
  }
});
