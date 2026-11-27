/* Pak Yood · Service Worker (offline-first)
   Naikkan VERSION setiap kali kamu mengganti index.html, supaya pengguna
   yang sudah memasang aplikasi mendapat tombol "Versi baru tersedia". */
const VERSION = 'v1';
const CACHE = 'pak-yood-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('pak-yood-') && k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

/* Tombol "Muat ulang" di aplikasi mengirim pesan ini */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === 'navigate' ? appShell(e) : staleWhileRevalidate(e));
    return;
  }
  /* Hanya font yang disimpan. Saweria, Apps Script, terjemahan, dll tetap lewat jaringan. */
  if (FONT_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(e));
});

/* Halaman utama: tampil langsung dari cache, diperbarui diam-diam di belakang layar */
async function appShell(e) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match('./index.html');
  const fresh = fetch('./index.html', { cache: 'no-cache' })
    .then((r) => { if (r && r.ok) cache.put('./index.html', r.clone()); return r; })
    .catch(() => null);
  if (cached) { e.waitUntil(fresh); return cached; }
  return (await fresh) || new Response('Sedang offline dan aplikasi belum tersimpan. Buka sekali saat online.', {
    status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function staleWhileRevalidate(e) {
  const req = e.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((r) => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; })
    .catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}
