const CACHE_NAME = "aqua-super-final-v6-20260825-latest174";
const APP_SHELL = ["./", "./index.html", "./Aqua_Super.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => { if(event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => { const copy=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)); return resp; }).catch(()=>cached))); });
