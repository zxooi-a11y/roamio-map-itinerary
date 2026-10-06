// Minimal service worker. It exists so the browser treats the site as an installable app (which is what puts
// Roamio in the phone's Share menu). It caches nothing: trips and places always come fresh from the database.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // let the network handle everything
