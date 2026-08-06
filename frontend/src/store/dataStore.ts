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
      const clientTxId = crypto.randomUUID();
      try {
        const res: any = await api.post('/api/v1/expenses', { ...expense, clientTxId });
        const e = res.data;
        const newExpense: Expense = {
          id: e?.id || clientTxId,
          date: new Date().toISOString().slice(0, 10),
          category: expense.category,
          description: expense.description,
          loggedBy: expense.loggedBy,
          amount: expense.amount,
        };
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));
      } catch (err: any) {
        console.error('Failed to add expense', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: '/api/v1/expenses',
          method: 'POST',
          body: { ...expense, clientTxId },
        });
        const newExpense: Expense = {
          ...expense,
          id: clientTxId,
          date: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));
        throw new Error('OFFLINE_QUEUED');
      }
    },
    deleteExpense: async (id) => {
      const clientTxId = crypto.randomUUID();
      try {
        await api.delete(`/api/v1/expenses/${id}`);
        set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
      } catch (err: any) {
        console.error('Failed to delete expense', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: `/api/v1/expenses/${id}`,
          method: 'DELETE',
        });
        set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
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
      const clientTxId = crypto.randomUUID(); // Requires window.crypto

      try {
        await api.post('/api/v1/sales', { ...sale, clientTxId });
        // The server was successful. We refresh the sales list immediately.
        get().loadSales();
      } catch (err: any) {
        console.error('Failed to sync sale to server', err);
        // Queue the transaction offline
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: '/api/v1/sales',
          method: 'POST',
          body: { ...sale, clientTxId },
        });
        
        // Let the UI know it was queued instead of failing completely
        throw new Error('OFFLINE_QUEUED'); 
      }
    },
    syncPendingSales: async () => {
      // Logic moved to syncQueueStore.ts, but we keep the stub if components still call it
      const { useSyncQueueStore } = await import('./syncQueueStore');
      await useSyncQueueStore.getState().syncAll();
      get().loadSales();
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
      const clientTxId = crypto.randomUUID();
      const payload = { ...credit, clientTxId };
      try {
        const res: any = await api.post('/api/v1/credits', payload);
        const optimistic: CreditRecord = {
          ...credit,
          id: res.data?.id || clientTxId,
          paidAmount: 0,
          status: 'PENDING',
          date: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({ credits: [optimistic, ...state.credits] }));
      } catch (err: any) {
        console.error('Failed to save credit to server', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: '/api/v1/credits',
          method: 'POST',
          body: payload,
        });
        const optimistic: CreditRecord = {
          ...credit,
          id: clientTxId,
          paidAmount: 0,
          status: 'PENDING',
          date: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({ credits: [optimistic, ...state.credits] }));
        throw new Error('OFFLINE_QUEUED');
      }
    },
    recordRepayment: async (id, amount) => {
      const clientTxId = crypto.randomUUID();
      const payload = { amount, method: 'CASH', clientTxId };
      try {
        await api.put(`/api/v1/credits/${id}/repay`, payload);
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
      } catch (err: any) {
        console.error('Failed to sync credit repayment', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: `/api/v1/credits/${id}/repay`,
          method: 'PUT',
          body: payload,
        });
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
      const clientTxId = crypto.randomUUID();
      const payload = { ...emp, clientTxId };
      try {
        const res: any = await api.post('/api/v1/employees', payload);
        if (res.data?.id) {
          set((state) => ({
            employees: [...state.employees, { ...emp, id: res.data.id }]
          }));
        }
      } catch (err: any) {
        console.error('Failed to sync employee to server', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: '/api/v1/employees',
          method: 'POST',
          body: payload,
        });
        set((state) => ({
          employees: [...state.employees, { ...emp, id: clientTxId }]
        }));
        throw new Error('OFFLINE_QUEUED');
      }
    },
    updateStatus: async (id, status) => {
      const clientTxId = crypto.randomUUID();
      const payload = { status, clientTxId };
      try {
        await api.put(`/api/v1/employees/${id}/status`, payload);
        set((state) => ({
          employees: state.employees.map(e => e.id === id ? { ...e, status } : e)
        }));
      } catch (err: any) {
        console.error('Failed to sync employee status', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: `/api/v1/employees/${id}/status`,
          method: 'PUT',
          body: payload,
        });
        set((state) => ({
          employees: state.employees.map(e => e.id === id ? { ...e, status } : e)
        }));
        throw new Error('OFFLINE_QUEUED');
      }
    },
    deleteEmployee: async (id) => {
      const clientTxId = crypto.randomUUID();
      try {
        await api.delete(`/api/v1/employees/${id}`);
        set((state) => ({ employees: state.employees.filter(e => e.id !== id) }));
      } catch (err: any) {
        console.error('Failed to delete employee from server', err);
        const { useSyncQueueStore } = await import('./syncQueueStore');
        useSyncQueueStore.getState().enqueue({
          id: clientTxId,
          url: `/api/v1/employees/${id}`,
          method: 'DELETE',
        });
        set((state) => ({ employees: state.employees.filter(e => e.id !== id) }));
        throw new Error('OFFLINE_QUEUED');
      }
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
  })
);
