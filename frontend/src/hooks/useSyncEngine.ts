import { useEffect, useState } from 'react';

// ─── Firebase Migration Notice ───────────────────────────────────────────────
// This file is now a stub because Firestore handles offline queueing natively.
// We just report network status to the UI.
// ─────────────────────────────────────────────────────────────────────────────

export const useSyncEngine = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // We can't directly read the Firestore pending write count easily without 
  // experimental APIs, so we just set these to idle/0 for the UI.
  const syncStatus = 'IDLE' as 'IDLE' | 'SYNCING' | 'ERROR';
  const pendingCount = 0; 

  const processQueue = async () => {
    // No-op, Firestore does this natively.
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncStatus, pendingCount, processQueue };
};
