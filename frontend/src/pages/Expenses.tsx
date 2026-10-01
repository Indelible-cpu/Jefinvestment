import { useState, useEffect, useMemo } from 'react';
import { Plus, Receipt, X, Trash2, Share2, Printer, Calendar, Filter, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';
import { useExpenseStore } from '../store/dataStore';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

const BASE_CATEGORIES = [
  'Store Supplies', 'Transport', 'Electricity', 'Printing', 'Maintenance',
  'Staff Meal', 'Internet', 'Airtime', 'Rent', 'Salary / Advance Pay', 'Other'
];

const today = new Date().toISOString().slice(0, 10);

type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom';

export default function Expenses() {
  const { expenses, isLoading, addExpense, deleteExpense, loadExpenses } = useExpenseStore();
  const { addLog } = useAuditStore();
  const settings = useSettingsStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const emptyForm = () => ({ category: 'Store Supplies', description: '', amount: 0, loggedBy: user?.name || 'Unknown' });

  useEffect(() => {
    loadExpenses();
  }, []);
  
  // Sync loggedBy whenever user loads (auth may not be ready on first render)
  useEffect(() => {
    if (user?.name) {
      setForm(f => ({ ...f, loggedBy: user.name! }));
    }
  }, [user?.name]);

  // Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic categories including any existing categories from expenses
  const allCategories = useMemo(() => {
    const set = new Set<string>(BASE_CATEGORIES);
    expenses.forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [expenses]);

  // Handle Preset Changes
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'this_week') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      setStartDate(monday.toISOString().slice(0, 10));
      setEndDate(new Date().toISOString().slice(0, 10));
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      // Date filter
      if (datePreset === 'all') {
        // all time
      } else if (datePreset === 'today' || datePreset === 'yesterday') {
        if (startDate && e.date !== startDate) return false;
      } else {
        if (startDate && e.date < startDate) return false;
        if (endDate && e.date > endDate) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(term);
        const catMatch = (e.category || '').toLowerCase().includes(term);
        const loggedByMatch = (e.loggedBy || '').toLowerCase().includes(term);
        if (!descMatch && !catMatch && !loggedByMatch) return false;
      }

      return true;
    });
  }, [expenses, datePreset, startDate, endDate, categoryFilter, searchTerm]);

  const totalFiltered = useMemo(() => {
    return filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filtered]);

  // Breakdown by Category for summaries
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const cat = e.category || 'Other';
      map[cat] = (map[cat] || 0) + (Number(e.amount) || 0);
    });
    return map;
  }, [filtered]);

  // Active filter range description for reports / share
  const activeRangeDescription = useMemo(() => {
    if (datePreset === 'all') return 'All Time';
    if (datePreset === 'today') return `Today (${startDate})`;
    if (datePreset === 'yesterday') return `Yesterday (${startDate})`;
    if (datePreset === 'this_week') return `This Week (${startDate} to ${endDate})`;
    if (datePreset === 'this_month') return `This Month (${startDate} to ${endDate})`;
    if (datePreset === 'last_month') return `Last Month (${startDate} to ${endDate})`;
    return `Date Range: ${startDate || 'Start'} to ${endDate || 'Now'}`;
  }, [datePreset, startDate, endDate]);

  // WhatsApp Share handler
  const handleWhatsAppShare = () => {
    const cur = settings.currency;
    const catBreakdown = Object.entries(categoryTotals)
      .map(([cat, amt]) => `  • ${cat}: ${cur} ${amt.toLocaleString()}`)
      .join('\n');

    const topEntries = filtered.slice(0, 15).map((e, i) => 
      `  ${i + 1}. [${e.date}] ${e.category} - ${e.description}: ${cur} ${e.amount.toLocaleString()} (${e.loggedBy})`
    ).join('\n');

    const moreText = filtered.length > 15 ? `\n  ...and ${filtered.length - 15} more entries.` : '';

    const message = 
`*EXPENSE REPORT — ${settings.storeName || 'MsikaFlo'}*
Period: ${activeRangeDescription}
Category Filter: ${categoryFilter === 'ALL' ? 'All Categories' : categoryFilter}
Total Entries: ${filtered.length}
*Total Expenses: ${cur} ${totalFiltered.toLocaleString()}*

*CATEGORY BREAKDOWN:*
${catBreakdown || '  No records'}

*EXPENSE ENTRIES:*
${topEntries || '  No expenses recorded.'}${moreText}

_Generated: ${new Date().toLocaleString()}_`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Print Report handler
  const handlePrint = () => {
    const cur = settings.currency;
    const rows = filtered.length ? filtered.map((e, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${e.date}</td>
        <td><strong>${e.category}</strong></td>
        <td>${e.description}</td>
        <td>${e.loggedBy}</td>
        <td style="text-align:right;font-weight:bold">${cur} ${e.amount.toLocaleString()}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">No expenses found for this filter.</td></tr>';

    const catSummaryRows = Object.entries(categoryTotals).map(([cat, amt]) => `
      <tr>
        <td><strong>${cat}</strong></td>
        <td style="text-align:right">${cur} ${amt.toLocaleString()}</td>
        <td style="text-align:right">${totalFiltered > 0 ? ((amt / totalFiltered) * 100).toFixed(1) : '0'}%</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Expense Report — ${settings.storeName || 'MsikaFlo'}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; line-height: 1.4; }
    h1 { font-size: 22px; margin: 0 0 4px 0; color: #1e3a8a; }
    .subtitle { color: #555; font-size: 13px; margin-bottom: 20px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .meta-item { font-size: 12px; }
    .meta-item strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .total-row { font-weight: bold; background: #f8fafc; font-size: 14px; }
    .section-title { font-size: 15px; font-weight: bold; color: #334155; margin: 24px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
    .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${settings.storeName || 'MsikaFlo'}</h1>
  <div class="subtitle">Expense &amp; Petty Cash Audit Report</div>

  <div class="meta-box">
    <div class="meta-item">
      <strong>Period</strong>
      <span>${activeRangeDescription}</span>
    </div>
    <div class="meta-item">
      <strong>Category Filter</strong>
      <span>${categoryFilter === 'ALL' ? 'All Categories' : categoryFilter}</span>
    </div>
    <div class="meta-item">
      <strong>Total Records</strong>
      <span>${filtered.length} entries</span>
    </div>
    <div class="meta-item">
      <strong>Total Expense Amount</strong>
      <span style="font-size:16px;color:#dc2626;font-weight:bold">${cur} ${totalFiltered.toLocaleString()}</span>
    </div>
  </div>

  <div class="section-title">📊 Category Breakdown</div>
  <table style="width: auto; min-width: 380px;">
    <thead>
      <tr>
        <th>Category</th>
        <th style="text-align:right">Total</th>
        <th style="text-align:right">Share</th>
      </tr>
    </thead>
    <tbody>
      ${catSummaryRows || '<tr><td colspan="3">None</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">📝 Itemized Expenses</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">#</th>
        <th style="width:90px">Date</th>
        <th style="width:140px">Category</th>
        <th>Description</th>
        <th style="width:110px">Logged By</th>
        <th style="width:120px;text-align:right">Amount (${cur})</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" style="text-align:right">GRAND TOTAL</td>
        <td style="text-align:right;color:#dc2626">${cur} ${totalFiltered.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Printed on ${new Date().toLocaleString()} by ${user?.name || 'Authorized Staff'}</span>
    <span>MsikaFlo Financial Accounting</span>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.description.trim()) { setError('Description is required.'); return; }
    if (form.amount <= 0) { setError('Amount must be greater than zero.'); return; }
    
    setIsSubmitting(true);
    try {
      await addExpense({ ...form });
      toast.success('Expense logged successfully');
      setForm(emptyForm());
      setShowModal(false);
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Expense saved locally and will sync when online.' });
        setForm(emptyForm());
        setShowModal(false);
      } else {
        setError(err.message || 'Failed to save expense');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string, description: string) => {
    toast('Remove this expense entry?', {
      action: {
        label: 'Remove',
        onClick: async () => {
          try {
            await deleteExpense(id);
            addLog('DELETE_EXPENSE', `Deleted expense: ${description}`);
            toast.success('Expense removed');
          } catch (err: any) {
            if (err.message === 'OFFLINE_QUEUED') {
              toast.warning('Offline', { description: 'Delete queued and will sync when online.' });
            } else {
              toast.error('Failed to delete expense', { description: err.message });
            }
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  return (
    <div className="p-1.5 sm:p-3 md:p-6 min-h-full pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Receipt size={26} className="sm:w-7 sm:h-7" /> Expense Management
          </h1>
          <p className="text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-sm">
            Track, filter, export, and analyze all petty cash and business operational expenses.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start">
          <button
            onClick={handleWhatsAppShare}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 text-xs sm:text-sm transition shadow-sm"
            title="Share current filtered expenses via WhatsApp"
          >
            <Share2 size={16} /> WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="bg-card hover:bg-muted border text-foreground px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 text-xs sm:text-sm transition shadow-xs"
            title="Print or save as PDF"
          >
            <Printer size={16} /> Print Report
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-3.5 py-2 rounded-xl font-semibold hover:bg-blue-700 flex items-center gap-1.5 transition shadow-sm text-xs sm:text-sm"
          >
            <Plus size={18} /> Log Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border shadow-xs sm:shadow-sm">
          <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">
            Total for Period ({activeRangeDescription})
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 font-mono">
            {settings.currency} {totalFiltered.toLocaleString()}
          </div>
        </div>
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border shadow-xs sm:shadow-sm">
          <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Number of Entries</div>
          <div className="text-2xl sm:text-3xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-card p-3.5 sm:p-5 rounded-2xl border shadow-xs sm:shadow-sm">
          <div className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Largest Single Expense</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono">
            {settings.currency} {filtered.length > 0 ? Math.max(...filtered.map(e => e.amount || 0)).toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card rounded-2xl border p-3.5 sm:p-4 mb-5 shadow-xs space-y-3">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
            <Filter size={13} /> Timeframe:
          </span>
          {([
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom Range' },
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                datePreset === p.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Inputs & Category Select & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs sm:text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="ALL">All Categories ({expenses.length})</option>
              {allCategories.map(cat => {
                const count = expenses.filter(e => e.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setDatePreset('custom');
                setStartDate(e.target.value);
              }}
              disabled={datePreset === 'all'}
              className="w-full border rounded-xl px-3 py-2 text-xs sm:text-sm bg-background focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setDatePreset('custom');
                setEndDate(e.target.value);
              }}
              disabled={datePreset === 'all'}
              className="w-full border rounded-xl px-3 py-2 text-xs sm:text-sm bg-background focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
            />
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Search Description / Staff</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full border rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table - wrapped for horizontal scroll on mobile */}
      <div className="bg-card rounded-2xl border shadow-xs overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="p-4 font-semibold text-gray-600 text-xs">Date</th>
              <th className="p-4 font-semibold text-gray-600 text-xs">Category</th>
              <th className="p-4 font-semibold text-gray-600 text-xs">Description</th>
              <th className="p-4 font-semibold text-gray-600 text-xs">Logged By</th>
              <th className="p-4 font-semibold text-gray-600 text-xs text-right">Amount ({settings.currency})</th>
              <th className="p-4 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-lg font-medium text-gray-600">Loading expenses...</p>
                    <p className="text-sm">Please wait while we fetch the records.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  <Receipt size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-gray-600">No expenses found for this criteria.</p>
                  <p className="text-xs text-gray-400 mt-1">Try switching to "All Time" or adjusting the category/search.</p>
                </td>
              </tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b hover:bg-muted/30 transition text-sm">
                <td className="p-4 text-gray-600 font-mono text-xs">{e.date}</td>
                <td className="p-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    e.category === 'Salary / Advance Pay'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {e.category}
                  </span>
                </td>
                <td className="p-4 text-gray-900 font-medium">{e.description}</td>
                <td className="p-4 text-gray-500 text-xs">{e.loggedBy}</td>
                <td className="p-4 text-right font-bold text-red-600 font-mono text-sm">
                  {e.amount.toLocaleString()}
                </td>
                <td className="p-4 text-right">
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(e.id, e.description)}
                      className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition"
                      title="Delete expense"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr className="bg-muted/20 font-bold border-t-2">
                <td colSpan={4} className="p-4 text-right text-gray-700 text-xs sm:text-sm">
                  Total ({filtered.length} entries)
                </td>
                <td className="p-4 text-right text-red-600 text-base sm:text-lg font-mono">
                  {settings.currency} {totalFiltered.toLocaleString()}
                </td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* Log Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <form className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Receipt size={22} /> Log Expense
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Bought printer ink"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount ({settings.currency}) *</label>
                <input
                  type="number"
                  value={form.amount || ''}
                  onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  onFocus={(e) => e.target.select()}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="0"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Logged By</label>
                <input
                  type="text"
                  value={form.loggedBy}
                  disabled
                  className="w-full p-2.5 border rounded-lg bg-gray-100 text-gray-500 outline-none cursor-not-allowed"
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end rounded-b-xl">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 font-medium">Cancel</button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
