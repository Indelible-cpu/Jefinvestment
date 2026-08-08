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
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  loadExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
  deleteExpense: (id: string) => void;
  getTodayTotal: () => number;
}

export const useExpenseStore = create<ExpenseState>()(
  (set, get) => ({
    expenses: [],
    loadExpenses: async () => {
      const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
      onSnapshot(q, (snapshot) => {
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
        set({ expenses: mapped });
      }, (err) => {
        console.warn('Failed to load expenses from Firestore', err);
      });
    },
    addExpense: async (expense) => {
      const newExpense = {
        ...expense,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
      };
      await addDoc(collection(db, 'expenses'), newExpense);
    },
    deleteExpense: async (id) => {
      await deleteDoc(doc(db, 'expenses', id));
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
  addSale: (sale: Omit<SaleRecord, 'id' | 'date' | 'time' | 'status' | 'syncStatus'>) => Promise<void>;
  restoreStationeryMaterials: (saleId: string) => Promise<void>;
  updateSaleStatus: (id: string, status: 'completed' | 'refunded' | 'voided') => void;
  deleteSale: (id: string) => Promise<void>;
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
    loadSales: async () => {
      const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
      onSnapshot(q, (snapshot) => {
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
        set({ sales: mappedSales });
      }, (error) => {
        console.error('Failed to load sales from Firestore', error);
      });
    },
    addSale: async (sale) => {
      // Clean any undefined values from payload (Firestore throws error on undefined fields)
      const cleanedSale: Record<string, any> = {};
      Object.entries(sale).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedSale[key] = value;
        }
      });

      const newSale = {
        ...cleanedSale,
        createdAt: Date.now(),
        status: 'completed'
      };

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, newSale);

      // Decrement inventory automatically inside the same batch for atomic checkouts
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          if (!item.isService && item.productId) {
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

      await batch.commit();
    },
    restoreStationeryMaterials: async (saleId) => {
      try {
        const saleSnap = await getDoc(doc(db, 'sales', saleId));
        if (!saleSnap.exists()) return;
        const saleData = saleSnap.data();
        if (!saleData.isStationeryService || !Array.isArray(saleData.materialsConsumed)) return;

        const batch = writeBatch(db);
        for (const mat of saleData.materialsConsumed) {
          batch.update(doc(db, 'products', mat.productId), { stock: increment(mat.quantityUsed) });
        }
        await batch.commit();
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
          
          // If changing to refunded or voided from completed
          if ((newStatus === 'refunded' || newStatus === 'voided') && saleData.status !== newStatus) {
            if (Array.isArray(saleData.items)) {
              for (const item of saleData.items) {
                if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
                  for (const mat of item.materialsConsumed) {
                    const invRef = doc(db, 'products', mat.inventoryItemId || mat.productId);
                    const invDoc = await getDoc(invRef);
                    if (invDoc.exists()) {
                      await updateDoc(invRef, { stock: increment((mat.quantityPerUnit || 1) * item.quantity) });
                    }
                  }
                } else if (!item.isService && !item.isStationeryService) {
                  const invRef = doc(db, 'products', item.id || item.productId);
                  const invDoc = await getDoc(invRef);
                  if (invDoc.exists()) {
                    await updateDoc(invRef, { stock: increment(item.quantity) });
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
        }
        await updateDoc(doc(db, 'sales', id), { status: status.toLowerCase() });
      } catch (e) {
        console.error('Failed to update sale status', e);
      }
    },

    deleteSale: async (id) => {
      try {
        await deleteDoc(doc(db, 'sales', id));
      } catch (e) {
        console.error('Failed to delete sale', e);
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
  loadCredits: () => Promise<void>;
  addCredit: (credit: Omit<CreditRecord, 'id' | 'status' | 'paidAmount' | 'date'>) => void;
  recordRepayment: (id: string, amount: number) => void;
  getTotalOutstanding: () => number;
}

export const useCreditStore = create<CreditState>()(
  (set, get) => ({
    credits: [],
    loadCredits: async () => {
      const q = query(collection(db, 'sales'), where('isCredit', '==', true));
      onSnapshot(q, (snapshot) => {
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
        // Sort manually by date since we can't easily compound order by with inequality in Firestore without indexes we might not have
        mapped.sort((a, b) => b.date.localeCompare(a.date));
        set({ credits: mapped });
      }, (err) => {
        console.warn('Failed to load credits from Firestore', err);
      });
    },
    addCredit: async (credit) => {
      const newCredit = {
        ...credit,
        isCredit: true,
        creditPaid: 0,
        createdAt: Date.now(),
      };
      await addDoc(collection(db, 'sales'), newCredit);
    },
    recordRepayment: async (id, amount) => {
      await updateDoc(doc(db, 'sales', id), {
        creditPaid: increment(amount)
      });
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
  role: string;
  salary: number;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE';
  advancePay?: number;
}

interface EmployeeState {
  employees: Employee[];
  loadEmployees: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateStatus: (id: string, status: Employee['status']) => void;
  updateEmployee: (id: string, emp: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => void;
  recordAdvancePay: (id: string, amount: number, notes?: string) => Promise<void>;
  clearAdvancePay: (id: string) => Promise<void>;
  getActiveCount: () => number;
  getTotalAdvancePay: () => number;
}

export const useEmployeeStore = create<EmployeeState>()(
  (set, get) => ({
    employees: [],
    loadEmployees: async () => {
      onSnapshot(collection(db, 'employees'), (snapshot) => {
        const mapped = snapshot.docs.map(doc => {
          const e = doc.data();
          return {
            id: doc.id,
            firstName: e.firstName,
            lastName: e.lastName,
            phone: e.phone || '',
            role: e.role,
            salary: Number(e.salary) || 0,
            status: e.status || 'PRESENT',
            advancePay: Number(e.advancePay) || 0,
          };
        });
        set({ employees: mapped });
      }, (err) => {
        console.warn('Failed to load employees from Firestore', err);
      });
    },
    addEmployee: async (emp) => {
      await addDoc(collection(db, 'employees'), {
        ...emp,
        advancePay: 0,
        createdAt: Date.now()
      });
    },
    updateStatus: async (id, status) => {
      await updateDoc(doc(db, 'employees', id), { status });
    },
    updateEmployee: async (id, emp) => {
      await updateDoc(doc(db, 'employees', id), emp);
    },
    deleteEmployee: async (id) => {
      await deleteDoc(doc(db, 'employees', id));
    },
    recordAdvancePay: async (id, amount, notes) => {
      const emp = get().employees.find(e => e.id === id);
      if (!emp) return;

      // Update employee advance pay total
      await updateDoc(doc(db, 'employees', id), {
        advancePay: increment(amount)
      });

      // Automatically record as an expense for accounting
      await addDoc(collection(db, 'expenses'), {
        title: `Salary Advance: ${emp.firstName} ${emp.lastName}`,
        amount: Number(amount),
        category: 'Salary / Advance Pay',
        description: notes ? `Notes: ${notes}` : `Advance payment to ${emp.firstName} ${emp.lastName}`,
        paymentMethod: 'CASH',
        date: new Date().toISOString().slice(0, 10),
        loggedBy: 'System',
        createdAt: Date.now()
      });
    },
    clearAdvancePay: async (id) => {
      await updateDoc(doc(db, 'employees', id), {
        advancePay: 0
      });
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
    getTotalAdvancePay: () => get().employees.reduce((sum, e) => sum + (e.advancePay || 0), 0),
  })
);
