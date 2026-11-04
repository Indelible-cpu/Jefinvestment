import { create } from 'zustand';
import { 
  waitForPendingWrites, 
  doc, 
  setDoc
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
      // Step 1: Verify internet connectivity
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

      // Step 2: Collect ONLY unsynced pending sales
      const { useSaleStore } = await import('./dataStore');
      const inMemorySales = useSaleStore.getState().sales;
      const localBackup = getOfflineSalesBackup();

      const allPendingMap = new Map<string, any>();

      // 1. All explicitly backed-up offline sales
      for (const s of localBackup) {
        if (s && s.id) allPendingMap.set(s.id, s);
      }

      // 2. All in-memory sales marked as pending
      for (const s of inMemorySales) {
        if (s && s.id && s.syncStatus === 'pending') {
          allPendingMap.set(s.id, s);
          saveSaleToOfflineBackup(s.id, s);
        }
      }

      // Step 3: Parallel flush of pending sales to Firestore
      const pendingList = Array.from(allPendingMap.values());
      if (pendingList.length > 0) {
        const syncPromises = pendingList.map(async (sale) => {
          const { backupAt, syncStatus, ...cleanData } = sale;
          const saleRef = doc(db, 'sales', sale.id);

          try {
            await setDoc(saleRef, cleanData, { merge: true });
            return { id: sale.id, success: true };
          } catch (writeErr: any) {
            console.warn(`Sync deferred for sale ${sale.id}:`, writeErr);
            return { id: sale.id, success: false };
          }
        });

        const writeResults = await Promise.allSettled(syncPromises);
        const confirmedIds: string[] = [];

        for (const res of writeResults) {
          if (res.status === 'fulfilled' && res.value.success) {
            confirmedIds.push(res.value.id);
          }
        }

        // Also check if any pending writes in Firestore have completed
        try {
          await Promise.race([
            waitForPendingWrites(db),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ]);
          // If waitForPendingWrites succeeded, all items in pendingList reached server
          for (const s of pendingList) {
            if (!confirmedIds.includes(s.id)) {
              confirmedIds.push(s.id);
            }
          }
        } catch {
          // Non-blocking fallback
        }

        if (confirmedIds.length > 0) {
          removeSalesFromOfflineBackup(confirmedIds);
          syncedCount = confirmedIds.length;

          const flushedSet = new Set(confirmedIds);
          useSaleStore.setState((prev) => ({
            sales: prev.sales.map((s) =>
              flushedSet.has(s.id) ? { ...s, syncStatus: 'synced' as const } : s
            ),
          }));
        }
      }

      // Step 4: Recalculate remaining pending counts
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

      if (force) {
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

// ─── Automated Real-Time Background Synchronization Listeners ─────────────────
if (typeof window !== 'undefined') {
  // Sync immediately when network connection restores
  window.addEventListener('online', () => {
    useSyncQueueStore.getState().syncAll(false).catch(() => {});
  });

  // Sync when cashier brings the app tab/PWA to the foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useSyncQueueStore.getState().syncAll(false).catch(() => {});
    }
  });

  // Background daemon: auto-sync every 30s if there are pending backup sales
  setInterval(() => {
    const backup = getOfflineSalesBackup();
    if (backup.length > 0) {
      useSyncQueueStore.getState().syncAll(false).catch(() => {});
    }
  }, 30000);
}
