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
  increment
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
      try {
        const newExpense = {
          ...expense,
          date: new Date().toISOString().slice(0, 10),
          createdAt: Date.now(),
        };
        await addDoc(collection(db, 'expenses'), newExpense);
      } catch (err: any) {
        console.error('Failed to add expense', err);
        throw new Error('OFFLINE_QUEUED'); // UI expects this error string for offline indication
      }
    },
    deleteExpense: async (id) => {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (err: any) {
        console.error('Failed to delete expense', err);
        throw new Error('OFFLINE_QUEUED');
      }
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
}

interface SaleState {
  sales: SaleRecord[];
  addSale: (sale: Omit<SaleRecord, 'id' | 'date' | 'time' | 'status' | 'syncStatus'>) => Promise<void>;
  updateSaleStatus: (id: string, status: 'completed' | 'refunded' | 'voided') => void;
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
            total: Number(s.total),
            paymentMethod: s.paymentMethod || 'CASH',
            amountPaid: Number(s.amountPaid) || Number(s.total),
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            status: (s.status || 'completed').toLowerCase(),
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
      try {
        const newSale = {
          ...sale,
          createdAt: Date.now(),
          status: 'completed'
        };
        await addDoc(collection(db, 'sales'), newSale);
      } catch (err: any) {
        console.error('Failed to sync sale to Firestore', err);
        throw new Error('OFFLINE_QUEUED'); 
      }
    },
    syncPendingSales: async () => {
      // No-op. Firestore syncs automatically.
    },
    updateSaleStatus: async (id, status) => {
      try {
        await updateDoc(doc(db, 'sales', id), { status: status.toUpperCase() });
      } catch (e) {
        console.error('Failed to update sale status', e);
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
      try {
        const newCredit = {
          ...credit,
          isCredit: true,
          creditPaid: 0,
          createdAt: Date.now(),
        };
        await addDoc(collection(db, 'sales'), newCredit);
      } catch (err: any) {
        console.error('Failed to save credit', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },
    recordRepayment: async (id, amount) => {
      try {
        await updateDoc(doc(db, 'sales', id), {
          creditPaid: increment(amount)
        });
      } catch (err: any) {
        console.error('Failed to sync credit repayment', err);
        throw new Error('OFFLINE_QUEUED');
      }
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
}

interface EmployeeState {
  employees: Employee[];
  loadEmployees: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateStatus: (id: string, status: Employee['status']) => void;
  deleteEmployee: (id: string) => void;
  getActiveCount: () => number;
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
          };
        });
        set({ employees: mapped });
      }, (err) => {
        console.warn('Failed to load employees from Firestore', err);
      });
    },
    addEmployee: async (emp) => {
      try {
        await addDoc(collection(db, 'employees'), {
          ...emp,
          createdAt: Date.now()
        });
      } catch (err: any) {
        console.error('Failed to save employee', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },
    updateStatus: async (id, status) => {
      try {
        await updateDoc(doc(db, 'employees', id), { status });
      } catch (err: any) {
        console.error('Failed to sync employee status', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },
    deleteEmployee: async (id) => {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err: any) {
        console.error('Failed to delete employee', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
  })
);
