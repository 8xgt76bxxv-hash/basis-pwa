const CACHE = "basis-v2";
const SHELL = ["./", "./app.js", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Network first, cache as the fallback. Only this app's own files, inside
   this worker's scope, and only complete successful answers are kept - an
   error page or a partial response must never become what offline shows. */
const SCOPE = new URL(self.registration.scope);
function inScope(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (!inScope(url)) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, {ignoreSearch: req.mode === "navigate"})
        .then(hit => hit || (req.mode === "navigate" ? caches.match("./") : Response.error())))
  );
});
