import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener } from './authStore';

export interface CompanySettings {
  companyName: string;
  companyLogo?: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  taxRate?: number;
  taxName?: string;
  taxType?: 'INCLUSIVE' | 'EXCLUSIVE';
  currency: string;
  airtelNumber?: string;
  mpambaNumber?: string;
  nbsDetails?: string;
  nbmDetails?: string;
  quickActions?: string[];
  autoLockEnabled?: boolean;
  workTimeStart?: string;
  workTimeEnd?: string;
  idleLockMinutes?: number;
  lastDataClearDate?: number;
  shopMapImage?: string;
  // Storefront & WhatsApp Commerce Settings
  storefrontEnabled?: boolean;
  storefrontWhatsApp?: string;
  storefrontBanner?: string;
  storefrontDeliveryFee?: number;
  storefrontMinOrder?: number;
  storefrontAbout?: string;
  // Daily Savings / Reserve Target Settings
  dailySavingsEnabled?: boolean;
  dailySavingsPercentage?: number;
  dailySavingsPurpose?: string;
  servingReminderMinutes?: number;
  updateSettings: (settings: Partial<CompanySettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<CompanySettings>()(
  persist(
    (set) => ({
      companyName: 'MsikaFlo Limited',
      companyLogo: '',
      address: 'P.O. Box 123, Blantyre, Malawi',
      phone: '+265 999 123 456',
      email: 'info@jefinvestment.com',
      taxNumber: 'TPIN-100234567',
      taxRate: 16.5,
      taxName: 'VAT',
      taxType: 'EXCLUSIVE',
      currency: 'MWK',
      airtelNumber: '+265 991 234 567',
      mpambaNumber: '+265 881 234 567',
      nbsDetails: 'NBS Bank - 1450001234567 - Blantyre Branch',
      nbmDetails: 'National Bank - 1005678901 - Custom Branch',
      quickActions: ['new-sale', 'add-item', 'print-service', 'tech-service'],
      autoLockEnabled: false,
      workTimeStart: '07:30',
      workTimeEnd: '17:30',
      idleLockMinutes: 10,
      storefrontEnabled: true,
      storefrontWhatsApp: '+265 999 123 456',
      storefrontBanner: '🛍️ Welcome to Jef Investment Online! Buy directly on WhatsApp for fast pickup or delivery.',
      storefrontDeliveryFee: 2500,
      storefrontMinOrder: 0,
      storefrontAbout: 'Your trusted partner for Stationery, Office Supplies, Printing, Electronics & Tech Services in Malawi.',
      dailySavingsEnabled: true,
      dailySavingsPercentage: 10,
      dailySavingsPurpose: 'Business Reserve & Emergency Fund',
      servingReminderMinutes: 10,
      updateSettings: async (newSettings) => {
        set((state) => ({ ...state, ...newSettings }));
        try {
          setDoc(doc(db, 'settings', 'global'), newSettings, { merge: true }).catch(e => console.warn('Offline write deferred or failed:', e));
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
    }),
    {
      name: 'msikaflo-settings-cache',
    }
  )
);
