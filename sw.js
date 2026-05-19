/**
 * @fileoverview Service Worker cache manager handling high-performing offline assets,
 * preserving preceding cache namespaces side-by-side, and coordinating dynamic version rollbacks.
 */

const CACHE_NAME = 'notecalci_cache_v4';
const ASSETS = [
  'index.html',
  'style.css',
  'core/Lexer.js',
  'core/Parser.js',
  'core/OperatorDispatcher.js',
  'core/MathEngine.js',
  'ui/NotesManager.js',
  'ui/NotesSidebar.js',
  'ui/EditorWorkspace.js',
  'ui/CalculatorScreen.js'
];

// Dynamic calculations representing current and prior versioning parameters (eliminating hardcoding!)
const versionMatch = CACHE_NAME.match(/_v(\d+)/);
const currentVerNum = versionMatch ? parseInt(versionMatch[1], 10) : 3;

const CURRENT_VER = 'v' + currentVerNum; // e.g., "v4"
const PRIOR_VER = 'v' + (currentVerNum - 1); // e.g., "v3"

const PRIOR_CACHE_NAME = 'notecalci_cache_v' + (currentVerNum - 1);

// Dynamic pointer determining which cache storage is actively queried by the fetch listener
let targetedCacheName = CACHE_NAME;

// Explicit list of cache keys we preserve side-by-side to enable rollback actions (dynamically populated)
const RETAINED_CACHES = new Set([
  CACHE_NAME,
  PRIOR_CACHE_NAME
]);

// Install Event: pre-cache assets under CACHE_NAME
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('ServiceWorker: Pre-caching offline assets under:', CACHE_NAME);
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event: cleaner sweeps ONLY expired files that are not in our preserved list
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!RETAINED_CACHES.has(key)) {
            console.log('ServiceWorker: Safely purging non-retained cache key:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: intercepts requests, routing downloads dynamic based on targetedCacheName pointer
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(targetedCacheName).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // respond from targetedCacheName!
        }
        return fetch(e.request).catch(() => {
          console.warn('ServiceWorker: Fetch failed under offline parameters.');
        });
      });
    })
  );
});

// Message Event: coordinates skipWaiting activations, dynamic queries, and version toggles
self.addEventListener('message', (e) => {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  } else if (e.data && e.data.action === 'queryVersion') {
    const versionLabel = targetedCacheName === CACHE_NAME ? CURRENT_VER : PRIOR_VER;
    caches.has(PRIOR_CACHE_NAME).then((hasPrior) => {
      if (e.ports && e.ports[0]) {
        e.ports[0].postMessage({ 
          version: versionLabel, 
          current: CURRENT_VER, 
          prior: PRIOR_VER,
          hasPrior: hasPrior
        });
      }
    });
  } else if (e.data && e.data.action === 'rollback') {
    targetedCacheName = PRIOR_CACHE_NAME;
    console.log('ServiceWorker: Cache targeted pointer rolled back to prior version:', PRIOR_CACHE_NAME);
    if (e.ports && e.ports[0]) {
      e.ports[0].postMessage({ success: true, version: PRIOR_VER });
    }
  } else if (e.data && e.data.action === 'upgrade') {
    targetedCacheName = CACHE_NAME;
    console.log('ServiceWorker: Cache targeted pointer upgraded back to latest:', CACHE_NAME);
    if (e.ports && e.ports[0]) {
      e.ports[0].postMessage({ success: true, version: CURRENT_VER });
    }
  }
});
