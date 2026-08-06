// ─── Firebase Migration Notice ───────────────────────────────────────────────
// This file is now a stub. We used to use idb (IndexedDB) for offline queueing,
// but Firestore SDK now handles this natively with persistentLocalCache.
// ─────────────────────────────────────────────────────────────────────────────

export const initDB = async () => {
  return null;
};

export const addToSyncQueue = async (_operation: string, _payload: any) => {
  // No-op
  return crypto.randomUUID();
};

export const getPendingSyncs = async () => {
  return [];
};
