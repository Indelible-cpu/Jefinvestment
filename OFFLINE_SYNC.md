# Offline Synchronization Architecture

The **Jef Investment ERP** is engineered **Offline-First**, ensuring continuous Point of Sale (POS) operations even during internet outages.

---

## 1. Static Asset Caching (Vite PWA)

- Configured using `vite-plugin-pwa` and Service Workers.
- Caches all application bundles, styles, icons, and fonts locally.
- The web app loads instantly from cache even when the device is completely disconnected from the network.

---

## 2. Local State & Cache (Zustand + LocalStorage)

- Core application stores (`cartStore`, `authStore`, `settingsStore`, `dataStore`) persist critical operational state locally.
- Product catalog data and held carts remain accessible offline.

---

## 3. Offline Sales Queuing

- When a sale or expense is processed while offline:
  1. The transaction is immediately saved to local pending state.
  2. The Dashboard **Pending Syncs** indicator increments automatically.
  3. Visual toast alerts notify the cashier that the sale was saved locally and queued for upload.

---

## 4. Automatic Background Synchronization

- The application monitors network connectivity via browser online events (`window.addEventListener('online')`).
- When connectivity is restored, the sync engine automatically flushes queued transactions to Firestore in the background.
- Once successfully written to Firestore, local pending queues clear automatically.

---

## 5. Listener Safety on Logout

- If a user signs out while offline or upon reconnection, `unsubscribeAllListeners()` safely unbinds all active Firestore snapshot channels, preventing permission errors or stale state pollution.
