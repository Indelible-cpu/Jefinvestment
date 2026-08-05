import { create } from 'zustand';
import api from '../utils/api';

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
      try {
        const res: any = await api.get('/api/v1/expenses');
        if (res.data && Array.isArray(res.data)) {
          const mapped = res.data.map((e: any) => ({
            id: e.id,
            date: new Date(e.createdAt).toISOString().slice(0, 10),
            category: e.category?.name || 'General',
            description: e.description,
            loggedBy: e.user?.username || 'Admin',
            amount: Number(e.amount) || 0,
          }));
          set({ expenses: mapped });
        }
      } catch (err) {
        console.warn('Failed to load expenses from API', err);
      }
    },
    addExpense: async (expense) => {
      try {
        const res: any = await api.post('/api/v1/expenses', expense);
        const e = res.data;
        const newExpense: Expense = {
          id: e?.id || Date.now().toString(),
          date: new Date().toISOString().slice(0, 10),
          category: expense.category,
          description: expense.description,
          loggedBy: expense.loggedBy,
          amount: expense.amount,
        };
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));
      } catch (err) {
        console.error('Failed to add expense', err);
        // Optimistic fallback
        const newExpense: Expense = {
          ...expense,
          id: Date.now().toString(),
          date: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));
      }
    },
    deleteExpense: async (id) => {
      set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
      try {
        await api.delete(`/api/v1/expenses/${id}`);
      } catch (err) {
        console.error('Failed to delete expense', err);
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
      try {
        const res: any = await api.get('/api/v1/sales');
        if (!res.data) return;
        const mappedSales = res.data.map((s: any) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          date: new Date(s.createdAt).toISOString().slice(0, 10),
          time: new Date(s.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          cashier: s.user?.username || 'Unknown',
          items: (s.items || []).map((i: any) => ({ name: i.product?.name || 'Unknown', quantity: i.quantity, unitPrice: Number(i.unitPrice), discount: Number(i.discount || 0) })),
          subtotal: Number(s.subtotal),
          discount: Number(s.discount),
          taxAmount: 0,
          total: Number(s.total),
          paymentMethod: s.payments?.[0]?.method || 'CASH',
          amountPaid: Number(s.payments?.[0]?.amount) || Number(s.total),
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          status: (s.status || 'completed').toLowerCase(),
          syncStatus: 'synced' as const,
          branch: s.branch?.name,
        }));
        set({ sales: mappedSales });
      } catch (error) {
        console.error('Failed to load sales from API', error);
      }
    },
    addSale: async (sale) => {
      const now = new Date();
      const localId = `local-${Date.now()}`;
      const newSale: SaleRecord = {
        ...sale,
        id: localId,
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: 'completed',
        syncStatus: 'pending',
      };

      // Add optimistically
      set((state) => ({ sales: [newSale, ...state.sales] }));

      try {
        const res: any = await api.post('/api/v1/sales', { ...sale, syncId: localId });
        const serverId = res.data?.id || localId;
        // Replace local with server record
        set((state) => ({
          sales: state.sales.map(s => s.id === localId
            ? { ...s, id: serverId, syncStatus: 'synced' }
            : s)
        }));
      } catch (err) {
        console.error('Failed to sync sale to server', err);
        // Keep as pending — will retry on next syncPendingSales
      }
    },
    syncPendingSales: async () => {
      const pending = get().sales.filter(s => s.syncStatus === 'pending');
      if (pending.length === 0) return;
      for (const sale of pending) {
        try {
          const res: any = await api.post('/api/v1/sales', { ...sale, syncId: sale.id });
          const serverId = res.data?.id || sale.id;
          set((state) => ({
            sales: state.sales.map(s => s.id === sale.id ? { ...s, id: serverId, syncStatus: 'synced' } : s)
          }));
        } catch (err) {
          console.error('Failed to sync pending sale', sale.id, err);
        }
      }
    },
    updateSaleStatus: (id, status) => set((state) => ({
      sales: state.sales.map(s => s.id === id ? { ...s, status } : s)
    })),
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
      try {
        const res: any = await api.get('/api/v1/credits');
        if (res.data && Array.isArray(res.data)) {
          const today = new Date().toISOString().slice(0, 10);
          const mapped = res.data.map((c: any) => {
            const totalAmount = Number(c.total);
            const paidAmount = Number(c.creditPaid) || 0;
            const dueDate = c.dueDate ? new Date(c.dueDate).toISOString().slice(0, 10) : '';
            let status: CreditRecord['status'] = 'PENDING';
            if (paidAmount >= totalAmount) status = 'FULLY_PAID';
            else if (dueDate && dueDate < today) status = 'OVERDUE';
            return {
              id: c.id,
              invoiceNumber: c.invoiceNumber,
              customerName: c.customerName || 'Customer',
              customerPhone: c.customerPhone || '',
              totalAmount,
              paidAmount,
              dueDate,
              date: new Date(c.createdAt).toISOString().slice(0, 10),
              status,
            };
          });
          set({ credits: mapped });
        }
      } catch (err) {
        console.warn('Failed to load credits from API', err);
      }
    },
    addCredit: async (credit) => {
      const optimistic: CreditRecord = {
        ...credit,
        id: `local-${Date.now()}`,
        paidAmount: 0,
        status: 'PENDING',
        date: new Date().toISOString().slice(0, 10),
      };
      set((state) => ({ credits: [optimistic, ...state.credits] }));
      try {
        await api.post('/api/v1/credits', credit);
      } catch (err) {
        console.error('Failed to save credit to server', err);
      }
    },
    recordRepayment: async (id, amount) => {
      set((state) => ({
        credits: state.credits.map(c => {
          if (c.id !== id) return c;
          const newPaid = c.paidAmount + amount;
          return {
            ...c,
            paidAmount: newPaid,
            status: newPaid >= c.totalAmount ? 'FULLY_PAID' : c.status,
          };
        })
      }));
      try {
        await api.put(`/api/v1/credits/${id}/repay`, { amount, method: 'CASH' });
      } catch (err) {
        console.error('Failed to sync credit repayment', err);
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
      try {
        const res: any = await api.get('/api/v1/employees');
        if (res.data && Array.isArray(res.data)) {
          const mapped = res.data.map((e: any) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            phone: e.phone || '',
            role: e.role,
            salary: Number(e.salary) || 0,
            status: (e.attendances?.[0]?.status as any) || 'PRESENT',
          }));
          set({ employees: mapped });
        }
      } catch (err) {
        console.warn('Failed to load employees from API', err);
      }
    },
    addEmployee: async (emp) => {
      const localId = `local-${Date.now()}`;
      set((state) => ({ employees: [...state.employees, { ...emp, id: localId }] }));
      try {
        const res: any = await api.post('/api/v1/employees', emp);
        if (res.data?.id) {
          set((state) => ({
            employees: state.employees.map(e => e.id === localId ? { ...e, id: res.data.id } : e)
          }));
        }
      } catch (err) {
        console.error('Failed to sync employee to server', err);
      }
    },
    updateStatus: async (id, status) => {
      set((state) => ({
        employees: state.employees.map(e => e.id === id ? { ...e, status } : e)
      }));
      try {
        await api.put(`/api/v1/employees/${id}/status`, { status });
      } catch (err) {
        console.error('Failed to sync employee status', err);
      }
    },
    deleteEmployee: async (id) => {
      set((state) => ({ employees: state.employees.filter(e => e.id !== id) }));
      try {
        await api.delete(`/api/v1/employees/${id}`);
      } catch (err) {
        console.error('Failed to delete employee from server', err);
      }
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
  })
);
