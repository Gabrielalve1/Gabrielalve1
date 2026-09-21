'use strict';
const CACHE='meu-dinheiro-diario-v8-1';
const FILES=['./','./index.html','./style.css?v=8','./engine.js?v=8','./app.js?v=8','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('meu-dinheiro')&&k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const cloned=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,cloned)));}
  return response;
 }).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return await caches.match('./index.html');return Response.error();}));
});
