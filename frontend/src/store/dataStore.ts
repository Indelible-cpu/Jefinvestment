import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  persist(
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
      addExpense: (expense) => {
        const id = Date.now().toString();
        const date = new Date().toISOString().slice(0, 10);
        set((state) => ({ expenses: [{ ...expense, id, date }, ...state.expenses] }));
        api.post('/api/v1/expenses', expense).catch(err => console.error('Failed to sync expense', err));
      },
      deleteExpense: (id) => {
        set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
        api.delete(`/api/v1/expenses/${id}`).catch(err => console.error('Failed to delete expense', err));
      },
      getTodayTotal: () => {
        const today = new Date().toISOString().slice(0, 10);
        return get().expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
      }
    }),
    { name: 'jef-expenses-storage' }
  )
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
  addSale: (sale: Omit<SaleRecord, 'id' | 'date' | 'time' | 'status' | 'syncStatus'>) => void;
  updateSaleStatus: (id: string, status: 'completed' | 'refunded' | 'voided') => void;
  getTodaySales: () => SaleRecord[];
  getTodayCashTotal: () => number;
  getTodayCreditTotal: () => number;
  getTodayTransferTotal: () => number;
  getTodayTotal: () => number;
  loadSales: () => Promise<void>;
  syncPendingSales: () => Promise<void>;
}

import api from '../utils/api';

export const useSaleStore = create<SaleState>()(
  persist(
    (set, get) => ({
      sales: [],
      loadSales: async () => {
        try {
          const res: any = await api.get('/api/v1/sales');
          // Map backend sales to local format
          const mappedSales = res.data.map((s: any) => ({
            id: s.id,
            invoiceNumber: s.invoiceNumber,
            date: new Date(s.createdAt).toISOString().slice(0, 10),
            time: new Date(s.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            cashier: s.user?.username || 'Unknown',
            items: s.items.map((i: any) => ({ name: i.product?.name || 'Unknown', quantity: i.quantity, unitPrice: Number(i.unitPrice), discount: Number(i.discount) })),
            subtotal: Number(s.subtotal),
            discount: Number(s.discount),
            taxAmount: 0,
            total: Number(s.total),
            paymentMethod: s.payments?.[0]?.method || 'CASH',
            amountPaid: Number(s.payments?.[0]?.amount) || Number(s.total),
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            status: s.status.toLowerCase(),
            syncStatus: 'synced',
            branch: s.branch?.name,
          }));
          set({ sales: mappedSales });
        } catch (error) {
          console.error('Failed to load sales from API', error);
        }
      },
      addSale: (sale) => {
        const now = new Date();
        const localId = Date.now().toString();
        const newSale: SaleRecord = {
          ...sale,
          id: localId,
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          status: 'completed' as const,
          syncStatus: 'pending' as const,
        };
        
        set((state) => ({
          sales: [newSale, ...state.sales],
        }));

        // Async sync to backend
        api.post('/api/v1/sales', {
          ...sale,
          syncId: localId,
        }).then(() => {
          set((state) => ({
            sales: state.sales.map(s => s.id === localId ? { ...s, syncStatus: 'synced' } : s)
          }));
        }).catch(err => {
          console.error('Failed to sync sale', err);
        });
      },
      syncPendingSales: async () => {
        const pending = get().sales.filter(s => s.syncStatus === 'pending');
        if (pending.length === 0) return;

        // Try syncing all pending sales
        for (const sale of pending) {
          try {
            await api.post('/api/v1/sales', { ...sale, syncId: sale.id });
            set((state) => ({
              sales: state.sales.map(s => s.id === sale.id ? { ...s, syncStatus: 'synced' } : s)
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
        return get().sales.filter(s => s.date === today);
      },
      getTodayCashTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0),
      getTodayCreditTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.total, 0),
      getTodayTransferTotal: () => get().getTodaySales().filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.total, 0),
      getTodayTotal: () => get().getTodaySales().reduce((sum, s) => sum + s.total, 0),
    }),
    { name: 'jef-sales-storage' }
  )
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
  persist(
    (set, get) => ({
      credits: [],
      loadCredits: async () => {
        try {
          const res: any = await api.get('/api/v1/credits');
          if (res.data && Array.isArray(res.data)) {
            const mapped = res.data.map((c: any) => ({
              id: c.id,
              invoiceNumber: c.invoiceNumber,
              customerName: c.customerName || 'Customer',
              customerPhone: c.customerPhone || '',
              totalAmount: Number(c.total),
              paidAmount: Number(c.creditPaid) || 0,
              dueDate: c.dueDate ? new Date(c.dueDate).toISOString().slice(0, 10) : '',
              date: new Date(c.createdAt).toISOString().slice(0, 10),
              status: Number(c.creditPaid) >= Number(c.total) ? 'FULLY_PAID' : 'PENDING',
            }));
            set({ credits: mapped });
          }
        } catch (err) {
          console.warn('Failed to load credits from API', err);
        }
      },
      addCredit: (credit) => set((state) => ({
        credits: [
          {
            ...credit,
            id: Date.now().toString(),
            paidAmount: 0,
            status: 'PENDING' as const,
            date: new Date().toISOString().slice(0, 10),
          },
          ...state.credits,
        ]
      })),
      recordRepayment: (id, amount) => {
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
        api.put(`/api/v1/credits/${id}/repay`, { amount, method: 'CASH' })
          .catch(err => console.error('Failed to sync credit repayment', err));
      },
      getTotalOutstanding: () =>
        get().credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0),
    }),
    { name: 'jef-credits-storage' }
  )
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
  persist(
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
      addEmployee: (emp) => {
        const localId = Date.now().toString();
        set((state) => ({ employees: [...state.employees, { ...emp, id: localId }] }));
        api.post('/api/v1/employees', emp)
          .then((res: any) => {
            if (res.data?.id) {
              set((state) => ({
                employees: state.employees.map(e => e.id === localId ? { ...e, id: res.data.id } : e)
              }));
            }
          })
          .catch(err => console.error('Failed to sync employee to server', err));
      },
      updateStatus: (id, status) => {
        set((state) => ({
          employees: state.employees.map(e => e.id === id ? { ...e, status } : e)
        }));
        api.put(`/api/v1/employees/${id}/status`, { status })
          .catch(err => console.error('Failed to sync employee status', err));
      },
      deleteEmployee: (id) => {
        set((state) => ({ employees: state.employees.filter(e => e.id !== id) }));
        api.delete(`/api/v1/employees/${id}`)
          .catch(err => console.error('Failed to delete employee from server', err));
      },
      getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
    }),
    { name: 'jef-employees-storage' }
  )
);

