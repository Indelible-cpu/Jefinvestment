import { create } from 'zustand';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  setDoc,
  query, 
  orderBy, 
  where, 
  increment, 
  getDoc, 
  getDocs, 
  writeBatch, 
  arrayUnion,
  type Query,
  type QuerySnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener, useAuthStore } from './authStore';
import { 
  saveSaleToOfflineBackup, 
  removeSaleFromOfflineBackup, 
  useSyncQueueStore 
} from './syncQueueStore';

// ─── Expense Store ─────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  date: string;
  category: string;
  title?: string;
  description: string;
  loggedBy: string;
  amount: number;
  employeeId?: string;
  createdAt?: number;
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
          const rawTitle = data.title || '';
          const rawDesc = data.description || '';
          return {
            id: doc.id,
            date: data.date || new Date().toISOString().slice(0, 10),
            category: data.category || 'General',
            title: rawTitle,
            description: rawDesc,
            loggedBy: data.loggedBy || 'Admin',
            amount: Number(data.amount) || 0,
            employeeId: data.employeeId || '',
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
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
  creditPaid?: number;
  repayments?: Array<{ amount: number; method: string; date: string; cashier?: string }>;
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
      
      const buildQuery = (useOrderBy = true): Query => {
        if (user?.role === 'ADMIN') {
          return useOrderBy
            ? query(collection(db, 'sales'), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'))
            : query(collection(db, 'sales'), where('createdAt', '>=', cutoff));
        } else {
          return useOrderBy
            ? query(collection(db, 'sales'), where('branchId', '==', branchId), where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc'))
            : query(collection(db, 'sales'), where('branchId', '==', branchId), where('createdAt', '>=', cutoff));
        }
      };

      const handleSnapshot = (snapshot: QuerySnapshot) => {
        const pendingSalesList: SaleRecord[] = [];
        const mappedSales = snapshot.docs.map(doc => {
          const s = doc.data();
          const d = new Date(s.createdAt || Date.now());
          const rawStatus = (s.status || 'completed').toLowerCase() as SaleRecord['status'];
          const isPending = doc.metadata.hasPendingWrites;
          const rec: SaleRecord = {
            id: doc.id,
            invoiceNumber: s.invoiceNumber,
            date: s.date || d.toISOString().slice(0, 10),
            time: s.time || d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            cashier: s.cashier || 'Unknown',
            items: s.items || [],
            subtotal: Number(s.subtotal),
            discount: Number(s.discount),
            taxAmount: Number(s.taxAmount || 0),
            taxName: s.taxName,
            taxType: s.taxType,
            total: Number(s.total),
            paymentMethod: s.paymentMethod || 'CASH',
            amountPaid: (s.amountPaid !== undefined && s.amountPaid !== null) 
              ? Number(s.amountPaid) 
              : (s.paymentMethod === 'CREDIT' || s.isCredit ? 0 : Number(s.total)),
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            customerId: s.customerId,
            isCredit: s.isCredit || false,
            dueDate: s.dueDate,
            creditPaid: s.creditPaid !== undefined && s.creditPaid !== null ? Number(s.creditPaid) : undefined,
            repayments: Array.isArray(s.repayments) ? s.repayments : undefined,
            status: rawStatus,
            syncStatus: isPending ? 'pending' : 'synced',
            branch: s.branch || s.branchId,
          };
          if (isPending) {
            pendingSalesList.push(rec);
          }
          return rec;
        });

        // Always sort descending by createdAt / date+time
        mappedSales.sort((a, b) => {
          const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
          const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
          return timeB - timeA;
        });

        set({ sales: mappedSales, isLoading: false });
        useSyncQueueStore.getState().setPendingSales(pendingSalesList);
      };

      try {
        let q = buildQuery(true);
        const unsub_sales = onSnapshot(q, { includeMetadataChanges: true }, handleSnapshot, (error) => {
          console.warn('Primary sales query failed (likely missing index), falling back to unindexed query:', error);
          // Fallback: Query without orderBy compound requirement
          try {
            const fallbackQ = buildQuery(false);
            const fallbackUnsub = onSnapshot(fallbackQ, { includeMetadataChanges: true }, handleSnapshot, (err2) => {
              console.warn('Fallback sales query also encountered error, attempting raw collection query:', err2);
              // Ultimate fallback: Query entire sales collection with client-side filter
              const rawQ = query(collection(db, 'sales'));
              const rawUnsub = onSnapshot(rawQ, { includeMetadataChanges: true }, (rawSnap) => {
                handleSnapshot(rawSnap);
              }, (rawErr) => {
                console.error('All sales queries failed:', rawErr);
                set({ isLoading: false });
              });
              registerListener(rawUnsub);
            });
            registerListener(fallbackUnsub);
          } catch (e) {
            console.error('Error attaching fallback sales listener:', e);
            set({ isLoading: false });
          }
        });
        registerListener(unsub_sales);
      } catch (err) {
        console.error('Failed to initialize loadSales query:', err);
        set({ isLoading: false });
      }
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
      const saleRef = doc(collection(db, 'sales'));
      const saleId = saleRef.id;

      // Build explicit date + time strings so Dashboard and Sales page can find this sale
      // immediately offline — they filter by `s.date === today` not `createdAt`
      const now = new Date();
      const saleDate = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const saleTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // "HH:MM"

      const newSale: Record<string, any> = {
        ...cleanedSale,
        id: saleId,
        branchId,
        date: saleDate,
        time: saleTime,
        createdAt: now.getTime(),
        status: 'completed',
      };

      if (cleanedSale.isCredit) {
        // creditPaid tracks ONLY subsequent repayments recorded via recordRepayment().
        // The initial deposit is already stored in amountPaid and counted as initialDeposit.
        // Do NOT seed creditPaid with amountPaid — that would double-count the initial deposit.
        newSale.creditPaid = 0;
      }

      // Step 1: Immediately save to durable emergency offline backup in LocalStorage
      // Even if the browser tab is closed right away, this sale will NEVER be lost
      saveSaleToOfflineBackup(saleId, newSale);

      // Step 2: Optimistically prepend the new sale to local state immediately
      // This makes the sale visible on Dashboard and Sales page INSTANTLY offline
      const optimisticRecord = {
        ...newSale,
        syncStatus: 'pending' as const,
        branch: branchId,
      };
      set((state) => ({
        sales: [optimisticRecord as any, ...state.sales.filter(s => s.id !== saleId)],
      }));

      // Step 3: Write sale document via setDoc to Firestore persistent cache
      // By separating the sale document write from inventory updates, we guarantee
      // that the financial record is 100% committed to persistent cache and will NEVER
      // be aborted by an inventory rule or missing product error!
      setDoc(saleRef, newSale)
        .then(() => {
          removeSaleFromOfflineBackup(saleId);
          // Mark synced in local state
          set((state) => ({
            sales: state.sales.map((s) =>
              s.id === saleId ? { ...s, syncStatus: 'synced' as const } : s
            ),
          }));
        })
        .catch(e => {
          console.warn('Offline sale write queued or deferred:', e);
        });

      // Step 4: Optimistically decrement product stock in memory immediately
      // This makes the stock counter update on POS screen right away, offline or online
      const { useProductStore } = await import('./cartStore');
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          if (!item.isService && !item.isOther && item.productId && !item.productId.startsWith('other_') && !item.productId.startsWith('stationery_')) {
            // Optimistic in-memory decrement
            useProductStore.getState().decrementStockOptimistic(item.productId, item.quantity);
            // Durable Firestore decrement (also queued offline by persistent cache)
            const invRef = doc(db, 'products', item.productId);
            updateDoc(invRef, { stock: increment(-item.quantity) }).catch(e => {
              console.warn(`Stock decrement deferred for ${item.productId}:`, e);
            });
          } else if (item.materialsConsumed && Array.isArray(item.materialsConsumed)) {
            item.materialsConsumed.forEach((mat: any) => {
              const matId = mat.inventoryItemId || mat.productId;
              const matQty = (mat.quantityPerUnit || mat.quantityUsed || 1) * item.quantity;
              useProductStore.getState().decrementStockOptimistic(matId, matQty);
              const invRef = doc(db, 'products', matId);
              updateDoc(invRef, { stock: increment(-matQty) }).catch(e => {
                console.warn(`Material decrement deferred for ${matId}:`, e);
              });
            });
          }
        });
      }

      // Step 5: If online, immediately kick off background auto-sync flush
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        useSyncQueueStore.getState().syncAll(false).catch(() => {});
      }
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
      await useSyncQueueStore.getState().syncAll(true);
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
          // If it's a credit sale, only delete it if it's fully settled
          if (data.isCredit) {
            const total = Number(data.total) || 0;
            const paid = (Number(data.creditPaid) || 0) + (Number(data.amountPaid) || 0);
            return total > 0 && paid >= total; // Delete only if fully settled
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
      return get().sales.filter(s => s.date === today && (s.status ?? 'completed') === 'completed');
    },
    getTodayCashTotal: () => {
      const today = new Date().toISOString().slice(0, 10);
      const daySales = get().getTodaySales();
      const directCash = daySales.filter(s => s.paymentMethod === 'CASH' && !s.isCredit).reduce((sum, s) => sum + s.total, 0);
      const creditInitialCash = daySales.filter(s => s.paymentMethod === 'CREDIT' || s.isCredit).reduce((sum, s) => sum + (s.amountPaid || 0), 0);
      let repaymentCash = 0;
      get().sales.forEach(s => {
        if ((s.paymentMethod === 'CREDIT' || s.isCredit) && Array.isArray((s as any).repayments)) {
          (s as any).repayments.forEach((r: any) => {
            if (r.date && r.date.startsWith(today) && (r.method === 'CASH' || !r.method)) {
              repaymentCash += Number(r.amount) || 0;
            }
          });
        }
      });
      return directCash + creditInitialCash + repaymentCash;
    },
    getTodayCreditTotal: () => {
      // Uncollected credit debt issued today (Accounts Receivable created today)
      return get().getTodaySales()
        .filter(s => s.paymentMethod === 'CREDIT' || s.isCredit)
        .reduce((sum, s) => sum + Math.max(0, s.total - (s.amountPaid || 0)), 0);
    },
    getTodayTransferTotal: () => {
      const today = new Date().toISOString().slice(0, 10);
      const daySales = get().getTodaySales();
      const directTransfers = daySales
        .filter(s => s.paymentMethod !== 'CASH' && s.paymentMethod !== 'CREDIT' && !s.isCredit)
        .reduce((sum, s) => sum + s.total, 0);
      let repaymentTransfers = 0;
      get().sales.forEach(s => {
        if ((s.paymentMethod === 'CREDIT' || s.isCredit) && Array.isArray((s as any).repayments)) {
          (s as any).repayments.forEach((r: any) => {
            if (r.date && r.date.startsWith(today) && r.method && r.method !== 'CASH') {
              repaymentTransfers += Number(r.amount) || 0;
            }
          });
        }
      });
      return directTransfers + repaymentTransfers;
    },
    getTodayTotal: () => {
      const today = new Date().toISOString().slice(0, 10);
      const daySales = get().getTodaySales();
      // Cash basis total collections: direct non-credit + credit initial deposits + credit repayments collected today
      let total = daySales.reduce((sum, s) => {
        if (s.paymentMethod === 'CREDIT' || s.isCredit) {
          return sum + (s.amountPaid || 0);
        }
        return sum + s.total;
      }, 0);
      get().sales.forEach(s => {
        if ((s.paymentMethod === 'CREDIT' || s.isCredit) && Array.isArray((s as any).repayments)) {
          (s as any).repayments.forEach((r: any) => {
            if (r.date && r.date.startsWith(today)) {
              total += Number(r.amount) || 0;
            }
          });
        }
      });
      return total;
    },
  })
);

