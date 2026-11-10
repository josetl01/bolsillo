/* Bolsillo · service worker (versión 20261111000557) */
const CACHE = 'bolsillo-20261111000557';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.json',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-180.png',
  'css/estilos.css?v=20261111000557',
  'js/app.js?v=20261111000557',
  'js/datos.js?v=20261111000557',
  'js/formularios.js?v=20261111000557',
  'js/graficos.js?v=20261111000557',
  'js/importar.js?v=20261111000557',
  'js/informes.js?v=20261111000557',
  'js/inversiones-datos.js?v=20261111000557',
  'js/inversiones.js?v=20261111000557',
  'js/ui.js?v=20261111000557',
  'js/vistas.js?v=20261111000557'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('bolsillo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Precios, divisas y fuentes: siempre a internet, nunca guardados aquí
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // La página: primero la versión más nueva; sin conexión, la guardada
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put('index.html', copia));
      return r;
    }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});