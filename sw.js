/* Part 107 Ground School service worker.
   Shell: cache-first so the app opens with no signal, refreshed in the background. Its
   version changes whenever the page changes, which evicts the previous build's shell.
   Figures: a separate cache keyed to the figure files, filled one at a time when the page
   is idle (the page skips this on Save-Data), so they work offline before first view.
   Precache failures are logged and retried on activate and on every page load. */
var V = "p107-9d08febfc4d8";
var FV = "p107-figs-d0e9d48a7be1";
var ASSETS = ["./","./index.html","./manifest.webmanifest","./qb.json?v=26b02fb67c39",
              "./icon-192.png","./icon-512.png","./icon-maskable.png","./apple-touch-icon.png"];
var FIGS = ["fig02.jpg", "fig08.jpg", "fig12.jpg", "fig15.jpg", "fig20.jpg", "fig21.jpg", "fig22.jpg", "fig23.jpg", "fig24.jpg", "fig25.jpg", "fig26.jpg", "fig27.jpg", "fig31.jpg", "fig50.jpg", "fig59.jpg", "fig64.jpg", "fig69.jpg", "fig70.jpg", "fig71.jpg", "fig74.jpg", "fig75.jpg", "fig76.jpg", "fig77.jpg", "fig78.jpg", "fig80.jpg", "legend01.jpg", "legend02.jpg"].map(function(f){ return "./figs/" + f; });

function fill(cacheName, urls, oneAtATime){
  return caches.open(cacheName).then(function(c){
    var missing = [], failed = [];
    return Promise.all(urls.map(function(u){ return c.match(u).then(function(hit){ if(!hit) missing.push(u); }); }))
    .then(function(){
      var step = function(i){
        if(i >= missing.length) return Promise.resolve();
        var u = missing[i];
        return fetch(u, {cache: "no-cache"}).then(function(res){
          if(!res || !res.ok) throw new Error("HTTP " + (res && res.status));
          return c.put(u, res);
        }).catch(function(err){ failed.push(u); console.warn("[sw] precache failed", u, String(err)); })
        .then(function(){ return step(i + 1); });
      };
      if(oneAtATime) return step(0);
      return Promise.all(missing.map(function(u){
        return fetch(u, {cache: "no-cache"}).then(function(res){
          if(!res || !res.ok) throw new Error("HTTP " + (res && res.status));
          return c.put(u, res);
        }).catch(function(err){ failed.push(u); console.warn("[sw] precache failed", u, String(err)); });
      }));
    }).then(function(){ if(failed.length) console.warn("[sw] " + failed.length + " file(s) not cached yet; will retry"); return failed; });
  });
}

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(fill(V, ASSETS, false));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k !== V && k !== FV) return caches.delete(k); }));
  }).then(function(){ return fill(V, ASSETS, false); })          /* retry anything install missed */
    .then(function(){ return self.clients.claim(); }));
});

/* the page sends "warm" once it is idle: top up the shell, then the figures, one at a time */
self.addEventListener("message", function(e){
  if(!e.data || e.data.type !== "warm") return;
  var job = fill(V, ASSETS, false).then(function(){ return fill(FV, FIGS, true); });
  if(e.waitUntil) e.waitUntil(job);
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   /* never touch fonts or faa.gov */
  if(url.pathname.indexOf("/figs/") >= 0){
    /* figures never change within a figure version: cache first, fill on miss */
    e.respondWith(caches.open(FV).then(function(c){
      return c.match(req, {ignoreSearch: true}).then(function(hit){
        return hit || fetch(req).then(function(res){ if(res && res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }
  /* the question bank is keyed by its version query: never answer one version with another */
  var exact = url.pathname.slice(-8) === "/qb.json";
  e.respondWith(
    caches.match(req, {ignoreSearch: !exact}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.status === 200){
          var copy = res.clone();
          caches.open(V).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined); });
      return hit || net;
    })
  );
});
