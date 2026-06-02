const CACHE = 'bible-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './bible-data.js',
  './manifest.json', './cover.jpeg',
  './icon-192.png', './icon-512.png', './icon-512-maskable.png',
  './fonts/gyeonggi-regular.woff', './fonts/gyeonggi-bold.woff'
];
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  // 네트워크 우선, 실패 시 캐시 (data/js 최신 유지)
  e.respondWith(
    fetch(e.request).then(res=>{
      const clone = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, clone)).catch(()=>{});
      return res;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
