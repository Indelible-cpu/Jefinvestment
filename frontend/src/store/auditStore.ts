import { create } from 'zustand';
import { collection, query, orderBy, onSnapshot, addDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore, registerListener } from './authStore';

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  user: string;
  timestamp: number;
}

interface AuditState {
  logs: AuditLog[];
  loadLogs: () => void;
  addLog: (action: string, details: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>()((set) => ({
  logs: [],
  loadLogs: () => {
    // Only load the latest 100 logs for performance
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const mapped = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action,
          details: data.details,
          user: data.user,
          timestamp: data.timestamp,
        } as AuditLog;
      });
      set({ logs: mapped });
    }, (err) => {
      console.warn('Failed to load audit logs', err);
    });
    registerListener(unsub);
  },
  addLog: async (action: string, details: string) => {
    const user = useAuthStore.getState().user?.name || 'System';
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        details,
        user,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('Failed to save audit log', err);
    }
  }
}));
