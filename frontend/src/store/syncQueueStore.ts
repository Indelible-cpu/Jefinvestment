import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Firebase Migration Notice ───────────────────────────────────────────────
// This file is now a stub because Firestore handles offline queueing natively 
// via persistentLocalCache. The API and structure are preserved so that 
// UI components using it don't break.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  timestamp: number;
}

interface SyncQueueState {
  queue: QueuedRequest[];
  isSyncing: boolean;
  enqueue: (request: Omit<QueuedRequest, 'timestamp'>) => void;
  dequeue: (id: string) => void;
  syncAll: () => Promise<void>;
  clearQueue: () => void;
}

export const useSyncQueueStore = create<SyncQueueState>()(
  persist(
    (set) => ({
      queue: [],
      isSyncing: false,

      enqueue: (_req) => {
        // No-op for Firestore
        // console.log('Mock enqueue, Firestore handles this natively');
      },

      dequeue: (_id) => {
        // No-op
      },

      syncAll: async () => {
        // No-op
      },

      clearQueue: () => {
        set({ queue: [] });
      },
    }),
    {
      name: 'jims-sync-queue',
    }
  )
);
