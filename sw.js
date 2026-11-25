const CACHE = 'trellica-v8';
const ASSETS = [
  './','./index.html','./manifest.json','./css/app.css',
  './js/db.js','./js/roles.js', './js/auth.js','./js/sync.js','./js/version.js', './js/app.js',
  './js/modules/students.js','./js/modules/subjects.js','./js/modules/attendance.js',
  './js/modules/gradebook.js','./js/modules/recitation.js','./js/modules/seating.js',
  './js/modules/grouper.js','./js/modules/peer.js','./js/modules/calendar.js',
  './js/modules/todo.js','./js/modules/behavior.js','./js/modules/sticky.js',
  './js/modules/reminders.js','./js/modules/qr.js','./js/modules/timer.js',
  './data/students-seed.json','./data/subjects-seed.json',
  './icons/icon-192.png','./icons/icon-512.png','./icons/favicon.ico','./icons/favicon-32.png','./icons/favicon-16.png','./icons/icon-180.png',
  './assets/logos/logo-full-blue.png','./assets/logos/logo-full-white.png',
  './assets/logos/logo-h-blue.png','./assets/logos/logo-h-white.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, c)); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res.ok && new URL(req.url).origin === self.location.origin) {
        const c = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, c));
      }
      return res;
    }).catch(() => cached);
  }));
});
