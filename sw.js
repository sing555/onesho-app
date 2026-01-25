const CACHE_NAME = 'onesho-app-v6'; // Network First Update
const urlsToCache = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'firebase-config.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    'https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&family=Outfit:wght@400;800&display=swap'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // ネットワーク優先 (Network First) 戦略
    // 常に最新を優先し、失敗（オフライン）した時だけキャッシュを出す
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 成功したらキャッシュを更新
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // ネットワークがダメならキャッシュから出す
                return caches.match(event.request);
            })
    );
});
