import { useState, useMemo } from 'react';
import {
  Search, Filter, ChevronLeft, ChevronRight, Eye, Printer, MoreVertical,
  Ban, RefreshCcw, Download, CheckCircle2, Clock, X,
  ShoppingBag, Banknote, WifiOff, Wifi, ArrowUpDown, CalendarRange, Trash2,
} from 'lucide-react';
import { useSaleStore, type SaleRecord } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';
import { useAuditStore } from '../store/auditStore';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';

const PAGE_SIZE = 15;

// Labels used to DISPLAY payment method names — covers current keys and legacy keys
const PAYMENT_LABELS: Record<string, string> = {
  CASH:          'Cash',
  CREDIT:        'Credit',
  MOMO_AIRTEL:   'Airtel Money',
  MOMO_MPAMBA:   'TNM Mpamba',
  BANK_NBS:      'Bank (NBS)',
  BANK_NBM:      'Bank (NBM)',
  // legacy keys — kept so older records still display correctly
  BANK_TRANSFER: 'Bank Transfer',
  AIRTEL_MONEY:  'Airtel Money',
  TNM_MPAMBA:    'TNM Mpamba',
};

// Options shown in the payment filter dropdown (current keys only — no duplicates)
const PAYMENT_FILTER_OPTIONS = [
  { value: 'CASH',        label: 'Cash' },
  { value: 'MOMO_AIRTEL', label: 'Airtel Money' },
  { value: 'MOMO_MPAMBA', label: 'TNM Mpamba' },
  { value: 'BANK_NBS',    label: 'Bank (NBS)' },
  { value: 'BANK_NBM',    label: 'Bank (NBM)' },
  { value: 'CREDIT',      label: 'Credit' },
];

