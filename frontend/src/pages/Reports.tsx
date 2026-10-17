import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard,
  ShoppingBag, AlertCircle, Printer, Calendar, Package, Activity,
  ChevronLeft, ChevronRight, PiggyBank, ChevronDown, Filter, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from 'recharts';
import { collection, query, where, getDocs, orderBy, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useSaleStore, useExpenseStore, type SaleRecord, type Expense } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { calcSaleProfit, isSalaryAdvanceExpense } from '../utils/profitUtils';

// ─── Date Filter Types & Helpers ───────────────────────────────────────────────

export type PeriodPreset =
  | 'this_month'
  | 'last_month'
  | 'prev_3_months'
  | 'prev_6_months'
  | 'prev_12_months'
  | 'year_to_date'
  | 'all_time'
  | 'custom_range'
  | 'specific_month';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month:     'This Month',
  last_month:     'Last Month',
  prev_3_months:  'Previous 3 Complete Months',
  prev_6_months:  'Previous 6 Complete Months',
  prev_12_months: 'Previous 12 Complete Months',
  year_to_date:   'Year to Date',
  all_time:       'All Time',
  custom_range:   'Custom Date Range',
  specific_month: 'Specific Month',
};

/** Formats a local Date object into YYYY-MM-DD string without UTC shift */
function formatYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns YYYY-MM-DD for the last day of a given year and 0-indexed month */
function lastDayOfMonth(year: number, month: number): string {
  return formatYMD(new Date(year, month + 1, 0));
}

/** Returns YYYY-MM-DD for the first day of a given year and 0-indexed month */
function firstDayOfMonth(year: number, month: number): string {
  return formatYMD(new Date(year, month, 1));
}

export function getDateRange(
  preset: PeriodPreset,
  customStart: string,
  customEnd: string,
  specificYear: number,
  specificMonth: number,
): DateRange | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (preset) {
    case 'this_month':
      return { start: firstDayOfMonth(y, m), end: formatYMD(now) };

    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { start: firstDayOfMonth(ly, lm), end: lastDayOfMonth(ly, lm) };
    }

    case 'prev_3_months': {
      // Previous 3 complete calendar months, excluding the current month
      const endMonth = m === 0 ? 11 : m - 1;
      const endYear  = m === 0 ? y - 1 : y;
      const startRaw = new Date(endYear, endMonth - 2, 1);
      return {
        start: firstDayOfMonth(startRaw.getFullYear(), startRaw.getMonth()),
        end:   lastDayOfMonth(endYear, endMonth),
      };
    }

    case 'prev_6_months': {
      // Previous 6 complete calendar months, excluding the current month
      const endMonth = m === 0 ? 11 : m - 1;
      const endYear  = m === 0 ? y - 1 : y;
      const startRaw = new Date(endYear, endMonth - 5, 1);
      return {
        start: firstDayOfMonth(startRaw.getFullYear(), startRaw.getMonth()),
        end:   lastDayOfMonth(endYear, endMonth),
      };
    }

    case 'prev_12_months': {
      // Previous 12 complete calendar months, excluding the current month
      const endMonth = m === 0 ? 11 : m - 1;
      const endYear  = m === 0 ? y - 1 : y;
      const startRaw = new Date(endYear, endMonth - 11, 1);
      return {
        start: firstDayOfMonth(startRaw.getFullYear(), startRaw.getMonth()),
        end:   lastDayOfMonth(endYear, endMonth),
      };
    }

    case 'year_to_date':
      return { start: `${y}-01-01`, end: formatYMD(now) };

    case 'all_time':
      return null; // signals no date boundary — all available records

    case 'custom_range':
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };

    case 'specific_month':
      return {
        start: firstDayOfMonth(specificYear, specificMonth),
        end:   lastDayOfMonth(specificYear, specificMonth),
      };
  }
}

/** Returns true when a YYYY-MM-DD date string falls within an optional range */
function inRange(dateStr: string, range: DateRange | null): boolean {
  if (!range) return true;
  return dateStr >= range.start && dateStr <= range.end;
}

