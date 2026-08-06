import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SettingsState {
  companyName: string;
  companyLogo: string;
  currency: string;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      companyName: 'Jef Investment',
      companyLogo: '',
      currency: 'MWK',
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
        try {
          await setDoc(doc(db, 'settings', 'global'), newSettings, { merge: true });
        } catch (err: any) {
          console.error('Failed to sync settings to Firestore', err);
          throw new Error('OFFLINE_QUEUED');
        }
      },
      loadSettings: async () => {
        onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            set((state) => ({ ...state, ...docSnap.data() }));
          }
        }, (error) => {
          console.error('Failed to load settings from Firestore', error);
        });
      }
    }),
    {
      name: 'jef-settings-storage',
    }
  )
);