const PAYMENT_COLORS: Record<string, string> = {
  CASH:          'bg-green-100 text-green-700',
  CREDIT:        'bg-orange-100 text-orange-700',
  MOMO_AIRTEL:   'bg-red-100 text-red-700',
  MOMO_MPAMBA:   'bg-yellow-100 text-yellow-700',
  BANK_NBS:      'bg-blue-100 text-blue-700',
  BANK_NBM:      'bg-emerald-100 text-emerald-700',
  // legacy keys
  BANK_TRANSFER: 'bg-blue-100 text-blue-700',
  AIRTEL_MONEY:  'bg-red-100 text-red-700',
  TNM_MPAMBA:    'bg-yellow-100 text-yellow-700',
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  refunded: { label: 'Refunded', icon: RefreshCcw, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  voided: { label: 'Voided', icon: Ban, cls: 'bg-red-50 text-red-600 border border-red-200' },
};

// ─── Sale Detail Modal ─────────────────────────────────────────────────────────
function SaleDetailModal({ sale, onClose, isAdmin, onUpdateStatus }: {
  sale: SaleRecord;
  onClose: () => void;
  isAdmin: boolean;
  onUpdateStatus: (id: string, status: 'refunded' | 'voided') => void;
}) {
  const settings = useSettingsStore();
  const [confirmAction, setConfirmAction] = useState<'refunded' | 'voided' | null>(null);

  const profit = (sale as any).profit !== undefined
    ? (sale as any).profit
    : sale.items.reduce((sum, item) => {
        const itemRevenue = item.quantity * item.unitPrice;
        const itemCost = (item.costPrice || 0) * item.quantity;
        return sum + (itemRevenue - itemCost);
      }, 0) - (sale.discount || 0);

  const handleConfirm = () => {
    if (!confirmAction) return;
    onUpdateStatus(sale.id, confirmAction);
    toast.success(`Sale ${sale.invoiceNumber} has been ${confirmAction}.`);
    setConfirmAction(null);
    onClose();
  };

  const StatusCfg = STATUS_CONFIG[sale.status ?? 'completed'];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-5 flex justify-between items-start">
          <div>
            <div className="text-xs text-blue-200 mb-1">Invoice Number</div>
            <h2 className="text-2xl font-bold font-mono">{sale.invoiceNumber}</h2>
            <div className="text-blue-200 text-sm mt-1">{sale.date} at {sale.time} &bull; {sale.cashier}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${StatusCfg.cls} bg-white`}>
              <StatusCfg.icon size={12} /> {StatusCfg.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {/* Items Table */}
          <div>
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><ShoppingBag size={16} /> Items Sold</h3>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-gray-500 font-semibold">Item</th>
                    <th className="text-center p-3 text-gray-500 font-semibold">Qty</th>
                    <th className="text-right p-3 text-gray-500 font-semibold">Unit Price</th>
                    <th className="text-right p-3 text-gray-500 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{settings.currency} {item.unitPrice.toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">{settings.currency} {(item.quantity * item.unitPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Breakdown & Profit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <h3 className="font-bold text-gray-700 mb-3">Payment Breakdown</h3>
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{settings.currency} {sale.subtotal.toLocaleString()}</span></div>
              {sale.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{settings.currency} {sale.discount.toLocaleString()}</span></div>}
              {sale.taxAmount > 0 && <div className="flex justify-between text-gray-600"><span>{sale.taxName || 'Tax'} ({sale.taxType === 'INCLUSIVE' ? 'incl.' : 'excl.'})</span><span>{settings.currency} {sale.taxAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t text-base"><span>Total</span><span>{settings.currency} {sale.total.toLocaleString()}</span></div>
              <div className="flex justify-between text-green-700 pt-1"><span>Amount Paid</span><span>{settings.currency} {sale.amountPaid.toLocaleString()}</span></div>
              {sale.paymentMethod === 'CASH' && sale.amountPaid > sale.total && (
                <div className="flex justify-between text-blue-600"><span>Change</span><span>{settings.currency} {(sale.amountPaid - sale.total).toLocaleString()}</span></div>
              )}
            </div>
            {isAdmin && (
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-center">
                <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Estimated Profit</div>
                <div className={`text-3xl font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
                  {settings.currency} {profit.toLocaleString()}
                </div>
                {profit <= 0 && <div className="text-xs text-red-500 mt-1">Cost prices not set — profit may be inaccurate.</div>}
              </div>
            )}
          </div>

          {/* Customer info if credit */}
          {sale.customerName && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm">
              <div className="font-bold text-orange-700 mb-1">Credit Sale Customer</div>
              <div>{sale.customerName} &bull; {sale.customerPhone}</div>
            </div>
          )}

          {/* Sync status */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {sale.syncStatus === 'synced' ? <><Wifi size={13} className="text-green-500" /> Synced to cloud</> : <><WifiOff size={13} className="text-amber-500" /> Pending sync</>}
          </div>

          {/* Actions */}
          {isAdmin && (sale.status ?? 'completed') === 'completed' && (
            <div>
              {confirmAction ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-700 mb-3">Are you sure you want to <strong className="capitalize">{confirmAction}</strong> this sale? This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition">Yes, {confirmAction}</button>
                    <button onClick={() => setConfirmAction(null)} className="px-4 py-2 border rounded-lg font-semibold text-sm hover:bg-gray-100 transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setConfirmAction('refunded')} className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-sm font-semibold hover:bg-amber-100 transition">
                    <RefreshCcw size={15} /> Process Refund
                  </button>
                  <button onClick={() => setConfirmAction('voided')} className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 bg-red-50 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                    <Ban size={15} /> Void Sale
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Sales Page ───────────────────────────────────────────────────────────
export default function Sales() {
  const { sales, updateSaleStatus, deleteSale } = useSaleStore();
  const { addLog } = useAuditStore();
  const settings = useSettingsStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Filters
  const [search, setSearch] = useState('');
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(currentMonthStart);
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null);
  const [reprintSale, setReprintSale] = useState<SaleRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Visible sales based on role
  const visibleSales = isAdmin ? sales : sales.filter(s => s.cashier === user?.name);

  const cashiers = useMemo(() => ['ALL', ...Array.from(new Set(visibleSales.map(s => s.cashier).filter(Boolean)))], [visibleSales]);

  const filtered = useMemo(() => {
    let result = [...visibleSales];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.customerName?.toLowerCase().includes(q)) ||
        (s.cashier?.toLowerCase().includes(q))
      );
    }
    if (dateFrom) result = result.filter(s => s.date >= dateFrom);
    if (dateTo) result = result.filter(s => s.date <= dateTo);
    if (paymentFilter !== 'ALL') result = result.filter(s => s.paymentMethod === paymentFilter);
    if (cashierFilter !== 'ALL') result = result.filter(s => s.cashier === cashierFilter);
    if (statusFilter !== 'ALL') result = result.filter(s => s.status === statusFilter);

    result.sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}`).getTime();
      const db = new Date(`${b.date}T${b.time}`).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });

    return result;
  }, [visibleSales, search, dateFrom, dateTo, paymentFilter, cashierFilter, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = filtered.reduce((s, r) => (r.status ?? 'completed') === 'completed' ? s + r.total : s, 0);
  const totalVoided = filtered.filter(s => (s.status ?? 'completed') === 'voided').length;
  const totalRefunded = filtered.filter(s => (s.status ?? 'completed') === 'refunded').length;

  const handleSort = () => {
    setSortOrder(o => o === 'newest' ? 'oldest' : 'newest');
    setPage(1);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Invoice No.', 'Date', 'Time', 'Cashier', 'Payment Method', 'Items', 'Total', 'Status'],
      ...filtered.map(s => [
        s.invoiceNumber, s.date, s.time, s.cashier,
        PAYMENT_LABELS[s.paymentMethod] || s.paymentMethod,
        s.items.length, s.total, s.status
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('Sales exported to CSV.');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Sales Transactions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isAdmin ? 'All sales across the system' : 'Your personal sales history'}</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition self-start"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Transactions', value: filtered.length.toLocaleString(), icon: ShoppingBag, color: 'bg-blue-500' },
          { label: 'Revenue (Completed)', value: `${settings.currency} ${totalRevenue.toLocaleString()}`, icon: Banknote, color: 'bg-emerald-500' },
          { label: 'Voided', value: totalVoided.toString(), icon: Ban, color: 'bg-red-500' },
          { label: 'Refunded', value: totalRefunded.toString(), icon: RefreshCcw, color: 'bg-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3">
            <div className={`${color} rounded-xl p-2.5 text-white`}><Icon size={20} /></div>
            <div>
              <div className="text-xs text-gray-500 font-medium">{label}</div>
              <div className="text-lg font-extrabold text-gray-900">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoice, customer, cashier..."
              className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Methods</option>
            {PAYMENT_FILTER_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="voided">Voided</option>
          </select>

          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-semibold transition ${showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={15} /> Advanced
          </button>

          <button
            onClick={handleSort}
            className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <ArrowUpDown size={15} /> {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1"><CalendarRange size={12} className="inline mr-1" />Date From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1"><CalendarRange size={12} className="inline mr-1" />Date To</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cashier</label>
                <select value={cashierFilter} onChange={e => { setCashierFilter(e.target.value); setPage(1); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {cashiers.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All Cashiers' : c}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPaymentFilter('ALL'); setCashierFilter('ALL'); setStatusFilter('ALL'); setPage(1); }}
                className="w-full px-3 py-2 text-sm border rounded-lg text-gray-500 hover:bg-gray-100 transition font-medium">
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ShoppingBag size={48} className="mb-3 opacity-40" />
            <div className="font-semibold text-lg">No sales found</div>
            <div className="text-sm">Try adjusting your filters or make a sale in the POS.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice No.</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cashier</th>
                  <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="text-center p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="text-center p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((sale) => {
                  const saleStatus = sale.status ?? 'completed';
                  const StatusCfg = STATUS_CONFIG[saleStatus];
                  const isVoidedOrRefunded = saleStatus !== 'completed';
                  return (
                    <tr
                      key={sale.id}
                      className={`border-b last:border-0 hover:bg-blue-50/30 transition-colors ${isVoidedOrRefunded ? 'opacity-60' : ''}`}
                    >
                      <td className="p-4">
                        <span className={`font-mono font-bold text-blue-700 text-xs ${isVoidedOrRefunded ? 'line-through' : ''}`}>
                          {sale.invoiceNumber}
                        </span>
                        {sale.syncStatus === 'pending' && (
                          <span className="ml-2 text-amber-500 text-xs" title="Pending sync"><WifiOff size={11} className="inline" /></span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{sale.date}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} /> {sale.time}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-700">{sale.cashier || '—'}</div>
                        {sale.customerName && <div className="text-xs text-gray-400">{sale.customerName}</div>}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${PAYMENT_COLORS[sale.paymentMethod] || 'bg-gray-100 text-gray-600'}`}>
                          {PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-semibold">{sale.items.length}</span>
                        <span className="text-gray-400 text-xs ml-1">item{sale.items.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-gray-900">{settings.currency} {sale.total.toLocaleString()}</span>
                        {isAdmin && sale.discount > 0 && (
                          <div className="text-xs text-red-400">-{settings.currency} {sale.discount.toLocaleString()} disc.</div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${StatusCfg.cls}`}>
                          <StatusCfg.icon size={11} /> {StatusCfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === sale.id ? null : sale.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuId === sale.id && (
                            <div
                              className="absolute right-0 mt-1 w-48 bg-white border rounded-xl shadow-xl z-20 py-1"
                              onMouseLeave={() => setOpenMenuId(null)}
                            >
                              <button
                                onClick={() => { setDetailSale(sale); setOpenMenuId(null); }}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                              >
                                <Eye size={15} /> View Details
                              </button>
                              <button
                                onClick={() => { setReprintSale(sale); setOpenMenuId(null); }}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                              >
                                <Printer size={15} /> Reprint Receipt
                              </button>
                              {isAdmin && (sale.status ?? 'completed') === 'completed' && (
                                <>
                                  <div className="border-t my-1" />
                                  <button
                                    onClick={() => { setDetailSale(sale); setOpenMenuId(null); }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition"
                                  >
                                    <RefreshCcw size={15} /> Refund
                                  </button>
                                  <button
                                    onClick={() => { setDetailSale(sale); setOpenMenuId(null); }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                                  >
                                    <Ban size={15} /> Void Sale
                                  </button>
                                </>
                              )}
                              {isAdmin && (sale.status === 'voided' || sale.status === 'refunded') && (
                                <>
                                  <div className="border-t my-1" />
                                  <button
                                    onClick={() => { setDeleteConfirmId(sale.id); setOpenMenuId(null); }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 font-semibold transition"
                                  >
                                    <Trash2 size={15} /> Delete Record
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-800">{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}</span>–<span className="font-semibold text-gray-800">{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-gray-800">{filtered.length}</span> transactions
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">Delete Sale Record?</div>
                <div className="text-sm text-gray-500">This permanently removes the record. Cannot be undone.</div>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={async () => {
                  await deleteSale(deleteConfirmId);
                  addLog('DELETE_SALE', `Permanently deleted sale record ID: ${deleteConfirmId}`);
                  toast.success('Sale record deleted.');
                  setDeleteConfirmId(null);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 border rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailSale && (
        <SaleDetailModal
          sale={detailSale}
          onClose={() => setDetailSale(null)}
          isAdmin={isAdmin}
          onUpdateStatus={(id, status) => {
            updateSaleStatus(id, status);
            addLog(status.toUpperCase() + '_SALE', `Changed status of invoice ${detailSale.invoiceNumber} to ${status}`);
            setDetailSale(null);
          }}
        />
      )}

      {/* Reprint Modal */}
      {reprintSale && (
        <ReceiptPreviewModal
          items={reprintSale.items.map(i => ({ ...i, id: i.name, sku: '', discount: 0, isService: false }))}
          subtotal={reprintSale.subtotal}
          discount={reprintSale.discount}
          taxAmount={reprintSale.taxAmount}
          taxName={reprintSale.taxName || 'Tax'}
          taxType={reprintSale.taxType || 'EXCLUSIVE'}
          total={reprintSale.total}
          paymentMethod={reprintSale.paymentMethod}
          amountPaid={reprintSale.amountPaid}
          customerName={reprintSale.customerName}
          customerPhone={reprintSale.customerPhone}
          invoiceNumber={reprintSale.invoiceNumber}
          onClose={() => setReprintSale(null)}
        />
      )}
    </div>
  );
}