// Build list of months back to 5 years
function buildMonthOptions(): { label: string; year: number; month: number }[] {
  const options: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();
const today = formatYMD(new Date());

function rangeLabel(range: DateRange | null, preset: PeriodPreset): string {
  if (preset === 'all_time') return 'All Time';
  if (!range) return '';
  if (range.start === range.end) return range.start;
  return `${range.start} – ${range.end}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function Reports() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // ── Period filter state ──
  const [preset, setPreset]               = useState<PeriodPreset>('this_month');
  const [customStart, setCustomStart]     = useState(today);
  const [customEnd, setCustomEnd]         = useState(today);
  const [specificYear, setSpecificYear]   = useState(new Date().getFullYear());
  const [specificMonth, setSpecificMonth] = useState(new Date().getMonth());
  const [filterOpen, setFilterOpen]       = useState(false);

  // Store data (default holds last 90 days for fast UI performance)
  const { sales, isLoading: isLoadingSales } = useSaleStore();
  const { expenses, isLoading: isLoadingExpenses } = useExpenseStore();
  const settings = useSettingsStore();
  const user = useAuthStore(state => state.user);

  // Historical data loaded dynamically from Firestore when user requests data older than 90 days or All Time
  const [historicalSales, setHistoricalSales] = useState<SaleRecord[]>([]);
  const [historicalExpenses, setHistoricalExpenses] = useState<Expense[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // ── Derived date range ──
  const dateRange = useMemo(
    () => getDateRange(preset, customStart, customEnd, specificYear, specificMonth),
    [preset, customStart, customEnd, specificYear, specificMonth],
  );

  // ── Query Firestore for historical data if filter extends beyond standard 90-day window ──
  useEffect(() => {
    let isCancelled = false;

    async function fetchHistorical() {
      const now = Date.now();
      const cutoff90Days = now - 85 * 24 * 60 * 60 * 1000; // 85-day threshold with 5-day safety margin
      const needsAllTime = preset === 'all_time';
      const rangeStartsBeforeCutoff = dateRange && new Date(dateRange.start + 'T00:00:00').getTime() < cutoff90Days;

      if (!needsAllTime && !rangeStartsBeforeCutoff) {
        // Current in-memory store already covers this period completely
        setHistoricalSales([]);
        setHistoricalExpenses([]);
        return;
      }

      setIsLoadingHistorical(true);

      try {
        const branchId = user?.branchId || 'main';
        const isAdmin = user?.role === 'ADMIN';

        // 1. Fetch Sales
        let salesDocs: any[] = [];
        try {
          let salesQ: Query;
          if (needsAllTime) {
            salesQ = isAdmin
              ? query(collection(db, 'sales'), orderBy('createdAt', 'desc'))
              : query(collection(db, 'sales'), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
          } else {
            const startMs = new Date(dateRange!.start + 'T00:00:00').getTime();
            const endMs = new Date(dateRange!.end + 'T23:59:59.999').getTime();
            salesQ = isAdmin
              ? query(collection(db, 'sales'), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs))
              : query(collection(db, 'sales'), where('branchId', '==', branchId), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs));
          }
          const snap = await getDocs(salesQ);
          salesDocs = snap.docs;
        } catch (e) {
          // Fallback query if composite index is pending
          console.warn('Composite historical sales query fallback:', e);
          const rawQ = isAdmin
            ? query(collection(db, 'sales'))
            : query(collection(db, 'sales'), where('branchId', '==', branchId));
          const snap = await getDocs(rawQ);
          salesDocs = snap.docs;
        }

        const mappedSales: SaleRecord[] = salesDocs.map(doc => {
          const s = doc.data();
          const d = new Date(s.createdAt || Date.now());
          return {
            id: doc.id,
            invoiceNumber: s.invoiceNumber || doc.id,
            date: s.date || d.toISOString().slice(0, 10),
            time: s.time || d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            cashier: s.cashier || 'Unknown',
            items: s.items || [],
            subtotal: Number(s.subtotal || 0),
            discount: Number(s.discount || 0),
            taxAmount: Number(s.taxAmount || 0),
            total: Number(s.total || 0),
            paymentMethod: s.paymentMethod || 'CASH',
            amountPaid: (s.amountPaid !== undefined && s.amountPaid !== null)
              ? Number(s.amountPaid)
              : (s.paymentMethod === 'CREDIT' || s.isCredit ? 0 : Number(s.total || 0)),
            customerName: s.customerName,
            customerPhone: s.customerPhone,
            customerId: s.customerId,
            isCredit: s.isCredit || false,
            dueDate: s.dueDate,
            creditPaid: s.creditPaid !== undefined && s.creditPaid !== null ? Number(s.creditPaid) : undefined,
            repayments: Array.isArray(s.repayments) ? s.repayments : undefined,
            status: (s.status || 'completed').toLowerCase() as SaleRecord['status'],
            syncStatus: 'synced',
            branch: s.branch || s.branchId,
          };
        });

        // 2. Fetch Expenses
        let expenseDocs: any[] = [];
        try {
          let expQ: Query;
          if (needsAllTime) {
            expQ = isAdmin
              ? query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))
              : query(collection(db, 'expenses'), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
          } else {
            const startMs = new Date(dateRange!.start + 'T00:00:00').getTime();
            const endMs = new Date(dateRange!.end + 'T23:59:59.999').getTime();
            expQ = isAdmin
              ? query(collection(db, 'expenses'), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs))
              : query(collection(db, 'expenses'), where('branchId', '==', branchId), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs));
          }
          const snap = await getDocs(expQ);
          expenseDocs = snap.docs;
        } catch (e) {
          console.warn('Composite historical expenses query fallback:', e);
          const rawQ = isAdmin
            ? query(collection(db, 'expenses'))
            : query(collection(db, 'expenses'), where('branchId', '==', branchId));
          const snap = await getDocs(rawQ);
          expenseDocs = snap.docs;
        }

        const mappedExpenses: Expense[] = expenseDocs.map(doc => {
          const data = doc.data();
          const rawTitle = data.title || '';
          const rawDesc = data.description || '';
          const rawCat = data.category || 'General';
          const titleLower = rawTitle.toLowerCase();
          const descLower = rawDesc.toLowerCase();
          const catLower = rawCat.toLowerCase();
          const isSalaryPayment =
            titleLower.includes('salary payment') ||
            descLower.includes('net salary payment') ||
            descLower.includes('salary payment') ||
            (titleLower.includes('salary') && !titleLower.includes('advance') && !descLower.includes('advance'));

          const isAdvance = data.isSalaryAdvance === true || (
            !isSalaryPayment && (
              titleLower.includes('salary advance') ||
              titleLower.includes('advance pay') ||
              descLower.includes('salary advance') ||
              descLower.includes('advance payment') ||
              (catLower.includes('advance') && !isSalaryPayment)
            )
          );

          return {
            id: doc.id,
            date: data.date || new Date().toISOString().slice(0, 10),
            category: rawCat,
            title: rawTitle,
            description: rawDesc,
            loggedBy: data.loggedBy || 'Admin',
            amount: Number(data.amount) || 0,
            employeeId: data.employeeId || '',
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
            isSalaryAdvance: isAdvance,
            isDeleted: data.isDeleted === true,
          };
        });

        if (!isCancelled) {
          setHistoricalSales(mappedSales);
          setHistoricalExpenses(mappedExpenses);
        }
      } catch (err) {
        console.error('Error fetching historical records from Firestore:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingHistorical(false);
        }
      }
    }

    fetchHistorical();

    return () => {
      isCancelled = true;
    };
  }, [preset, dateRange, user?.role, user?.branchId]);

  // ── Unified Sales and Expenses (deduplicated by ID) ──
  const effectiveSales = useMemo(() => {
    if (historicalSales.length === 0) return sales;
    const map = new Map<string, SaleRecord>();
    for (const s of sales) map.set(s.id, s);
    for (const s of historicalSales) map.set(s.id, s);
    return Array.from(map.values());
  }, [sales, historicalSales]);

  const effectiveExpenses = useMemo(() => {
    if (historicalExpenses.length === 0) return expenses;
    const map = new Map<string, Expense>();
    for (const e of expenses) map.set(e.id, e);
    for (const e of historicalExpenses) map.set(e.id, e);
    return Array.from(map.values());
  }, [expenses, historicalExpenses]);

  // Only count completed sales everywhere
  const completedSales = useMemo(
    () => effectiveSales.filter(s => (s.status ?? 'completed') === 'completed'),
    [effectiveSales],
  );

  // Sales and expenses strictly filtered to the selected period
  const periodSales = useMemo(
    () => completedSales.filter(s => inRange(s.date, dateRange)),
    [completedSales, dateRange],
  );

  const periodExpenses = useMemo(
    () => effectiveExpenses.filter(e => !e.isDeleted && inRange(e.date, dateRange)),
    [effectiveExpenses, dateRange],
  );

  // ── Period financial summary ────────────────────────────────────────────────
  const summary = useMemo(() => {
    // 1. Direct non-credit sales
    const directCashSales = periodSales
      .filter(s => s.paymentMethod === 'CASH' && !s.isCredit)
      .reduce((sum, s) => sum + s.total, 0);

    const directBankSales = periodSales
      .filter(s => ['BANK_NBS', 'BANK_NBM', 'BANK_TRANSFER'].includes(s.paymentMethod) && !s.isCredit)
      .reduce((sum, s) => sum + s.total, 0);

    const directMomoSales = periodSales
      .filter(s => ['MOMO_AIRTEL', 'MOMO_MPAMBA', 'AIRTEL_MONEY', 'TNM_MPAMBA'].includes(s.paymentMethod) && !s.isCredit)
      .reduce((sum, s) => sum + s.total, 0);

    // 2. Initial payments on CREDIT sales created within the period
    const creditInitialPayments = periodSales
      .filter(s => s.paymentMethod === 'CREDIT' || s.isCredit)
      .reduce((sum, s) => sum + (s.amountPaid || 0), 0);

    const newCreditIssued = periodSales
      .filter(s => s.paymentMethod === 'CREDIT' || s.isCredit)
      .reduce((sum, s) => sum + Math.max(0, s.total - (s.amountPaid || 0)), 0);

    // 3. Repayments collected within the period (from any credit sale from any date)
    let repaymentCash = 0;
    let repaymentBank = 0;
    let repaymentMomo = 0;

    completedSales.forEach(s => {
      if ((s.paymentMethod === 'CREDIT' || s.isCredit) && (s as any).repayments) {
        (s as any).repayments.forEach((rep: any) => {
          if (rep.date && inRange(rep.date.slice(0, 10), dateRange)) {
            const method = String(rep.method || 'CASH').toUpperCase();
            if (method === 'CASH') repaymentCash += rep.amount;
            else if (method.startsWith('BANK')) repaymentBank += rep.amount;
            else if (method.startsWith('MOMO') || method.includes('MPAMBA') || method.includes('AIRTEL')) repaymentMomo += rep.amount;
            else repaymentCash += rep.amount;
          }
        });
      }
    });

    const cashSales       = directCashSales + creditInitialPayments + repaymentCash;
    const bankSales       = directBankSales + repaymentBank;
    const momoSales       = directMomoSales + repaymentMomo;
    const transferSales   = bankSales + momoSales;
    const totalSales      = cashSales + transferSales;
    const realizedRevenue = totalSales;

    // Operating expenses only (exclude recoverable salary advances)
    const operatingExpenses = periodExpenses.filter(e => !isSalaryAdvanceExpense(e));
    const totalExpenses = operatingExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Gross profit (revenue - cost of goods sold - discounts) over the period
    const grossProfit = periodSales.reduce((sum, s) => sum + calcSaleProfit(s), 0);
    const netProfit   = grossProfit - totalExpenses;
    const netRevenue  = realizedRevenue - totalExpenses;

    const txCount = periodSales.length;

    return {
      cashSales, bankSales, momoSales, transferSales,
      totalSales, realizedRevenue, creditSales: newCreditIssued,
      totalExpenses, grossProfit, netProfit, netRevenue, txCount,
    };
  }, [periodSales, periodExpenses, completedSales, dateRange]);

  // ── 7-day trend chart (always last 7 calendar days — independent of reporting period) ──
  const trendData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatYMD(d);
      const daySales = completedSales.filter(s => s.date === dateStr);

      const directAndInitial = daySales.reduce((sum, s) => {
        if (s.paymentMethod === 'CREDIT') return sum + (s.amountPaid || 0);
        return sum + s.total;
      }, 0);

      let repayments = 0;
      completedSales.forEach(s => {
        if (s.paymentMethod === 'CREDIT' && (s as any).repayments) {
          (s as any).repayments.forEach((rep: any) => {
            if (rep.date && rep.date.startsWith(dateStr)) repayments += rep.amount;
          });
        }
      });

      const daySalesTotal = directAndInitial + repayments;
      const dayExpenses = effectiveExpenses
        .filter(e => e.date === dateStr && !e.isDeleted && !isSalaryAdvanceExpense(e))
        .reduce((sum, e) => sum + e.amount, 0);
      const dayProfit = daySales.reduce((sum, s) => sum + calcSaleProfit(s), 0) - dayExpenses;

      data.push({
        name: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: dateStr,
        Sales: daySalesTotal,
        Expenses: dayExpenses,
        Profit: dayProfit,
      });
    }
    return data;
  }, [completedSales, effectiveExpenses]);

  // ── Item analytics for selected period ──
  const itemData = useMemo(() => {
    const byItem: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};

    for (const sale of periodSales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const name = item.name || 'Unknown';
        if (!byItem[name]) byItem[name] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        const rev  = item.quantity * item.unitPrice;
        const cst  = (item.costPrice || 0) * item.quantity;
        byItem[name].revenue += rev;
        byItem[name].cost    += cst;
        byItem[name].profit  += rev - cst;
        byItem[name].count   += item.quantity;
      }
    }

    const itemRows = Object.entries(byItem)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.profit - a.profit);

    const chartData = itemRows.slice(0, 10).map(r => ({
      name: r.name, Revenue: r.revenue, Cost: r.cost, Profit: r.profit,
    }));

    return { itemRows, chartData };
  }, [periodSales]);

  // ── Period transactions (paginated, sorted newest first) ──
  const periodTransactions = useMemo(() => {
    return periodSales.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.time || '') < (b.time || '') ? 1 : -1;
    });
  }, [periodSales]);

  const handlePrint = () => window.print();

  const cur = settings.currency;
  const label = rangeLabel(dateRange, preset);

  // Profit margin percentage
  const marginPct = summary.totalSales > 0
    ? Math.round(summary.netProfit / summary.totalSales * 100)
    : 0;

  const isGlobalLoading = isLoadingSales || isLoadingExpenses || isLoadingHistorical;

  return (
    <div className="p-1.5 sm:p-3 md:p-6 pb-24">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <BarChart3 size={24} className="sm:w-7 sm:h-7" /> Business Reports
          </h1>
          <p className="text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">
            Financial summary, cash reconciliation, and period analytics
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Quick period dropdown */}
          <select
            value={preset}
            onChange={e => {
              setPreset(e.target.value as PeriodPreset);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary outline-none text-xs sm:text-sm bg-white font-medium text-gray-700 shadow-xs cursor-pointer"
          >
            {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map(p => (
              <option key={p} value={p}>
                {PRESET_LABELS[p]}
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition text-xs sm:text-sm shadow-xs"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* ── Historical Query Loading Banner ── */}
      {isLoadingHistorical && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm animate-pulse">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <span>Fetching historical records from Firestore for <strong>{PRESET_LABELS[preset]}</strong>...</span>
        </div>
      )}

      {/* ── Date Filter Panel ── */}
      <div className="bg-white border rounded-xl shadow-sm mb-5">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition rounded-xl"
          onClick={() => setFilterOpen(f => !f)}
        >
          <span className="flex items-center gap-2">
            <Filter size={16} className="text-primary" />
            <span>Reporting Period:</span>
            <span className="text-primary font-bold">{PRESET_LABELS[preset]}</span>
            {label && (
              <span className="hidden sm:inline text-gray-500 font-normal text-xs ml-1">
                ({label})
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium hover:underline hidden sm:inline">
              {filterOpen ? 'Collapse filter' : 'Change filter'}
            </span>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {filterOpen && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* Preset grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPreset(p); setPage(1); }}
                  className={`text-xs px-3 py-2 rounded-lg border font-medium transition text-left
                    ${preset === p
                      ? 'bg-primary text-white border-primary shadow'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-primary hover:text-primary'
                    }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Custom date range inputs */}
            {preset === 'custom_range' && (
              <div className="flex flex-wrap gap-3 items-center pt-1 bg-gray-50 p-3 rounded-lg border">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600 font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || today}
                    onChange={e => { setCustomStart(e.target.value); setPage(1); }}
                    className="border bg-white rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary outline-none text-xs sm:text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600 font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
                    className="border bg-white rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary outline-none text-xs sm:text-sm"
                  />
                </div>
              </div>
            )}

            {/* Specific month selector */}
            {preset === 'specific_month' && (
              <div className="flex flex-col gap-1 pt-1 bg-gray-50 p-3 rounded-lg border">
                <label className="text-xs text-gray-600 font-medium">Select Month &amp; Year</label>
                <select
                  value={`${specificYear}-${specificMonth}`}
                  onChange={e => {
                    const [y, mo] = e.target.value.split('-').map(Number);
                    setSpecificYear(y);
                    setSpecificMonth(mo);
                    setPage(1);
                  }}
                  className="border bg-white rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-primary outline-none text-xs sm:text-sm max-w-xs"
                >
                  {MONTH_OPTIONS.map(opt => (
                    <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Period clarification notes */}
            <div className="text-xs text-gray-500 border-t pt-2 space-y-0.5">
              <p>
                <strong className="text-gray-700">Previous N Complete Months</strong>
                {' '}— covers full calendar months that have completely concluded, excluding the current month.
              </p>
              <p>
                <strong className="text-gray-700">This Month</strong>
                {' '}— from the 1st of the current month to today.
                <strong className="text-gray-700"> Year to Date</strong>
                {' '}— from January 1 of this year to today.
              </p>
              {label && (
                <p className="text-primary font-semibold pt-1">
                  Active Period: {label}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Period Revenue & Profit Hero Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 sm:mb-6">
        {/* Net Realized Revenue */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-4 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="text-blue-200 font-medium mb-1.5 sm:mb-2 flex items-center gap-1.5 text-xs sm:text-sm">
              <DollarSign size={16} /> Net Realized Revenue
            </div>
            <div className="text-3xl sm:text-5xl font-extrabold mb-1">
              {cur} {summary.netRevenue.toLocaleString()}
            </div>
            <div className="text-blue-200 text-xs sm:text-sm mt-1.5 sm:mt-2">
              Realized Revenue ({cur} {summary.realizedRevenue.toLocaleString()}) – Expenses ({cur} {summary.totalExpenses.toLocaleString()})
            </div>
            {summary.netRevenue < 0 && (
              <div className="mt-2.5 flex items-center gap-2 bg-red-400/30 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold">
                <AlertCircle size={15} /> Warning: Expenses exceed realized revenue for this period!
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-500/40 text-xs text-blue-200 flex items-center justify-between">
            <span>Cash: {cur} {summary.cashSales.toLocaleString()}</span>
            <span>Bank/Transfer: {cur} {summary.transferSales.toLocaleString()}</span>
          </div>
        </div>

        {/* Gross Profit / Net Profit */}
        <div className={`rounded-xl p-4 sm:p-6 shadow-md flex flex-col justify-between border
          ${summary.netProfit >= 0
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white border-emerald-700'
            : 'bg-gradient-to-r from-red-600 to-red-800 text-white border-red-700'
          }`}
        >
          <div>
            <div className="text-emerald-100 font-medium mb-1.5 sm:mb-2 flex items-center gap-1.5 text-xs sm:text-sm">
              <Activity size={16} /> Net Profit ({PRESET_LABELS[preset]})
            </div>
            <div className="text-3xl sm:text-5xl font-extrabold mb-1">
              {cur} {summary.netProfit.toLocaleString()}
            </div>
            <div className="text-emerald-100 text-xs sm:text-sm mt-1.5 sm:mt-2">
              Gross Profit ({cur} {summary.grossProfit.toLocaleString()}) – Operating Expenses ({cur} {summary.totalExpenses.toLocaleString()})
            </div>
            <div className="text-xs mt-2 opacity-80">
              Profit margin: {marginPct}% of total sales
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-500/40 text-xs text-emerald-100 flex items-center justify-between">
            <span>{summary.txCount} completed transactions</span>
            <span>Credit issued: {cur} {summary.creditSales.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500 font-medium">Total Sales</div>
            <TrendingUp size={18} className="text-green-500" />
          </div>
          <div className="text-xl font-bold text-green-600">{cur} {summary.totalSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{summary.txCount} transactions</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500 font-medium">Cash Sales</div>
            <DollarSign size={18} className="text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600">{cur} {summary.cashSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">
            {summary.totalSales > 0 ? Math.round(summary.cashSales / summary.totalSales * 100) : 0}% of total
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500 font-medium">Credit Sales</div>
            <CreditCard size={18} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">{cur} {summary.creditSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Uncollected credit debt</div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500 font-medium">Total Expenses</div>
            <TrendingDown size={18} className="text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-600">{cur} {summary.totalExpenses.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Operating expenses only</div>
        </div>
        <div className={`p-4 rounded-lg border shadow-sm ${summary.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-600 font-medium">Net Profit</div>
            <Activity size={18} className={summary.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
          </div>
          <div className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {cur} {summary.netProfit.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">{marginPct}% margin</div>
        </div>
      </div>

      {/* ── 7-Day Trend Chart (always last 7 days, period-independent) ── */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Calendar size={20} /> 7-Day Trend Overview
          </h2>
          <span className="text-xs text-gray-400">Last 7 calendar days</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(val) => `${cur} ${(val/1000)}k`} dx={-10} />
              <Tooltip formatter={(value: number) => [`${cur} ${value.toLocaleString()}`]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
              <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Payment Method Breakdown & Revenue Reconciliation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <ShoppingBag size={20} /> Payment Method Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Cash', value: summary.cashSales, color: 'bg-blue-500' },
              { label: 'Mobile Money (MoMo)', value: summary.momoSales, color: 'bg-red-500' },
              { label: 'Bank Transfer', value: summary.bankSales, color: 'bg-purple-500' },
              { label: 'Credit / Pay Later', value: summary.creditSales, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <span className="font-bold">{cur} {item.value.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${summary.totalSales > 0 ? Math.round(item.value / summary.totalSales * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Reconciliation */}
        <div className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <DollarSign size={20} /> Revenue &amp; Expense Reconciliation
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">+ Cash Sales</span>
              <span className="font-semibold text-green-600">+ {cur} {summary.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">+ Bank / Mobile Transfer Sales</span>
              <span className="font-semibold text-purple-600">+ {cur} {summary.transferSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b font-medium text-gray-700">
              <span>= Total Realized Revenue</span>
              <span>{cur} {summary.realizedRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">– Total Expenses Paid</span>
              <span className="font-semibold text-red-600">– {cur} {summary.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 mt-3">
              <span className="font-bold text-gray-800">Net Realized Revenue</span>
              <span className="font-extrabold text-blue-700 text-lg">{cur} {summary.netRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-t mt-2">
              <span className="text-gray-600">Gross Profit (accrual)</span>
              <span className="font-semibold text-emerald-600">{cur} {summary.grossProfit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">– Operating Expenses</span>
              <span className="font-semibold text-red-600">– {cur} {summary.totalExpenses.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between py-3 rounded-lg px-3 mt-1 ${summary.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <span className="font-bold text-gray-800">Net Profit</span>
              <span className={`font-extrabold text-lg ${summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {cur} {summary.netProfit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Item Analytics (for selected period) ── */}
      {itemData.chartData.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Package size={20} /> Top Items by Revenue &amp; Profit
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({PRESET_LABELS[preset]}{label ? ` · ${label}` : ''})
            </span>
          </h2>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemData.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${cur}${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${cur} ${v.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-2 text-left">Item Name</th>
                  <th className="py-2 text-center">Units Sold</th>
                  <th className="py-2 text-right">Total Revenue</th>
                  <th className="py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {itemData.itemRows.map(r => (
                  <tr key={r.name} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="py-2 text-center">{r.count}</td>
                    <td className="py-2 text-right font-semibold">{cur} {r.revenue.toLocaleString()}</td>
                    <td className={`py-2 text-right font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {cur} {r.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cumulative All-Time Banner (when All Time is active) ── */}
      {preset === 'all_time' && (
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl p-6 mb-6 shadow-lg">
          <h2 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" /> Cumulative All-Time Summary
            <span className="text-xs font-normal text-slate-400 ml-2">(completed sales only)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Revenue</div>
              <div className="text-3xl font-extrabold text-white">{cur} {summary.realizedRevenue.toLocaleString()}</div>
              <div className="text-slate-400 text-xs mt-1">All completed sales</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Expenses</div>
              <div className="text-3xl font-extrabold text-red-300">{cur} {summary.totalExpenses.toLocaleString()}</div>
              <div className="text-slate-400 text-xs mt-1">All recorded expenses</div>
            </div>
            <div className={`rounded-xl p-4 ${summary.netProfit >= 0 ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}>
              <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Profit</div>
              <div className={`text-3xl font-extrabold ${summary.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {cur} {summary.netProfit.toLocaleString()}
              </div>
              <div className="text-slate-400 text-xs mt-1">
                {summary.realizedRevenue > 0
                  ? `${Math.round(summary.netProfit / summary.realizedRevenue * 100)}% overall margin`
                  : 'No sales yet'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Savings box — shown contextually for month-based periods ── */}
      {(preset === 'this_month' || preset === 'last_month' || preset === 'specific_month') && settings.dailySavingsEnabled !== false && (
        <div className="bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-900 text-white rounded-xl p-4 sm:p-6 shadow-lg mb-6 border border-violet-700/50 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="text-amber-300 font-medium mb-1.5 flex items-center gap-1.5 text-xs sm:text-sm">
            <PiggyBank size={18} className="text-amber-300" />
            <span>Savings Target (at {settings.dailySavingsPercentage ?? 10}% of Net Profit)</span>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
            {cur} {summary.netProfit > 0
              ? Math.round(summary.netProfit * ((settings.dailySavingsPercentage ?? 10) / 100)).toLocaleString()
              : 0}
          </div>
          <div className="text-amber-100 text-xs sm:text-sm mt-1">
            Fund: <strong className="text-amber-300">{settings.dailySavingsPurpose || 'Business Reserve & Emergency Fund'}</strong>
          </div>
          <div className="mt-3 pt-3 border-t border-violet-700/60 flex items-center justify-between text-xs">
            <span className="text-amber-300 font-medium">Free Retained Cash (after savings):</span>
            <span className="font-extrabold text-sm text-violet-300">
              {cur} {summary.netProfit > 0
                ? Math.max(0, summary.netProfit - Math.round(summary.netProfit * ((settings.dailySavingsPercentage ?? 10) / 100))).toLocaleString()
                : 0}
            </span>
          </div>
        </div>
      )}

      {/* ── Transactions Table ── */}
      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center flex-wrap gap-2">
          <span>
            Transactions
            {label && <span className="text-sm font-normal text-gray-500 ml-2">({label})</span>}
          </span>
          <span className="text-sm font-normal text-gray-500">{periodTransactions.length} completed</span>
        </div>
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Date</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Time</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Cashier</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Method</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Amount ({cur})</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Profit ({cur})</th>
            </tr>
          </thead>
          <tbody>
            {isGlobalLoading && periodTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-lg font-medium text-gray-600">Loading reports...</p>
                    <p className="text-sm">Please wait while records are loaded.</p>
                  </div>
                </td>
              </tr>
            ) : periodTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <BarChart3 size={32} className="text-gray-300" />
                    <p className="font-medium">No completed transactions found for this period.</p>
                    <p className="text-xs text-gray-400">Try selecting a different reporting period above.</p>
                  </div>
                </td>
              </tr>
            ) : (
              periodTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(tx => {
                const txProfit = calcSaleProfit(tx);
                return (
                  <tr key={tx.id || tx.invoiceNumber} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm text-primary font-semibold">{tx.invoiceNumber}</td>
                    <td className="p-4 text-gray-600 text-sm">{tx.date}</td>
                    <td className="p-4 text-gray-600">{tx.time}</td>
                    <td className="p-4">{tx.cashier}</td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        tx.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                        tx.paymentMethod === 'CREDIT' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {tx.paymentMethod.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold">{tx.total.toLocaleString()}</td>
                    <td className={`p-4 text-right font-bold ${txProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {txProfit.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {periodTransactions.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, periodTransactions.length)} of {periodTransactions.length} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border bg-white rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(periodTransactions.length / PAGE_SIZE), p + 1))}
                disabled={page >= Math.ceil(periodTransactions.length / PAGE_SIZE)}
                className="p-1 border bg-white rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
