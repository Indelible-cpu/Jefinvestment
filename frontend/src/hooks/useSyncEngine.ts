import { useEffect, useRef } from 'react';
import { useSyncQueueStore, checkRealConnectivity } from '../store/syncQueueStore';

export const useSyncEngine = () => {
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    pendingSales, 
    lastSyncedAt, 
    syncError, 
    setOnline, 
    syncAll 
  } = useSyncQueueStore();

  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;

  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;

  // Active Network Heartbeat & Background Auto-Sync Daemon
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runHeartbeat = async () => {
      const realOnline = await checkRealConnectivity();
      setOnline(realOnline);

      // If we are online and have pending writes or are not currently syncing, auto-flush!
      if (realOnline && pendingCountRef.current > 0 && !isSyncingRef.current) {
        syncAll().catch(e => console.warn('Auto-sync cycle notice:', e));
      }

      // Schedule next pulse: 6 seconds if offline or has pending writes, 25 seconds if fully idle
      const nextInterval = (!realOnline || pendingCountRef.current > 0) ? 6000 : 25000;
      timer = setTimeout(runHeartbeat, nextInterval);
    };

    // Initial check on mount
    runHeartbeat();

    // ─── Event-Driven Triggers (Immediate Reaction) ──────────────────────────
    const handleOnline = () => {
      setOnline(true);
      // Immediately flush upon network return without waiting for user prompt
      syncAll(false).catch(e => console.warn('Online event sync notice:', e));
    };

    const handleOffline = () => {
      setOnline(false);
    };

    // When the user opens the laptop lid, switches back to the tab, or unlocks mobile screen
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runHeartbeat();
      }
    };

    // When the browser window gets focus
    const handleFocus = () => {
      if (pendingCountRef.current > 0 && !isSyncingRef.current) {
        syncAll(false).catch(() => {});
      }
    };

    // Safety guard against accidentally closing the tab while sales are still in local cache
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCountRef.current > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsynced sales! Leaving now may cause synchronization delays.';
        return e.returnValue;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [setOnline, syncAll]);

  const syncStatus: 'IDLE' | 'SYNCING' | 'ERROR' = isSyncing ? 'SYNCING' : (syncError ? 'ERROR' : 'IDLE');

  return {
    isOnline,
    isSyncing,
    pendingCount,
    pendingSales,
    lastSyncedAt,
    syncStatus,
    syncAll,
    processQueue: syncAll // backward compatibility
  };
};
