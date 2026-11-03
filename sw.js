const CACHE = 'sakina-v5';
const FILES = ['./', 'index.html', 'app.js', 'data.js', 'quran.json', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png', 'UthmanicHafs.woff2'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
// الشبكة أولاً ثم النسخة المحفوظة، حتى تعمل بدون إنترنت وتتحدّث تلقائياً
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cacheable = url.origin === location.origin || url.hostname.endsWith('hisnmuslim.com') || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  e.respondWith(
    fetch(e.request)
      .then((r) => { if (cacheable && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
// إشعار قادم من الخادم (يصل حتى والهاتف مقفل)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'سكينة';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'ذكرٌ يطمئن قلبك 🤍',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'sakina',
    renotify: true,
    data: { url: d.url || './' },
  }));
});
// عند الضغط على الإشعار: افتح التطبيق على المحتوى المطلوب
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate ? c.navigate(url).catch(() => {}) : null; return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
