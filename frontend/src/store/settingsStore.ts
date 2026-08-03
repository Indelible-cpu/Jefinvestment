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
  updateSettings: (settings: Partial<Omit<SettingsState, 'updateSettings' | 'loadSettings'>>) => void;
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
      updateSettings: (newSettings) => {
        set((state) => ({ ...state, ...newSettings }));
        // Sync to backend asynchronously
        api.post('/api/v1/settings', newSettings).catch(err => {
          console.error('Failed to sync settings to server', err);
        });
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
