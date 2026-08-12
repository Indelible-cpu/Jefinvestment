import { create } from 'zustand';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener } from './authStore';

// ─── Stationery Service Store ──────────────────────────────────────────────────

export interface MaterialEntry {
  inventoryItemId: string; // product ID from 'products' collection
  quantityPerUnit: number; // how many units of this material per 1 service unit (e.g. 1 sheet per page)
}

export interface StationeryService {
  id: string;
  serviceName: string;
  sellingPrice: number;    // per unit (page/copy/etc.)
  laborCost: number;       // per unit
  electricityCost: number; // per unit
  otherOverheadCost: number; // per unit
  equipmentCostPerUnit?: number; // per unit equipment wear & tear / maintenance allocation
  materialsUsed: MaterialEntry[];
}

interface StationeryState {
  services: StationeryService[];
  loadStationeryServices: () => void;
  addStationeryService: (svc: Omit<StationeryService, 'id'>) => Promise<void>;
  updateStationeryService: (id: string, svc: Partial<Omit<StationeryService, 'id'>>) => Promise<void>;
  deleteStationeryService: (id: string) => Promise<void>;
}

export const useStationeryStore = create<StationeryState>()((set) => ({
  services: [],

  loadStationeryServices: () => {
    const unsub = onSnapshot(collection(db, 'stationeryServices'), (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          serviceName: d.serviceName || '',
          sellingPrice: Number(d.sellingPrice) || 0,
          laborCost: Number(d.laborCost) || 0,
          electricityCost: Number(d.electricityCost) || 0,
          otherOverheadCost: Number(d.otherOverheadCost) || 0,
          equipmentCostPerUnit: Number(d.equipmentCostPerUnit) || 0,
          materialsUsed: Array.isArray(d.materialsUsed) ? d.materialsUsed : [],
        } as StationeryService;
      });
      set({ services: mapped });
    }, (err) => {
      console.warn('Failed to load stationery services', err);
    });
    registerListener(unsub);
  },

  addStationeryService: async (svc) => {
    await addDoc(collection(db, 'stationeryServices'), {
      ...svc,
      createdAt: Date.now(),
    });
  },

  updateStationeryService: async (id, svc) => {
    await updateDoc(doc(db, 'stationeryServices', id), svc);
  },

  deleteStationeryService: async (id) => {
    await deleteDoc(doc(db, 'stationeryServices', id));
  },
}));
