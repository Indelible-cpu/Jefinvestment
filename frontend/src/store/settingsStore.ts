import { create } from 'zustand';

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener } from './authStore';

export interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  currency: string;
  airtelNumber?: string;
  mpambaNumber?: string;
  nbsDetails?: string;
  nbmDetails?: string;
  autoLockEnabled?: boolean;
  workTimeStart?: string;
  workTimeEnd?: string;
  idleLockMinutes?: number;
  updateSettings: (settings: Partial<CompanySettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<CompanySettings>()(
    (set) => ({
      companyName: 'Jef Investment Limited',
      address: 'P.O. Box 123, Blantyre, Malawi',
      phone: '+265 999 123 456',
      email: 'info@jefinvestment.com',
      taxNumber: 'TPIN-100234567',
      currency: 'MWK',
      airtelNumber: '+265 991 234 567',
      mpambaNumber: '+265 881 234 567',
      nbsDetails: 'NBS Bank - 1450001234567 - Blantyre Branch',
      nbmDetails: 'National Bank - 1005678901 - Custom Branch',
      autoLockEnabled: false,
      workTimeStart: '07:30',
      workTimeEnd: '17:30',
      idleLockMinutes: 10,
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
        const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            set((state) => ({ ...state, ...docSnap.data() }));
          }
        }, (error) => {
          console.error('Failed to load settings from Firestore', error);
        });
        registerListener(unsub);
      }
    })
);
