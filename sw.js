
const CACHE_NAME = 'alshwaia-smart-v3.4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/metadata.json',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // لا تقم بمعالجة أي طلبات غير GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // تجاهل تام لطلبات Supabase و Google APIs لضمان مرورها عبر الشبكة الحقيقية فقط
  if (
    url.hostname.includes('supabase.co') || 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('esm.sh')
  ) {
    return; // السماح للمتصفح بالتعامل مع الطلب مباشرة دون تدخل SW
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // في حالة فشل الشبكة تماماً وعدم وجود كاش
        return new Response('Network error occurred', { status: 408 });
      });
    })
  );
});
