import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

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
    (set, get) => ({
      queue: [],
      isSyncing: false,

      enqueue: (req) => {
        set((state) => ({
          queue: [...state.queue, { ...req, timestamp: Date.now() }],
        }));
      },

      dequeue: (id) => {
        set((state) => ({
          queue: state.queue.filter((q) => q.id !== id),
        }));
      },

      syncAll: async () => {
        const state = get();
        if (state.isSyncing || state.queue.length === 0) return;

        set({ isSyncing: true });

        // Sort by timestamp to preserve order
        const queueToProcess = [...state.queue].sort((a, b) => a.timestamp - b.timestamp);

        for (const req of queueToProcess) {
          try {
            if (req.method === 'POST') {
              await api.post(req.url, req.body);
            } else if (req.method === 'PUT') {
              await api.put(req.url, req.body);
            } else if (req.method === 'DELETE') {
              await api.delete(req.url);
            }
            // If successful, remove from queue
            get().dequeue(req.id);
          } catch (error: any) {
            console.error(`Sync failed for ${req.id}:`, error);
            // We break out of the loop if a request fails, so we don't process later requests
            // out of order.
            break;
          }
        }

        set({ isSyncing: false });
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
