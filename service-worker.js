const CACHE_NAME = 'streamer-video-cache-v2'; // Bumped version to invalidate old cache
const MAX_CACHE_SIZE_MB = 500;

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => clients.claim())
    );
});

async function enforceCacheLimit() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const MAX_ITEMS = 250;

    if (requests.length > MAX_ITEMS) {
        const toDelete = requests.slice(0, requests.length - MAX_ITEMS);
        for (const req of toDelete) {
            await cache.delete(req);
        }
        console.log(`[SW] Evicted ${toDelete.length} old video chunks.`);
    }
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // We ONLY intercept .ts (HLS) chunks here.
    // Intercepting MP4 Range requests (206) in a Service Worker often breaks 
    // native browser video seeking/scrubbing, causing infinite buffering.
    // The browser natively caches MP4 range requests very well in its memory anyway.
    if (url.pathname.endsWith('.ts')) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);

                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                try {
                    const fetchOptions = {
                        method: event.request.method,
                        headers: event.request.headers,
                        credentials: event.request.credentials,
                        signal: event.request.signal
                    };

                    const networkResponse = await fetch(event.request.url, fetchOptions);

                    if (networkResponse.ok && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        event.waitUntil(
                            (async () => {
                                await cache.put(event.request, responseToCache);
                                await enforceCacheLimit();
                            })()
                        );
                    }

                    return networkResponse;
                } catch (error) {
                    console.error('[SW] Fetch failed:', error);
                    throw error;
                }
            })()
        );
    }
});
