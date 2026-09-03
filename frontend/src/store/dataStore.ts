import { create } from 'zustand';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy, 
  where,
  increment,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener, useAuthStore } from './authStore';

// ─── Expense Store ─────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  loggedBy: string;
  amount: number;
}

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
  loadExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
  deleteExpense: (id: string) => void;
  getTodayTotal: () => number;
}

export const useExpenseStore = create<ExpenseState>()(
  (set, get) => ({
    expenses: [],
    isLoading: false,
    loadExpenses: async () => {
      set({ isLoading: true });
      // Limit to last 90 days for performance
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const user = useAuthStore.getState().user;
      const branchId = user?.branchId || 'main';
      
      let q;
      // Admins can see all branches by default for now unless we add an active branch toggle.
      if (user?.role === 'ADMIN') {
        q = query(collection(db, 'expenses'), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'expenses'), where('branchId', '==', branchId), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'));
      }
      const unsub = onSnapshot(q, (snapshot) => {
        const mapped = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.date || new Date().toISOString().slice(0, 10),
            category: data.category || 'General',
            description: data.description,
            loggedBy: data.loggedBy || 'Admin',
            amount: Number(data.amount) || 0,
          };
        });
        set({ expenses: mapped, isLoading: false });
      }, (err) => {
        console.error('Failed to load expenses from Firestore', err);
        set({ isLoading: false });
      });
      registerListener(unsub);
    },
    addExpense: async (expense) => {
      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const newExpense = {
        ...expense,
        branchId,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
      };
      addDoc(collection(db, 'expenses'), newExpense).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    deleteExpense: async (id) => {
      deleteDoc(doc(db, 'expenses', id)).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    getTodayTotal: () => {
      const today = new Date().toISOString().slice(0, 10);
      return get().expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
    }
  })
);

// ─── Sales Store ───────────────────────────────────────────────────────────────
export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  cashier: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; costPrice?: number }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxName?: string;
  taxType?: string;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  status: 'completed' | 'refunded' | 'voided';
  syncStatus: 'synced' | 'pending';
  branch?: string;
  dueDate?: string;
  isCredit?: boolean;
  // Stationery service fields
  isStationeryService?: boolean;
  stationeryServiceId?: string;
  stationeryServiceName?: string;
  quantitySold?: number;
  materialCost?: number;
  laborCostTotal?: number;
  electricityCostTotal?: number;
  overheadCostTotal?: number;
  totalCost?: number;
  profit?: number;
  materialsConsumed?: Array<{ productId: string; name: string; quantityUsed: number; costPrice: number }>;
}

interface SaleState {
  sales: SaleRecord[];
  isLoading: boolean;
  addSale: (sale: Omit<SaleRecord, 'id' | 'date' | 'time' | 'status' | 'syncStatus'>) => Promise<void>;
  restoreStationeryMaterials: (saleId: string) => Promise<void>;
  updateSaleStatus: (id: string, status: 'completed' | 'refunded' | 'voided') => void;
  deleteSale: (id: string) => Promise<void>;
  clearOldSales: (cutoffDateStr: string) => Promise<void>;
  getTodaySales: () => SaleRecord[];
  getTodayCashTotal: () => number;
  getTodayCreditTotal: () => number;
  getTodayTransferTotal: () => number;
  getTodayTotal: () => number;
  loadSales: () => Promise<void>;
  syncPendingSales: () => Promise<void>;
}

