const CACHE_NAME = 'onesho-app-v1';
const urlsToCache = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    'https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&family=Outfit:wght@400;800&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
