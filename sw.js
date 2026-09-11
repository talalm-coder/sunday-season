/* ============================================================
   SUPER SUNDAY — service worker
   Deploy this next to index.html at the root of the site, so it
   lives at https://your-app.vercel.app/sw.js
   Its only job is push. It deliberately does not cache anything,
   because caching a single 900KB HTML file would mean players
   sitting on a stale build without knowing it.
   ============================================================ */

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }

  const title = d.title || 'Super Sunday';
  const opts = {
    body:  d.body || '',
    icon:  d.icon || '/icon-192.png',
    badge: d.badge || '/icon-192.png',
    tag:   d.tag || 'super-sunday',        /* same tag replaces, never stacks */
    renotify: !!d.renotify,
    data:  { url: d.url || '/' },
    /* a short vibrate so it reads as a matchday alert, not an email */
    vibrate: d.silent ? undefined : [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      /* if the app is already open, focus it rather than opening a second copy */
      for (const c of list) {
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

/* Chrome can rotate a subscription without asking. When it does, the old
   endpoint stops working silently — so tell the server about the new one. */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(
        event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true });
      const cfg = await (await fetch('/push-config.json')).json().catch(() => null);
      if (!cfg) return;
      await fetch(cfg.subscribeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: cfg.anonKey },
        body: JSON.stringify({ old: event.oldSubscription && event.oldSubscription.endpoint, sub })
      });
    } catch (e) { /* nothing useful to do here */ }
  })());
});