export const useSaleStore = create<SaleState>()(
  (set, get) => ({
    sales: [],
    isLoading: false,
    loadSales: async () => {
      set({ isLoading: true });
      // Limit to last 90 days for performance — Reports page can query further back if needed
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const user = useAuthStore.getState().user;
      const branchId = user?.branchId || 'main';
      
      let q;
      if (user?.role === 'ADMIN') {
        q = query(collection(db, 'sales'), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'sales'), where('branchId', '==', branchId), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'));
      }
      const unsub_sales = onSnapshot(q, (snapshot) => {
        const mappedSales = snapshot.docs.map(doc => {
          const s = doc.data();
          const d = new Date(s.createdAt || Date.now());
          const rawStatus = (s.status || 'completed').toLowerCase() as SaleRecord['status'];
          return {
            id: doc.id,
            invoiceNumber: s.invoiceNumber,
            date: d.toISOString().slice(0, 10),
            time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            cashier: s.cashier || 'Unknown',
            items: s.items || [],
            subtotal: Number(s.subtotal),
            discount: Number(s.discount),
            taxAmount: Number(s.taxAmount || 0),
            taxName: s.taxName,
            taxType: s.taxType,
            total: Number(s.total),
            paymentMethod: s.paymentMethod || 'CASH',
            amountPaid: Number(s.amountPaid) || Number(s.total),
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            customerId: s.customerId,
            isCredit: s.isCredit || false,
            dueDate: s.dueDate,
            status: rawStatus,
            syncStatus: 'synced' as const,
            branch: s.branch,
          };
        });
        set({ sales: mappedSales, isLoading: false });
      }, (error) => {
        console.error('Failed to load sales from Firestore', error);
        set({ isLoading: false });
      });
      registerListener(unsub_sales);
    },
    addSale: async (sale) => {
      // Recursively remove any undefined values from payload (Firestore strictly throws on undefined fields)
      const sanitizeFirestoreData = (data: any): any => {
        if (data === null || data === undefined) return null;
        if (Array.isArray(data)) {
          return data.map(sanitizeFirestoreData).filter(item => item !== undefined);
        }
        if (typeof data === 'object' && !(data instanceof Date)) {
          const cleanObj: Record<string, any> = {};
          Object.entries(data).forEach(([key, val]) => {
            if (val !== undefined) {
              cleanObj[key] = sanitizeFirestoreData(val);
            }
          });
          return cleanObj;
        }
        return data;
      };

      const cleanedSale = sanitizeFirestoreData(sale);
      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const newSale: Record<string, any> = {
        ...cleanedSale,
        branchId,
        createdAt: Date.now(),
        status: 'completed'
      };
      
      if (cleanedSale.isCredit) {
        newSale.creditPaid = cleanedSale.amountPaid || 0;
      }

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, newSale);

      // Decrement inventory automatically inside the same batch for atomic checkouts
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          if (!item.isService && !item.isOther && item.productId && !item.productId.startsWith('other_') && !item.productId.startsWith('stationery_')) {
            const invRef = doc(db, 'products', item.productId);
            batch.update(invRef, { stock: increment(-item.quantity) });
          } else if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
            item.materialsConsumed.forEach((mat: any) => {
              const invRef = doc(db, 'products', mat.inventoryItemId || mat.productId);
              batch.update(invRef, { stock: increment(-(mat.quantityPerUnit || mat.quantityUsed || 1) * item.quantity) });
            });
          }
        });
      }

      // Do not await the commit so offline sales complete instantly in the UI
      // Firestore's local cache will queue it and sync when online
      batch.commit().catch(e => console.error('Sale sync deferred or failed:', e));
    },
    restoreStationeryMaterials: async (saleId) => {
      try {
        const saleSnap = await getDoc(doc(db, 'sales', saleId));
        if (!saleSnap.exists()) return;
        const saleData = saleSnap.data();

        const batch = writeBatch(db);
        let hasRestores = false;

        // Method 1: item-level materialsConsumed (new format)
        if (Array.isArray(saleData.items)) {
          for (const item of saleData.items) {
            if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
              for (const mat of item.materialsConsumed) {
                const invRef = doc(db, 'products', mat.inventoryItemId || mat.productId);
                const qty = (mat.quantityPerUnit || mat.quantityUsed || 1) * (item.quantity || 1);
                batch.update(invRef, { stock: increment(qty) });
                hasRestores = true;
              }
            }
          }
        }

        // Method 2: top-level materialsConsumed (legacy format)
        if (!hasRestores && saleData.isStationeryService && Array.isArray(saleData.materialsConsumed)) {
          for (const mat of saleData.materialsConsumed) {
            batch.update(doc(db, 'products', mat.productId), { stock: increment(mat.quantityUsed) });
            hasRestores = true;
          }
        }

        if (hasRestores) await batch.commit();
      } catch (e) {
        console.error('Failed to restore stationery materials', e);
      }
    },

    syncPendingSales: async () => {
      // No-op. Firestore syncs automatically.
    },
    updateSaleStatus: async (id, status) => {
      try {
        const saleDoc = await getDoc(doc(db, 'sales', id));
        if (saleDoc.exists()) {
          const saleData = saleDoc.data() as any;
          const newStatus = status.toLowerCase();
          const oldStatus = (saleData.status || 'completed').toLowerCase();
          
          // Case 1: Changing from completed to refunded or voided -> RESTORE stock
          if ((newStatus === 'refunded' || newStatus === 'voided') && oldStatus === 'completed') {
            if (Array.isArray(saleData.items)) {
              for (const item of saleData.items) {
                if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
                  for (const mat of item.materialsConsumed) {
                    const invRef = doc(db, 'products', mat.inventoryItemId || mat.productId);
                    const invDoc = await getDoc(invRef);
                    if (invDoc.exists()) {
                      updateDoc(invRef, { stock: increment((mat.quantityPerUnit || 1) * item.quantity) }).catch(e => console.warn('Offline write deferred or failed:', e));
                    }
                  }
                } else if (!item.isService && !item.isOther && !item.isStationeryService && item.productId && !item.productId.startsWith('other_')) {
                  const invRef = doc(db, 'products', item.id || item.productId);
                  const invDoc = await getDoc(invRef);
                  if (invDoc.exists()) {
                    updateDoc(invRef, { stock: increment(item.quantity) }).catch(e => console.warn('Offline write deferred or failed:', e));
                  }
                }
              }
            }
            if (saleData.isStationeryService && Array.isArray(saleData.materialsConsumed)) {
              const batch = writeBatch(db);
              for (const mat of saleData.materialsConsumed) {
                batch.update(doc(db, 'products', mat.productId), { stock: increment(mat.quantityUsed) });
              }
              await batch.commit();
            }
          }
          // Case 2: Changing from refunded or voided back to completed (UNDO) -> RE-DEDUCT stock
          else if (newStatus === 'completed' && (oldStatus === 'refunded' || oldStatus === 'voided')) {
            if (Array.isArray(saleData.items)) {
              for (const item of saleData.items) {
                if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
                  for (const mat of item.materialsConsumed) {
                    const invRef = doc(db, 'products', mat.inventoryItemId || mat.productId);
                    const invDoc = await getDoc(invRef);
                    if (invDoc.exists()) {
                      updateDoc(invRef, { stock: increment(-((mat.quantityPerUnit || 1) * item.quantity)) }).catch(e => console.warn('Offline write deferred or failed:', e));
                    }
                  }
                } else if (!item.isService && !item.isOther && !item.isStationeryService && item.productId && !item.productId.startsWith('other_')) {
                  const invRef = doc(db, 'products', item.id || item.productId);
                  const invDoc = await getDoc(invRef);
                  if (invDoc.exists()) {
                    updateDoc(invRef, { stock: increment(-item.quantity) }).catch(e => console.warn('Offline write deferred or failed:', e));
                  }
                }
              }
            }
            if (saleData.isStationeryService && Array.isArray(saleData.materialsConsumed)) {
              const batch = writeBatch(db);
              for (const mat of saleData.materialsConsumed) {
                batch.update(doc(db, 'products', mat.productId), { stock: increment(-mat.quantityUsed) });
              }
              await batch.commit();
            }
          }
        }
        updateDoc(doc(db, 'sales', id), { status: status.toLowerCase() }).catch(e => console.warn('Offline write deferred or failed:', e));
      } catch (e) {
        console.error('Failed to update sale status', e);
        throw e;
      }
    },

    deleteSale: async (id) => {
      try {
        deleteDoc(doc(db, 'sales', id)).catch(e => console.warn('Offline write deferred or failed:', e));
      } catch (e) {
        console.error('Failed to delete sale', e);
      }
    },

    clearOldSales: async (cutoffDateStr) => {
      try {
        const q = query(collection(db, 'sales'), where('date', '<', cutoffDateStr));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;
        
        // Filter out unpaid credit sales so they are not deleted
        const docsToDelete = snapshot.docs.filter(doc => {
          const data = doc.data();
          // If it's a credit sale, only delete it if it's fully paid (creditPaid >= total)
          if (data.isCredit) {
            const paid = Number(data.creditPaid) || 0;
            const total = Number(data.total) || 0;
            return paid >= total; // Delete only if fully paid
          }
          return true; // Not a credit sale, safe to delete
        });

        if (docsToDelete.length === 0) return;

        // Firestore batch can hold max 500 operations, chunk if needed
        const batchSize = 400;
        for (let i = 0; i < docsToDelete.length; i += batchSize) {
          const batch = writeBatch(db);
          docsToDelete.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.error('Failed to clear old sales', e);
        throw e;
      }
    },

    getTodaySales: () => {
      const today = new Date().toISOString().slice(0, 10);
      return get().sales.filter(s => s.date === today && s.status === 'completed');
    },
    getTodayCashTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0),
    getTodayCreditTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.total, 0),
    getTodayTransferTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.total, 0),
    getTodayTotal: () => get().getTodaySales().reduce((sum, s) => sum + s.total, 0),
  })
);

