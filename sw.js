/* Part 107 Ground School service worker.
   Cache-first for the shell so the app opens with no signal, then refreshes
   in the background. Version string changes whenever the page changes, which
   is what evicts the previous build. */
var V = "p107-f13115ef2571";
var ASSETS = ["./","./index.html","./manifest.webmanifest",
              "./icon-192.png","./icon-512.png","./icon-maskable.png","./apple-touch-icon.png"];
/* figures are cached on first view, not at install, to keep the install light */

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function(c){ return c.addAll(ASSETS).catch(function(){}); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k!==V) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   /* never touch fonts or faa.gov */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(V).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
