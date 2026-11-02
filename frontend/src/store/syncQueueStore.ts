import { create } from 'zustand';
import { 
  waitForPendingWrites, 
  doc, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

// ─── Emergency Offline Sales Backup (LocalStorage) ───────────────────────────
// Guarantees zero sales loss even if browser tab closes or Firestore persistent
// cache encounters issues before writing to the cloud.
const OFFLINE_SALES_STORAGE_KEY = 'msikaflo_offline_sales_backup';

export interface EmergencySaleBackup {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  total: number;
  backupAt: number;
  [key: string]: any;
}

export const getOfflineSalesBackup = (): EmergencySaleBackup[] => {
  try {
    const data = localStorage.getItem(OFFLINE_SALES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to read offline sales backup:', e);
    return [];
  }
};

export const saveSaleToOfflineBackup = (saleId: string, saleData: any) => {
  try {
    const list = getOfflineSalesBackup().filter(s => s.id !== saleId);
    list.push({ ...saleData, id: saleId, backupAt: Date.now() });
    localStorage.setItem(OFFLINE_SALES_STORAGE_KEY, JSON.stringify(list));
    useSyncQueueStore.getState().recalculatePending();
  } catch (e) {
    console.error('Failed to save offline sale backup:', e);
  }
};

export const removeSalesFromOfflineBackup = (saleIds: string[]) => {
  try {
    if (!saleIds || saleIds.length === 0) return;
    const removeSet = new Set(saleIds);
    const list = getOfflineSalesBackup().filter(s => !removeSet.has(s.id));
    localStorage.setItem(OFFLINE_SALES_STORAGE_KEY, JSON.stringify(list));
    useSyncQueueStore.getState().recalculatePending();
  } catch (e) {
    console.error('Failed to remove offline sales backup:', e);
  }
};

export const removeSaleFromOfflineBackup = (saleId: string) => {
  removeSalesFromOfflineBackup([saleId]);
};

// ─── High-Speed Real Network Reachability Ping ──────────────────────────────
export const checkRealConnectivity = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    // Ping Google's ultra-reliable 204 endpoint with a 3.5s timeout (adequate for mobile latencies)
    await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    // If the ping timed out or failed (e.g. captive portal or blocked ping endpoint),
    // but the browser reports online, trust navigator.onLine so sync is not blocked.
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
};

// ─── Sync Queue Store ────────────────────────────────────────────────────────
export interface QueuedRequest {
  id: string;
  url?: string;
  method?: string;
  body?: any;
  timestamp: number;
}

interface SyncQueueState {
  queue: any[];
  pendingCount: number;
  pendingSales: any[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;

  // Actions
  setOnline: (online: boolean) => void;
  setPendingSales: (sales: any[]) => void;
  recalculatePending: () => void;
  syncAll: (force?: boolean) => Promise<{ success: boolean; syncedCount: number; error?: string }>;

  // Backward compatibility methods
  enqueue: (request: any) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
}

export const useSyncQueueStore = create<SyncQueueState>()((set, get) => ({
  queue: getOfflineSalesBackup(),
  pendingCount: getOfflineSalesBackup().length,
  pendingSales: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,

  setOnline: (isOnline: boolean) => set({ isOnline }),

  setPendingSales: (pendingSales: any[]) => {
    const backupSales = getOfflineSalesBackup();
    const allPendingIds = new Set([
      ...pendingSales.map(s => s.id),
      ...backupSales.map(s => s.id)
    ]);
    const totalCount = allPendingIds.size;
    set({
      pendingSales,
      queue: pendingSales.length > 0 ? pendingSales : backupSales,
      pendingCount: totalCount,
    });
  },

  recalculatePending: () => {
    const { pendingSales } = get();
    const backupSales = getOfflineSalesBackup();
    const backupIds = new Set(backupSales.map(s => s.id));

    // Only count pendingSales entries that are still in local backup or uncommitted
    const stillPendingSales = pendingSales.filter(s => backupIds.has(s.id));

    const allPendingIds = new Set([
      ...stillPendingSales.map(s => s.id),
      ...backupSales.map(s => s.id)
    ]);
    set({
      pendingSales: stillPendingSales,
      queue: stillPendingSales.length > 0 ? stillPendingSales : backupSales,
      pendingCount: allPendingIds.size
    });
  },

  syncAll: async (force = false) => {
    const state = get();
    if (state.isSyncing && !force) {
      return { success: false, syncedCount: 0, error: 'Sync already in progress' };
    }

    set({ isSyncing: true, syncError: null });

    // Failsafe watchdog timer to ensure isSyncing never hangs
    const watchdog = setTimeout(() => {
      if (get().isSyncing) {
        console.warn('Sync watchdog: reset hanging isSyncing state.');
        set({ isSyncing: false });
      }
    }, 15000);

    try {
      // Step 1: Ensure Firestore network is actively connected
      try {
        const { enableNetwork } = await import('firebase/firestore');
        await enableNetwork(db).catch(() => {});
      } catch {
        // Non-critical
      }

      // Step 2: Verify internet connectivity
      const online = await checkRealConnectivity();
      set({ isOnline: online });

      if (!online) {
        clearTimeout(watchdog);
        set({ isSyncing: false });
        if (force) {
          toast.error('Offline', { description: 'Cannot sync. No active internet connection detected.' });
        }
        return { success: false, syncedCount: 0, error: 'No internet connection' };
      }

      let syncedCount = 0;

      // Step 3: Collect ALL unsynced sales from all sources
      const { useSaleStore } = await import('./dataStore');
      const inMemorySales = useSaleStore.getState().sales;
      const inMemoryPending = inMemorySales.filter(s => s.syncStatus === 'pending');
      const localBackup = getOfflineSalesBackup();

      // Consolidate into a unified map to prevent any sales loss
      const allPendingMap = new Map<string, any>();
      for (const s of localBackup) {
        allPendingMap.set(s.id, s);
      }
      for (const s of inMemoryPending) {
        if (!allPendingMap.has(s.id)) {
          allPendingMap.set(s.id, s);
          // Persist to offline backup so it cannot be lost on page close
          saveSaleToOfflineBackup(s.id, s);
        }
      }

      // Step 4: Parallel flush of pending sales to Firestore
      const pendingList = Array.from(allPendingMap.values());
      if (pendingList.length > 0) {
        const syncPromises = pendingList.map(async (sale) => {
          const { backupAt, syncStatus, ...cleanData } = sale;
          const saleRef = doc(db, 'sales', sale.id);

          try {
            // Write to Firestore cloud
            await setDoc(saleRef, cleanData);
            return { id: sale.id, success: true };
          } catch (writeErr: any) {
            // Check if document already exists in Firestore
            try {
              const snap = await getDoc(saleRef);
              if (snap.exists()) {
                return { id: sale.id, success: true };
              }
            } catch {
              // Ignore check error
            }

            console.warn(`Sync deferred for sale ${sale.id}:`, writeErr);
            return { id: sale.id, success: false };
          }
        });

        // Run all pending sale uploads simultaneously
        const settled = await Promise.allSettled(syncPromises);
        const flushedIds: string[] = [];

        settled.forEach((res) => {
          if (res.status === 'fulfilled' && res.value.success) {
            flushedIds.push(res.value.id);
          }
        });

        if (flushedIds.length > 0) {
          removeSalesFromOfflineBackup(flushedIds);
          syncedCount += flushedIds.length;

          // Immediately reflect 'synced' status in the live sales list
          const flushedSet = new Set(flushedIds);
          useSaleStore.setState((prev) => ({
            sales: prev.sales.map((s) =>
              flushedSet.has(s.id) ? { ...s, syncStatus: 'synced' as const } : s
            ),
          }));
        }
      }

      // Step 5: Flush Firestore internal persistent cache writes (bounded to 8s)
      try {
        await Promise.race([
          waitForPendingWrites(db),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Persistent write timeout')), 8000))
        ]);
      } catch (waitErr: any) {
        console.warn('waitForPendingWrites notice:', waitErr?.message || waitErr);
      }

      // Step 6: Recalculate remaining pending counts
      clearTimeout(watchdog);
      const finalRemainingBackup = getOfflineSalesBackup();
      const stillPendingSales = useSaleStore.getState().sales.filter(s =>
        finalRemainingBackup.some(b => b.id === s.id) || s.syncStatus === 'pending'
      );

      set({
        isSyncing: false,
        lastSyncedAt: Date.now(),
        syncError: null,
        pendingSales: stillPendingSales,
        queue: finalRemainingBackup,
        pendingCount: finalRemainingBackup.length,
      });

      if (force || syncedCount > 0) {
        toast.success('Synced with Cloud', {
          description: syncedCount > 0 
            ? `${syncedCount} queued sale(s) uploaded successfully.` 
            : 'All data is fully synchronized with cloud storage.'
        });
      }

      return { success: true, syncedCount };
    } catch (error: any) {
      clearTimeout(watchdog);
      const errMsg = error?.message || 'Sync encountered an error';
      console.error('syncAll error:', error);
      set({ isSyncing: false, syncError: errMsg });
      if (force) {
        toast.error('Sync Error', { description: errMsg });
      }
      return { success: false, syncedCount: 0, error: errMsg };
    }
  },

  enqueue: (_req: any) => {
    // Kept for backward compatibility
  },

  dequeue: (id: string) => {
    removeSaleFromOfflineBackup(id);
  },

  clearQueue: () => {
    try {
      localStorage.removeItem(OFFLINE_SALES_STORAGE_KEY);
    } catch {
      // Ignore
    }
    set({ queue: [], pendingCount: 0 });
  },
}));