// ─── Credit Store ──────────────────────────────────────────────────────────────
export interface CreditRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  date: string;
  status: 'PENDING' | 'OVERDUE' | 'FULLY_PAID';
}

interface CreditState {
  credits: CreditRecord[];
  isLoading: boolean;
  loadCredits: () => Promise<void>;
  addCredit: (credit: Omit<CreditRecord, 'id' | 'status' | 'paidAmount' | 'date'>) => void;
  recordRepayment: (id: string, amount: number, method: string) => void;
  getTotalOutstanding: () => number;
}

export const useCreditStore = create<CreditState>()(
  (set, get) => ({
    credits: [],
    isLoading: false,
    loadCredits: async () => {
      set({ isLoading: true });
      const user = useAuthStore.getState().user;
      const branchId = user?.branchId || 'main';
      
      let q;
      if (user?.role === 'ADMIN') {
        q = query(collection(db, 'sales'), where('isCredit', '==', true));
      } else {
        q = query(collection(db, 'sales'), where('branchId', '==', branchId), where('isCredit', '==', true));
      }
      const unsub_credits = onSnapshot(q, (snapshot) => {
        const today = new Date().toISOString().slice(0, 10);
        const mapped = snapshot.docs.map(doc => {
          const c = doc.data();
          const totalAmount = Number(c.total);
          const paidAmount = Number(c.creditPaid) || 0;
          const dueDate = c.dueDate || '';
          
          let status: CreditRecord['status'] = 'PENDING';
          if (paidAmount >= totalAmount) status = 'FULLY_PAID';
          else if (dueDate && dueDate < today) status = 'OVERDUE';
          
          return {
            id: doc.id,
            invoiceNumber: c.invoiceNumber,
            customerName: c.customerName || 'Customer',
            customerPhone: c.customerPhone || '',
            totalAmount,
            paidAmount,
            dueDate,
            date: new Date(c.createdAt || Date.now()).toISOString().slice(0, 10),
            status,
          };
        });
        // Exclude voided or refunded credit sales from debt management
        const active = mapped.filter(r => {
          const rawStatus = snapshot.docs.find(d => d.id === r.id)?.data().status;
          return rawStatus !== 'voided' && rawStatus !== 'refunded';
        });
        // Sort manually by date since we can't easily compound order by with inequality in Firestore without indexes we might not have
        active.sort((a, b) => b.date.localeCompare(a.date));
        set({ credits: active, isLoading: false });
      }, (err) => {
        console.warn('Failed to load credits from Firestore', err);
        set({ isLoading: false });
      });
      registerListener(unsub_credits);
    },
    addCredit: async (credit) => {
      const newCredit = {
        ...credit,
        isCredit: true,
        creditPaid: 0,
        createdAt: Date.now(),
      };
      addDoc(collection(db, 'sales'), newCredit).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    recordRepayment: async (id, amount, method = 'CASH') => {
      updateDoc(doc(db, 'sales', id), {
        creditPaid: increment(amount),
        repayments: arrayUnion({
          amount,
          method,
          date: new Date().toISOString()
        })
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    getTotalOutstanding: () =>
      get().credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0),
  })
);

// ─── Employee Store ─────────────────────────────────────────────────────────────
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: string;
  salary: number;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE';
  advancePay?: number;
  branchId?: string;
  photoUrl?: string;
  idCardUrl?: string;
  idNumber?: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinPhone?: string;
  nextOfKinAddress?: string;
  address?: string;
  dateOfBirth?: string;
  dateJoined?: string;
  createdAt?: number;
}

interface EmployeeState {
  employees: Employee[];
  isLoading: boolean;
  loadEmployees: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<string | void>;
  updateStatus: (id: string, status: Employee['status']) => void;
  updateEmployee: (id: string, emp: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => void;
  recordAdvancePay: (id: string, amount: number, notes?: string) => Promise<void>;
  recordSalaryPay: (id: string, netAmount: number, notes?: string) => Promise<void>;
  clearAdvancePay: (id: string) => Promise<void>;
  getActiveCount: () => number;
  getTotalAdvancePay: () => number;
}

export const useEmployeeStore = create<EmployeeState>()(
  (set, get) => ({
    employees: [],
    isLoading: false,
    loadEmployees: async () => {
      set({ isLoading: true });
      const user = useAuthStore.getState().user;
      const branchId = user?.branchId || 'main';
      
      let q;
      if (user?.role === 'ADMIN') {
        q = collection(db, 'employees');
      } else {
        q = query(collection(db, 'employees'), where('branchId', '==', branchId));
      }
      
      const unsub_employees = onSnapshot(q, (snapshot) => {
        const mapped: Employee[] = snapshot.docs.map(doc => {
          const e = doc.data();
          return {
            id: doc.id,
            firstName: e.firstName || '',
            lastName: e.lastName || '',
            phone: e.phone || '',
            email: e.email || '',
            role: e.role || 'Staff',
            salary: Number(e.salary) || 0,
            status: e.status || 'PRESENT',
            advancePay: Number(e.advancePay) || 0,
            branchId: e.branchId || 'main',
            photoUrl: e.photoUrl || '',
            idCardUrl: e.idCardUrl || '',
            idNumber: e.idNumber || '',
            nextOfKinName: e.nextOfKinName || '',
            nextOfKinRelationship: e.nextOfKinRelationship || '',
            nextOfKinPhone: e.nextOfKinPhone || '',
            nextOfKinAddress: e.nextOfKinAddress || '',
            address: e.address || '',
            dateOfBirth: e.dateOfBirth || '',
            dateJoined: e.dateJoined || '',
            createdAt: e.createdAt || Date.now(),
          };
        });
        set({ employees: mapped, isLoading: false });
      }, (err) => {
        console.warn('Failed to load employees from Firestore', err);
        set({ isLoading: false });
      });
      registerListener(unsub_employees);
    },
    addEmployee: async (emp) => {
      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const docRef = await addDoc(collection(db, 'employees'), {
        ...emp,
        branchId,
        advancePay: emp.advancePay || 0,
        createdAt: Date.now()
      }).catch(e => {
        console.warn('Offline write deferred or failed:', e);
        return null;
      });
      return docRef ? docRef.id : undefined;
    },
    updateStatus: async (id, status) => {
      updateDoc(doc(db, 'employees', id), { status }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    updateEmployee: async (id, emp) => {
      updateDoc(doc(db, 'employees', id), emp).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    deleteEmployee: async (id) => {
      deleteDoc(doc(db, 'employees', id)).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    recordAdvancePay: async (id, amount, notes) => {
      const emp = get().employees.find(e => e.id === id);
      if (!emp) return;

      // Update employee advance pay total
      updateDoc(doc(db, 'employees', id), {
        advancePay: increment(amount)
      }).catch(e => console.warn('Offline write deferred or failed:', e));

      // Automatically record as an expense for accounting
      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const currentUser = useAuthStore.getState().user?.name || 'System';
      
      addDoc(collection(db, 'expenses'), {
        title: `Salary Advance: ${emp.firstName} ${emp.lastName}`,
        amount: Number(amount),
        category: 'Salary / Advance Pay',
        description: notes ? `Notes: ${notes}` : `Advance payment to ${emp.firstName} ${emp.lastName}`,
        paymentMethod: 'CASH',
        date: new Date().toISOString().slice(0, 10),
        loggedBy: currentUser,
        branchId,
        createdAt: Date.now()
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    clearAdvancePay: async (id) => {
      updateDoc(doc(db, 'employees', id), {
        advancePay: 0
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    recordSalaryPay: async (id, netAmount, notes) => {
      const emp = get().employees.find(e => e.id === id);
      if (!emp) return;

      // Reset advance pay since salary is settled
      updateDoc(doc(db, 'employees', id), {
        advancePay: 0
      }).catch(e => console.warn('Offline write deferred or failed:', e));

      // Automatically record as an expense
      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const currentUser = useAuthStore.getState().user?.name || 'System';
      
      addDoc(collection(db, 'expenses'), {
        title: `Salary Payment: ${emp.firstName} ${emp.lastName}`,
        amount: Number(netAmount),
        category: 'Salary / Advance Pay',
        description: notes ? `Notes: ${notes}` : `Net salary payment to ${emp.firstName} ${emp.lastName}`,
        paymentMethod: 'CASH',
        date: new Date().toISOString().slice(0, 10),
        loggedBy: currentUser,
        branchId,
        createdAt: Date.now()
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
    getTotalAdvancePay: () => get().employees.reduce((sum, e) => sum + (e.advancePay || 0), 0),
  })
);
