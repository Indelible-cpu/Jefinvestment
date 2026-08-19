import { useState, useEffect } from 'react';
import { Plus, Receipt, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';
import { useExpenseStore } from '../store/dataStore';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

const EXPENSE_CATEGORIES = [
  'Store Supplies', 'Transport', 'Electricity', 'Printing', 'Maintenance',
  'Staff Meal', 'Internet', 'Airtime', 'Rent', 'Other'
];

const today = new Date().toISOString().slice(0, 10);

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

  const [dateFilter, setDateFilter] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = expenses.filter(e => !dateFilter || e.date === dateFilter);
  const totalToday = filtered.reduce((sum, e) => sum + e.amount, 0);

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
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Receipt size={28} /> Expense Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Log and track all petty cash and business expenses</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition shadow-md self-start">
          <Plus size={20} /> Log Expense
        </button>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Today's Total Expenses</div>
          <div className="text-3xl font-bold text-red-600">{settings.currency} {totalToday.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Number of Entries (Today)</div>
          <div className="text-3xl font-bold">{filtered.length}</div>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Largest Single Expense</div>
          <div className="text-3xl font-bold">
            {settings.currency} {filtered.length > 0 ? Math.max(...filtered.map(e => e.amount)).toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-4 items-center mb-4">
        <label className="text-sm font-semibold text-gray-600">Filter by Date:</label>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary outline-none" />
        <button onClick={() => setDateFilter('')} className="text-sm text-gray-500 hover:text-gray-800 underline">Show All</button>
      </div>

      {/* Table - wrapped for horizontal scroll on mobile */}
      <div className="bg-white rounded-lg border shadow flex-1 overflow-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 font-semibold text-gray-600">Date</th>
              <th className="p-4 font-semibold text-gray-600">Category</th>
              <th className="p-4 font-semibold text-gray-600">Description</th>
              <th className="p-4 font-semibold text-gray-600">Logged By</th>
              <th className="p-4 font-semibold text-gray-600 text-right">Amount ({settings.currency})</th>
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
              <tr><td colSpan={6} className="p-12 text-center text-gray-400">No expenses recorded for this date.</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50 transition">
                <td className="p-4 text-gray-600 text-sm">{e.date}</td>
                <td className="p-4">
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">{e.category}</span>
                </td>
                <td className="p-4">{e.description}</td>
                <td className="p-4 text-gray-600">{e.loggedBy}</td>
                <td className="p-4 text-right font-bold text-red-600">{e.amount.toLocaleString()}</td>
                <td className="p-4 text-right">
                  {isAdmin && (
                    <button onClick={() => handleDelete(e.id, e.description)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr className="bg-gray-50 font-bold border-t-2">
                <td colSpan={4} className="p-4 text-right text-gray-700">Total</td>
                <td className="p-4 text-right text-red-700 text-lg">{settings.currency} {totalToday.toLocaleString()}</td>
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
