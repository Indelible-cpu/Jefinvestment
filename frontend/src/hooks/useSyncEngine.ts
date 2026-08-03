import { useEffect, useState } from 'react';
import { getPendingSyncs, initDB } from '../lib/db';

export const useSyncEngine = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [pendingCount, setPendingCount] = useState(0);

  const checkPendingCount = async () => {
    const pending = await getPendingSyncs();
    setPendingCount(pending.length);
  };

  const processQueue = async () => {
    if (!navigator.onLine || syncStatus === 'SYNCING') return;
    
    const pending = await getPendingSyncs();
    if (pending.length === 0) return;

    setSyncStatus('SYNCING');
    const db = await initDB();

    for (const item of pending) {
      try {
        // Here we would dispatch the item.payload to the correct API endpoint
        // based on item.operation.
        // Mock API call for now:
        // await api.post('/sync', { operation: item.operation, payload: item.payload })
        
        // On success:
        item.status = 'SYNCING';
        await db.put('sync_queue', item); // In a real app we'd delete or mark completed
        
        await db.delete('sync_queue', item.id);
      } catch (error) {
        console.error('Failed to sync item', item.id, error);
        item.status = 'FAILED';
        item.error = (error as Error).message;
        await db.put('sync_queue', item);
      }
    }
    
    setSyncStatus('IDLE');
    checkPendingCount();
  };

  useEffect(() => {
    checkPendingCount();
    
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (isOnline) {
      processQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  return { isOnline, syncStatus, pendingCount, processQueue };
};
