/* Firebase Cloud Messaging — background handler
   This file MUST live at the site root and MUST be named
   firebase-messaging-sw.js (FCM looks for it by that exact path).      */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDHyCtrsZRDOpD1atTNxokAExsNcPx5yNI",
  authDomain: "victoreigns-7f54c.firebaseapp.com",
  projectId: "victoreigns-7f54c",
  storageBucket: "victoreigns-7f54c.firebasestorage.app",
  messagingSenderId: "985990288367",
  appId: "1:985990288367:web:fc4f309e9939cb77819c1a"
});

const messaging = firebase.messaging();

// Fired when a push arrives and the admin app is closed / in the background
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || payload.data || {};

  self.registration.showNotification(n.title || 'New order — VictorReigns', {
    body: n.body || 'You have a new order.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'vr-order',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/admin.html' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('admin') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/admin.html');
    })
  );
});
