# Offline Synchronization Architecture

Jef Investment ERP uses an **Offline-First** approach to ensure the Point of Sale and core operations continue functioning without internet access.

## Strategy

1. **Service Worker (Vite PWA):** 
   Caches all static assets (HTML, CSS, JS, images, fonts). This ensures the application frame loads instantly, even offline.

2. **Local Database (IndexedDB):**
   The frontend uses `idb` to maintain a local subset of critical data (Products, Categories) and the `sync_queue`.
   
3. **Mutation Queue (SyncEngine):**
   When a cashier performs an action (e.g., completes a sale, adds an expense) while offline, the frontend stores the transaction in the IndexedDB `sync_queue` with a status of `PENDING` and a unique `syncId`.

4. **Background Sync:**
   The `useSyncEngine` hook listens for the `online` window event. When the network is restored, it iterates through the `sync_queue` and pushes payloads to the respective REST API endpoints. If an API call succeeds, the item is removed from the queue. If it fails, the error is recorded and it remains in the queue for the next retry.

## Conflict Resolution
- Every queued transaction carries a client-side timestamp and a `syncId`.
- The backend Prisma schema enforces `syncId` uniqueness for Sales and Expenses. If the backend receives a transaction with an existing `syncId`, it idempotently ignores the request (or returns success without duplicating data), preventing double-billing during unstable network conditions.
