import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  companyName: string;
  companyLogo: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  taxRate: number;
  taxName: string;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE';
  airtelNumber: string;
  mpambaNumber: string;
  nbsDetails: string;
  nbmDetails: string;
  quickActions: string[];
  updateSettings: (settings: Partial<Omit<SettingsState, 'updateSettings' | 'loadSettings'>>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

import api from '../utils/api';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      companyName: 'Jef Investment',
      companyLogo: '',
      address: 'Main Street, Branch 1',
      phone: '+265 999 000 000',
      email: 'info@jefinvestment.com',
      taxNumber: 'TPIN-12345678',
      taxRate: 16.5,
      taxName: 'VAT',
      taxType: 'EXCLUSIVE',
      airtelNumber: '',
      mpambaNumber: '',
      nbsDetails: '',
      nbmDetails: '',
      quickActions: ['new-sale', 'add-item', 'print-service', 'tech-service'],
      updateSettings: async (newSettings) => {
        set((state) => ({ ...state, ...newSettings }));
        const clientTxId = crypto.randomUUID();
        try {
          await api.post('/api/v1/settings', { ...newSettings, clientTxId });
        } catch (err: any) {
          console.error('Failed to sync settings to server', err);
          const { useSyncQueueStore } = await import('./syncQueueStore');
          useSyncQueueStore.getState().enqueue({
            id: clientTxId,
            url: '/api/v1/settings',
            method: 'POST',
            body: { ...newSettings, clientTxId },
          });
          throw new Error('OFFLINE_QUEUED');
        }
      },
      loadSettings: async () => {
        try {
          const res: any = await api.get('/api/v1/settings');
          if (res.data) {
            set((state) => ({ ...state, ...res.data }));
          }
        } catch (error) {
          console.error('Failed to load settings from server', error);
        }
      }
    }),
    {
      name: 'jef-settings-storage',
    }
  )
);
