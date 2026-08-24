import { create } from 'zustand';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener } from './authStore';

export interface Branch {
  id: string;
  name: string;
  location: string;
  phone?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: number;
}

interface BranchState {
  branches: Branch[];
  isLoading: boolean;
  loadBranches: () => Promise<void>;
  addBranch: (branch: Omit<Branch, 'id' | 'createdAt' | 'isActive'>) => Promise<void>;
  updateBranch: (id: string, data: Partial<Branch>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
}

export const useBranchStore = create<BranchState>()((set) => ({
  branches: [],
  isLoading: false,

  loadBranches: async () => {
    set({ isLoading: true });
    const q = collection(db, 'branches');
    const unsub = onSnapshot(q, (snapshot) => {
      const mapped: Branch[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          location: data.location || '',
          phone: data.phone || '',
          managerName: data.managerName || '',
          isActive: data.isActive !== false,
          createdAt: data.createdAt || 0,
        };
      });
      mapped.sort((a, b) => a.createdAt - b.createdAt);
      set({ branches: mapped, isLoading: false });
    }, (err) => {
      console.warn('Failed to load branches', err);
      set({ isLoading: false });
    });
    registerListener(unsub);
  },

  addBranch: async (branch) => {
    await addDoc(collection(db, 'branches'), {
      ...branch,
      isActive: true,
      createdAt: Date.now(),
    });
  },

  updateBranch: async (id, data) => {
    await setDoc(doc(db, 'branches', id), data, { merge: true });
  },

  deleteBranch: async (id) => {
    await deleteDoc(doc(db, 'branches', id));
  },
}));
