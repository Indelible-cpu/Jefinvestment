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
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
  deleteExpense: (id: string) => void;
  getTodayTotal: () => number;
}

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
      expenses: [
        { id: '1', date: new Date().toISOString().slice(0, 10), category: 'Transport', description: 'Delivery to client', loggedBy: 'Admin', amount: 3000 },
        { id: '2', date: new Date().toISOString().slice(0, 10), category: 'Store Supplies', description: 'Cleaning supplies', loggedBy: 'Admin', amount: 2500 },
      ],
      addExpense: (expense) => set((state) => ({
        expenses: [
          { ...expense, id: Date.now().toString(), date: new Date().toISOString().slice(0, 10) },
          ...state.expenses,
        ]
      })),
      deleteExpense: (id) => set((state) => ({
        expenses: state.expenses.filter(e => e.id !== id)
      })),
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
  addCredit: (credit: Omit<CreditRecord, 'id' | 'status' | 'paidAmount' | 'date'>) => void;
  recordRepayment: (id: string, amount: number) => void;
  getTotalOutstanding: () => number;
}

export const useCreditStore = create<CreditState>()(
  persist(
    (set, get) => ({
      credits: [
        { id: '1', invoiceNumber: 'INV-882190', customerName: 'Blessings Musopole', customerPhone: '+265 999 555 444', totalAmount: 850000, paidAmount: 300000, dueDate: '2026-08-15', date: new Date().toISOString().slice(0,10), status: 'PENDING' },
        { id: '2', invoiceNumber: 'INV-773102', customerName: 'Yamikani Phiri', customerPhone: '+265 888 111 222', totalAmount: 45000, paidAmount: 0, dueDate: '2026-08-01', date: new Date().toISOString().slice(0,10), status: 'OVERDUE' },
      ],
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
      recordRepayment: (id, amount) => set((state) => ({
        credits: state.credits.map(c => {
          if (c.id !== id) return c;
          const newPaid = c.paidAmount + amount;
          return {
            ...c,
            paidAmount: newPaid,
            status: newPaid >= c.totalAmount ? 'FULLY_PAID' : c.status,
          };
        })
      })),
      getTotalOutstanding: () =>
        get().credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0),
    }),
    { name: 'jef-credits-storage' }
  )
);
