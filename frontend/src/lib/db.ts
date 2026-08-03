import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface JefERPDB extends DBSchema {
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      sku: string;
      barcode?: string;
      sellingPrice: number;
      categoryId: string;
      isService: boolean;
    };
    indexes: { 'by-sku': string };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      operation: string; // e.g., 'CREATE_SALE'
      payload: any;
      status: 'PENDING' | 'SYNCING' | 'FAILED';
      timestamp: number;
      error?: string;
    };
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<JefERPDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<JefERPDB>('jef-erp-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('by-sku', 'sku');
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('by-status', 'status');
        }
      },
    });
  }
  return dbPromise;
};

export const addToSyncQueue = async (operation: string, payload: any) => {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('sync_queue', {
    id,
    operation,
    payload,
    status: 'PENDING',
    timestamp: Date.now()
  });
  
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-erp-data');
    } catch (e) {
      console.error('Background sync registration failed:', e);
    }
  }
  
  return id;
};

export const getPendingSyncs = async () => {
  const db = await initDB();
  return db.getAllFromIndex('sync_queue', 'by-status', 'PENDING');
};