// ─── Credit Store ──────────────────────────────────────────────────────────────
export interface CreditRepaymentEntry {
  amount: number;
  method: string;
  date: string;
  cashier?: string;
}

export interface CreditRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  totalAmount: number;
  paidAmount: number;
  initialDeposit: number;
  repayments: CreditRepaymentEntry[];
  dueDate: string;
  date: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'OVERDUE' | 'FULLY_PAID';
  items?: any[];
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  taxName?: string;
  taxType?: string;
}

interface CreditState {
  credits: CreditRecord[];
  isLoading: boolean;
  loadCredits: () => Promise<void>;
  addCredit: (credit: Omit<CreditRecord, 'id' | 'status' | 'paidAmount' | 'date' | 'initialDeposit' | 'repayments'>) => void;
  recordRepayment: (id: string, amount: number, method: string, cashierName?: string) => Promise<void>;
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
      
      let q: Query;
      if (user?.role === 'ADMIN') {
        q = query(collection(db, 'sales'), where('isCredit', '==', true));
      } else {
        q = query(collection(db, 'sales'), where('branchId', '==', branchId), where('isCredit', '==', true));
      }
      const unsub_credits = onSnapshot(q, { includeMetadataChanges: true }, (snapshot: QuerySnapshot) => {
        const today = new Date().toISOString().slice(0, 10);
        const mapped = snapshot.docs.map(doc => {
          const c = doc.data();
          const totalAmount = Number(c.total) || 0;
          // Calculate repayments total from repayments array (authoritative source).
          // When the repayments array exists (even empty), trust it completely.
          // Only fall back to creditPaid for legacy records without a repayments array,
          // and subtract initialDeposit to avoid double-counting (creditPaid was historically
          // seeded with amountPaid which is already counted as initialDeposit).
          const repaymentsList: CreditRepaymentEntry[] = Array.isArray(c.repayments) ? c.repayments : [];
          const repaymentsSum = repaymentsList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const hasRepaymentsArray = Array.isArray(c.repayments);

          // Initial deposit collected when the credit invoice was created at POS
          const initialDeposit = Number(c.amountPaid) || 0;

          let subsequentPaid: number;
          if (hasRepaymentsArray) {
            // Modern records: use repayments array exclusively (prevents double-count with initialDeposit)
            subsequentPaid = repaymentsSum;
          } else {
            // Legacy records: creditPaid may have been seeded with amountPaid, so subtract initialDeposit
            const creditPaidField = Number(c.creditPaid) || 0;
            subsequentPaid = Math.max(0, creditPaidField - initialDeposit);
          }

          // Total paid = initial deposit + subsequent repayments
          const paidAmount = Math.min(totalAmount, initialDeposit + subsequentPaid);
          const dueDate = c.dueDate || '';
          
          let status: CreditRecord['status'] = 'PENDING';
          if (paidAmount >= totalAmount && totalAmount > 0) {
            status = 'FULLY_PAID';
          } else if (dueDate && dueDate < today) {
            status = 'OVERDUE';
          } else if (paidAmount > 0) {
            status = 'PARTIALLY_PAID';
          }
          
          return {
            id: doc.id,
            invoiceNumber: c.invoiceNumber,
            customerName: c.customerName || 'Customer',
            customerPhone: c.customerPhone || '',
            totalAmount,
            paidAmount,
            initialDeposit,
            repayments: repaymentsList,
            dueDate,
            date: new Date(c.createdAt || Date.now()).toISOString().slice(0, 10),
            status,
            items: c.items || [],
            subtotal: Number(c.subtotal) || totalAmount,
            discount: Number(c.discount) || 0,
            taxAmount: Number(c.taxAmount) || 0,
            taxName: c.taxName || 'VAT',
            taxType: c.taxType || 'INCLUSIVE',
            customerId: c.customerId || '',
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
    recordRepayment: async (id, amount, method = 'CASH', cashierName?: string) => {
      const creditRecord = get().credits.find(c => c.id === id);
      if (creditRecord) {
        const remaining = Math.max(0, creditRecord.totalAmount - creditRecord.paidAmount);
        if (remaining <= 0) {
          throw new Error('This credit is already fully paid.');
        }
        if (amount > remaining) {
          throw new Error(`Amount exceeds remaining balance. Max payable is ${remaining.toLocaleString()}.`);
        }
      }

      const activeCashier = cashierName || useAuthStore.getState().user?.name || 'Staff';
      const repaymentPayload: CreditRepaymentEntry = {
        amount,
        method,
        date: new Date().toISOString(),
        cashier: activeCashier,
      };

      try {
        await updateDoc(doc(db, 'sales', id), {
          creditPaid: increment(amount),
          repayments: arrayUnion(repaymentPayload)
        });
      } catch (err: any) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('OFFLINE_QUEUED');
        }
        throw err;
      }
    },
    getTotalOutstanding: () =>
      get().credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + Math.max(0, c.totalAmount - c.paidAmount), 0),
  })
);

