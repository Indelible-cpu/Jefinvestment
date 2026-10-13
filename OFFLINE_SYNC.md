# Offline Synchronisation Architecture

**MsikaFlo** is engineered **Offline-First**, ensuring continuous Point of Sale operations even during complete internet outages.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Last updated:** October 2026

---

## 1. Static Asset Caching (Vite PWA + Workbox)

MsikaFlo uses `vite-plugin-pwa` with Workbox to pre-cache the entire application shell on first load.

- **Precache manifest:** 57 entries covering all JS/CSS bundles, fonts, icons, and static assets.
- **Supported asset types:** `.js`, `.css`, `.html`, `.woff2`, `.png`, `.svg`, `.jpg`, `.jpeg`, `.webp`
- **Cosmic background:** `cosmic-bg.webp` (52 KB, optimised WebP) is included in the Workbox `globPatterns` and pre-cached automatically on install.
- On repeat visits the app loads **instantly from cache** regardless of network state.

### Vite PWA `globPatterns` (relevant excerpt):
```js
globPatterns: ['**/*.{js,css,html,woff2,png,svg,jpg,jpeg,webp}']
```

---

## 2. Offline Credential Caching (SHA-256)

Users who have previously signed in can log in again **while fully offline**:

1. On successful online login the `authStore` computes a **SHA-256 hash** of the user's password and stores it alongside the user email in `localStorage`.
2. When `navigator.onLine` is `false` at login time, the system verifies the entered password against the stored SHA-256 hash locally.
3. On successful offline verification, cached user profile data (role, branch, display name) is restored from `localStorage`.
4. The offline session is flagged — the UI displays an offline indicator and certain network-dependent features (push notifications, live reports) are deferred until reconnection.
5. On reconnection, the system silently re-authenticates with Firebase to refresh the session token.

> **Security note:** SHA-256 credential hashes are stored only in the device's own `localStorage`. No hash is transmitted over the network or stored in Firestore.

---

## 3. Local State & Cache (Zustand + LocalStorage)

Core Zustand stores persist critical operational state locally between sessions:

| Store | Persisted Data |
|---|---|
| `authStore` | Current user profile, role, branch, SHA-256 credential hash |
| `cartStore` | Active POS cart items and product catalogue snapshot |
| `settingsStore` | Company settings, currency, payment account details |
| `dataStore` | Sales history snapshot, expense log, employee list |

Product catalogue data and held carts remain fully accessible and operable when offline.

---

## 4. Offline Sales Queuing

When a sale or expense is processed while the device is offline:

1. The transaction is immediately saved to a **local pending queue** in `localStorage`.
2. The Dashboard **Pending Syncs** counter increments automatically.
3. A toast notification informs the cashier the transaction has been saved locally and queued for upload.
4. The receipt can still be printed or shared from the pending queue.

---

## 5. Automatic Background Synchronisation

MsikaFlo monitors network connectivity in real time:

```
window.addEventListener('online', syncPendingTransactions)
```

When connectivity is restored:
1. The sync engine automatically flushes all queued transactions to Firestore.
2. Each successful write removes the transaction from the local pending queue.
3. The Pending Syncs counter decrements to zero.
4. A toast confirms synchronisation is complete.
5. All Firestore `onSnapshot` listeners resume and re-hydrate local state with the latest cloud data.

---

## 6. Held Carts — Cross-Device Synchronisation

Cashiers can hold a POS cart mid-transaction and resume it from any device:

- Held carts are saved to `users/{userId}/heldCarts` in Firestore.
- When online, held carts sync in real time across all logged-in devices at the same branch.
- When offline, held carts are preserved in the local Zustand cart store until connectivity returns.

---

## 7. Listener Safety on Logout

When a user signs out (whether online or offline):

- `unsubscribeAllListeners()` is called, which cleanly terminates every active Firestore `onSnapshot` subscription.
- This prevents permission errors, stale state leakage, and unnecessary background network activity after the session ends.
- All pending queues are preserved — they will be flushed on the next authorised login.

---

## 8. FCM Push Notifications (Online Only)

Firebase Cloud Messaging (FCM) delivers push notifications for:
- New online orders from the public storefront.
- Low-stock alerts crossing the reorder threshold.
- Password reset request notifications to Admins.

FCM operates exclusively while the device is online. Notifications received while offline are queued by the browser and delivered on reconnection (subject to browser PWA support).

---

## 9. PWA Installation & Offline Launch

MsikaFlo is installable as a Progressive Web App on Android:

1. Open MsikaFlo in Chrome.
2. Tap **Install** or **Add to Home Screen** from the browser menu.
3. After installation the app launches as a standalone fullscreen application.
4. All pre-cached assets load instantly without a network request.
5. The transparent status bar and safe-area insets are applied automatically in standalone PWA mode.
