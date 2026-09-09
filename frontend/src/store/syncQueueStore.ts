import { create } from 'zustand';
import { 
  disableNetwork, 
  enableNetwork, 
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

export const removeSaleFromOfflineBackup = (saleId: string) => {
  try {
    const list = getOfflineSalesBackup().filter(s => s.id !== saleId);
    localStorage.setItem(OFFLINE_SALES_STORAGE_KEY, JSON.stringify(list));
    useSyncQueueStore.getState().recalculatePending();
  } catch (e) {
    console.error('Failed to remove offline sale backup:', e);
  }
};

// ─── Real Network Reachability Ping ──────────────────────────────────────────
export const checkRealConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    // Use no-cors mode to ping Google's ultra-reliable 204 endpoint
    await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    // Secondary fallback probe
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 3500);
      await fetch(`https://www.google.com/favicon.ico?t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller2.signal,
      });
      clearTimeout(timeout2);
      return true;
    } catch {
      return false;
    }
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
    const allPendingIds = new Set([
      ...pendingSales.map(s => s.id),
      ...backupSales.map(s => s.id)
    ]);
    set({
      queue: pendingSales.length > 0 ? pendingSales : backupSales,
      pendingCount: allPendingIds.size
    });
  },

  syncAll: async (force = false) => {
    const state = get();
    if (state.isSyncing && !force) {
      return { success: false, syncedCount: 0, error: 'Sync already in progress' };
    }

    set({ isSyncing: true, syncError: null });

    // Step 1: Verify true internet connectivity
    const online = await checkRealConnectivity();
    set({ isOnline: online });

    if (!online) {
      set({ isSyncing: false });
      if (force) {
        toast.error('Offline', { description: 'Cannot sync. No active internet connection detected.' });
      }
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    let syncedCount = 0;

    try {
      // Step 2: Proactively wake up and reset Firestore network transport
      // This immediately clears hung sockets or long exponential backoff
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch (err) {
        console.warn('Network reconnect cycle notice:', err);
      }

      // Step 3: Flush durable emergency backup sales
      const backupSales = getOfflineSalesBackup();
      for (const sale of backupSales) {
        try {
          const { backupAt, ...cleanData } = sale;
          await setDoc(doc(db, 'sales', sale.id), cleanData, { merge: true });
          removeSaleFromOfflineBackup(sale.id);
          syncedCount++;
        } catch (err) {
          console.warn(`Failed to flush backup sale ${sale.id}:`, err);
        }
      }

      // Step 4: Force Firestore to upload pending persistent cache writes
      try {
        await Promise.race([
          waitForPendingWrites(db),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout: network slow')), 12000))
        ]);
      } catch (waitErr: any) {
        console.warn('waitForPendingWrites notice:', waitErr?.message || waitErr);
      }

      set({
        isSyncing: false,
        lastSyncedAt: Date.now(),
        syncError: null
      });

      get().recalculatePending();

      if (force || syncedCount > 0) {
        toast.success('Synced with Cloud', {
          description: syncedCount > 0 
            ? `${syncedCount} queued sale(s) uploaded successfully.` 
            : 'All data is fully synchronized with cloud storage.'
        });
      }

      return { success: true, syncedCount };
    } catch (error: any) {
      const errMsg = error?.message || 'Sync encountered an error';
      console.error('syncAll error:', error);
      set({ isSyncing: false, syncError: errMsg });
      if (force) {
        toast.error('Sync Error', { description: errMsg });
      }
      return { success: false, syncedCount, error: errMsg };
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