// ─── Employee Store ─────────────────────────────────────────────────────────────

export interface AdvancePayRecord {
  id: string;
  amount: number;
  date: string;         // ISO date string YYYY-MM-DD
  notes?: string;
  loggedBy: string;
  createdAt: number;    // epoch ms for sorting
}

export interface SalaryPayRecord {
  id: string;
  grossSalary: number;
  advanceDeducted: number;
  netPaid: number;
  date: string;         // ISO date string YYYY-MM-DD
  notes?: string;
  loggedBy: string;
  createdAt: number;    // epoch ms for sorting
  paymentMethod?: string;
}

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
  department?: string;
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
  // In-memory history caches — loaded on demand
  advanceHistory?: AdvancePayRecord[];
  salaryHistory?: SalaryPayRecord[];
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
  recordSalaryPay: (id: string, netAmount: number, notes?: string, paymentMethod?: string) => Promise<void>;
  clearAdvancePay: (id: string) => Promise<void>;
  loadAdvanceHistory: (id: string) => Promise<void>;
  loadSalaryHistory: (id: string) => Promise<void>;
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
            department: e.department || '',
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

      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const currentUser = useAuthStore.getState().user?.name || 'System';
      const now = Date.now();
      const dateStr = new Date().toISOString().slice(0, 10);

      // Update employee advance pay running total
      updateDoc(doc(db, 'employees', id), {
        advancePay: increment(amount)
      }).catch(e => console.warn('Offline write deferred or failed:', e));

      // ── Save to advance history subcollection (permanent record) ──
      const historyRecord = {
        amount: Number(amount),
        date: dateStr,
        notes: notes || '',
        loggedBy: currentUser,
        createdAt: now,
      };
      addDoc(collection(db, 'employees', id, 'advanceHistory'), historyRecord)
        .catch(e => console.warn('Offline write deferred or failed (advance history):', e));

      // Automatically record as an expense for accounting
      addDoc(collection(db, 'expenses'), {
        title: `Salary Advance: ${emp.firstName} ${emp.lastName}`,
        amount: Number(amount),
        category: 'Salary / Advance Pay',
        description: notes ? `Notes: ${notes}` : `Advance payment to ${emp.firstName} ${emp.lastName}`,
        paymentMethod: 'CASH',
        date: dateStr,
        loggedBy: currentUser,
        branchId,
        employeeId: id,
        createdAt: now,
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    clearAdvancePay: async (id) => {
      updateDoc(doc(db, 'employees', id), {
        advancePay: 0
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    recordSalaryPay: async (id, netAmount, notes, paymentMethod = 'CASH') => {
      const emp = get().employees.find(e => e.id === id);
      if (!emp) return;

      const branchId = useAuthStore.getState().user?.branchId || 'main';
      const currentUser = useAuthStore.getState().user?.name || 'System';
      const now = Date.now();
      const dateStr = new Date().toISOString().slice(0, 10);

      // Reset advance pay since salary is settled
      updateDoc(doc(db, 'employees', id), {
        advancePay: 0
      }).catch(e => console.warn('Offline write deferred or failed:', e));

      // ── Save to salary history subcollection (permanent record) ──
      const salaryRecord = {
        grossSalary: emp.salary,
        advanceDeducted: emp.advancePay || 0,
        netPaid: Number(netAmount),
        date: dateStr,
        notes: notes || '',
        loggedBy: currentUser,
        createdAt: now,
        paymentMethod: paymentMethod || 'CASH',
      };
      addDoc(collection(db, 'employees', id, 'salaryHistory'), salaryRecord)
        .catch(e => console.warn('Offline write deferred or failed (salary history):', e));

      // Automatically record as an expense
      addDoc(collection(db, 'expenses'), {
        title: `Salary Payment: ${emp.firstName} ${emp.lastName}`,
        amount: Number(netAmount),
        category: 'Salary / Advance Pay',
        description: notes ? `Notes: ${notes}` : `Net salary payment to ${emp.firstName} ${emp.lastName}`,
        paymentMethod: paymentMethod || 'CASH',
        date: dateStr,
        loggedBy: currentUser,
        branchId,
        employeeId: id,
        createdAt: now,
      }).catch(e => console.warn('Offline write deferred or failed:', e));
    },
    getActiveCount: () => get().employees.filter(e => e.status === 'PRESENT').length,
    getTotalAdvancePay: () => get().employees.reduce((sum, e) => sum + (e.advancePay || 0), 0),
    loadAdvanceHistory: async (id) => {
      try {
        const emp = get().employees.find(e => e.id === id);
        const snapshot = await getDocs(collection(db, 'employees', id, 'advanceHistory'));
        const subRecords: AdvancePayRecord[] = snapshot.docs.map(d => {
          const data = d.data();
          let created = 0;
          if (typeof data.createdAt === 'number') created = data.createdAt;
          else if (data.createdAt?.seconds) created = data.createdAt.seconds * 1000;
          else if (data.createdAt?.toDate) created = data.createdAt.toDate().getTime();

          let dateStr = data.date || '';
          if (!dateStr && created > 0) {
            const cd = new Date(created);
            dateStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
          }
          return {
            id: d.id,
            amount: Number(data.amount) || 0,
            date: dateStr,
            notes: data.notes || '',
            loggedBy: data.loggedBy || 'System',
            createdAt: created || Date.now(),
          };
        });

        // 2. Fetch directly from expenses collection in Firestore
        const legacyRecords: AdvancePayRecord[] = [];
        if (emp) {
          const fullName = `${emp.firstName} ${emp.lastName}`.trim().toLowerCase();
          const firstName = emp.firstName.trim().toLowerCase();
          const lastName = emp.lastName.trim().toLowerCase();

          try {
            const expSnapshot = await getDocs(collection(db, 'expenses'));
            expSnapshot.docs.forEach(ed => {
              const data = ed.data();
              const title = (data.title || '').toLowerCase();
              const desc = (data.description || '').toLowerCase();
              const cat = (data.category || '').toLowerCase();
              const combined = `${title} ${desc} ${cat}`;

              const matchesEmp = 
                combined.includes(fullName) || 
                (firstName.length > 2 && combined.includes(firstName)) ||
                (lastName.length > 2 && combined.includes(lastName));

              if (!matchesEmp) return;

              // Ensure salary payments are NEVER classified as advances
              const isSalaryPayment = title.includes('salary payment') ||
                desc.includes('net salary payment') ||
                (
                  (title.includes('salary') || desc.includes('salary')) &&
                  !title.includes('advance') && !desc.includes('advance')
                );
              if (isSalaryPayment) return;

              const isAdvance = 
                title.includes('advance') || 
                desc.includes('advance') ||
                (cat.includes('advance') && !title.includes('salary'));

              if (!isAdvance) return;

              let expCreated = 0;
              if (typeof data.createdAt === 'number') expCreated = data.createdAt;
              else if (data.createdAt?.seconds) expCreated = data.createdAt.seconds * 1000;
              else if (data.createdAt?.toDate) expCreated = data.createdAt.toDate().getTime();

              let expDate = data.date || '';
              if (!expDate && expCreated > 0) {
                const cd = new Date(expCreated);
                expDate = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
              }

              const amount = Number(data.amount) || 0;
              const alreadyHas = subRecords.some(r => r.date === expDate && r.amount === amount);
              if (!alreadyHas) {
                legacyRecords.push({
                  id: `exp_${ed.id}`,
                  amount,
                  date: expDate,
                  notes: data.description || data.title || 'Salary Advance',
                  loggedBy: data.loggedBy || 'System',
                  createdAt: expCreated || (expDate ? new Date(expDate).getTime() : Date.now()),
                });
              }
            });
          } catch (expErr) {
            console.warn('Could not query expenses for legacy advance history:', expErr);
          }
        }

        const merged = [...subRecords, ...legacyRecords].sort((a, b) => a.createdAt - b.createdAt);

        set(state => ({
          employees: state.employees.map(e =>
            e.id === id ? { ...e, advanceHistory: merged } : e
          )
        }));
      } catch (err) {
        console.warn('Failed to load advance history:', err);
        // Set to empty array so spinner doesn't show indefinitely
        set(state => ({
          employees: state.employees.map(e =>
            e.id === id ? { ...e, advanceHistory: e.advanceHistory ?? [] } : e
          )
        }));
      }
    },
    loadSalaryHistory: async (id) => {
      try {
        const emp = get().employees.find(e => e.id === id);
        const snapshot = await getDocs(collection(db, 'employees', id, 'salaryHistory'));
        const subRecords: SalaryPayRecord[] = snapshot.docs.map(d => {
          const data = d.data();
          let created = 0;
          if (typeof data.createdAt === 'number') created = data.createdAt;
          else if (data.createdAt?.seconds) created = data.createdAt.seconds * 1000;
          else if (data.createdAt?.toDate) created = data.createdAt.toDate().getTime();

          let dateStr = data.date || '';
          if (!dateStr && created > 0) {
            const cd = new Date(created);
            dateStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
          }
          const netPaid = Number(data.netPaid) || 0;
          let grossSalary = Number(data.grossSalary) || (emp?.salary || 0);
          let advanceDeducted = Number(data.advanceDeducted) || 0;
          if (advanceDeducted === 0 && grossSalary > netPaid) {
            advanceDeducted = grossSalary - netPaid;
          }
          if (grossSalary === 0) {
            grossSalary = netPaid + advanceDeducted;
          }
          return {
            id: d.id,
            grossSalary,
            advanceDeducted,
            netPaid,
            date: dateStr,
            notes: data.notes || '',
            loggedBy: data.loggedBy || 'System',
            createdAt: created || Date.now(),
            paymentMethod: data.paymentMethod || 'CASH',
          };
        });

        // 2. Fetch directly from expenses collection in Firestore
        const legacyRecords: SalaryPayRecord[] = [];
        if (emp) {
          const fullName = `${emp.firstName} ${emp.lastName}`.trim().toLowerCase();
          const firstName = emp.firstName.trim().toLowerCase();
          const lastName = emp.lastName.trim().toLowerCase();

          try {
            const expSnapshot = await getDocs(collection(db, 'expenses'));
            expSnapshot.docs.forEach(ed => {
              const data = ed.data();
              const title = (data.title || '').toLowerCase();
              const desc = (data.description || '').toLowerCase();
              const cat = (data.category || '').toLowerCase();
              const combined = `${title} ${desc} ${cat}`;

              const matchesEmp = 
                combined.includes(fullName) || 
                (firstName.length > 2 && combined.includes(firstName)) ||
                (lastName.length > 2 && combined.includes(lastName));

              if (!matchesEmp) return;

              // Use title as the primary discriminator:
              // "Salary Payment: ..." → salary
              // "Salary Advance: ..."  → advance
              // Category "Salary / Advance Pay" contains both words so DON'T use it to exclude
              const isSalary = title.includes('salary payment') ||
                desc.includes('net salary payment') ||
                (
                  (title.includes('salary') || desc.includes('salary')) &&
                  !title.includes('advance') && !desc.includes('advance')
                );

              if (!isSalary) return;

              let expCreated = 0;
              if (typeof data.createdAt === 'number') expCreated = data.createdAt;
              else if (data.createdAt?.seconds) expCreated = data.createdAt.seconds * 1000;
              else if (data.createdAt?.toDate) expCreated = data.createdAt.toDate().getTime();

              let expDate = data.date || '';
              if (!expDate && expCreated > 0) {
                const cd = new Date(expCreated);
                expDate = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
              }

              const netPaid = Number(data.amount) || 0;
              const alreadyHas = subRecords.some(r => r.date === expDate && r.netPaid === netPaid);
              if (!alreadyHas) {
                const grossSalary = emp.salary || netPaid;
                const advanceDeducted = grossSalary > netPaid ? (grossSalary - netPaid) : 0;
                legacyRecords.push({
                  id: `exp_${ed.id}`,
                  grossSalary,
                  advanceDeducted,
                  netPaid,
                  date: expDate,
                  notes: data.description || data.title || 'Salary Payment',
                  loggedBy: data.loggedBy || 'System',
                  createdAt: expCreated || (expDate ? new Date(expDate).getTime() : Date.now()),
                  paymentMethod: data.paymentMethod || 'CASH',
                });
              }
            });
          } catch (expErr) {
            console.warn('Could not query expenses for legacy salary history:', expErr);
          }
        }

        const merged = [...subRecords, ...legacyRecords].sort((a, b) => a.createdAt - b.createdAt);

        set(state => ({
          employees: state.employees.map(e =>
            e.id === id ? { ...e, salaryHistory: merged } : e
          )
        }));
      } catch (err) {
        console.warn('Failed to load salary history:', err);
        // Set to empty array so spinner doesn't show indefinitely
        set(state => ({
          employees: state.employees.map(e =>
            e.id === id ? { ...e, salaryHistory: e.salaryHistory ?? [] } : e
          )
        }));
      }
    },
  })
);
