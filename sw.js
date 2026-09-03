const CACHE_NAME = "aqua-super-pwa-v11-20260903-hide-install";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png"
];

const MOBILE_WIDTH_FIX = `
<style id="aqua-mobile-full-width-fix">
html,body{width:100%;max-width:none;overflow-x:hidden}
main{width:100%!important;max-width:none!important;margin:0!important;padding-left:0!important;padding-right:0!important}
#aquaGoogleDriveCard{margin-left:0!important;margin-right:0!important}
#aquaDailyBackupBox{margin-left:0!important;margin-right:0!important}
#aquaInstallBtn{display:none!important}
</style>`;

async function injectMobileWidthFix(response) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    const html = await response.text();
    if (html.includes("id=\"aqua-mobile-full-width-fix\"")) return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });

    const updated = html.replace(/<\/head>/i, MOBILE_WIDTH_FIX + "</head>");
    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.delete("content-length");
    return new Response(updated, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  } catch (e) {
    return response;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const isHtml = event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => injectMobileWidthFix(response))
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }

          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });

          return response;
        })
        .catch(() => cached);
    })
  );
});
