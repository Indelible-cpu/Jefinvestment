// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the Staff Portal is closed or in background

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyDQx0Jq6BglTBel-IqXAA_lo8BWNMA3IjQ',
  authDomain: 'jefinvestment-e1fc1.firebaseapp.com',
  projectId: 'jefinvestment-e1fc1',
  storageBucket: 'jefinvestment-e1fc1.firebasestorage.app',
  messagingSenderId: '1088168942774',
  appId: '1:1088168942774:web:dc5461bed599c344f3da17',
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (err) {
  console.warn('[FCM-SW] Failed to initialize firebase.messaging compat:', err);
}

// Handle background messages via Firebase SDK
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '🔔 MsikaFlo Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || '',
      icon: payload.notification?.icon || payload.data?.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.data?.tag || 'msikaflo-sale-' + Date.now(),
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: payload.data?.url || '/sales',
        timestamp: Date.now(),
        ...payload.data,
      },
      actions: [
        {
          action: 'open',
          title: 'View Details',
        }
      ],
      requireInteraction: true,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Fallback push event handler for raw web-push payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    console.log('[FCM-SW] Native push event data:', data);

    const title = data.notification?.title || data.title || '🔔 MsikaFlo Notification';
    const body = data.notification?.body || data.body || '';
    const targetUrl = data.data?.url || data.url || '/sales';

    const options = {
      body,
      icon: data.notification?.icon || data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.data?.tag || data.tag || 'msikaflo-' + Date.now(),
      data: {
        url: targetUrl,
        ...data.data,
      },
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('🔔 MsikaFlo', {
        body: text,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: '/sales' },
      })
    );
  }
});

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/sales';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
