import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useCreditStore } from '../store/dataStore';

export default function CreditManagement() {
  const { credits, loadCredits, recordRepayment } = useCreditStore();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');

  useEffect(() => {
    loadCredits();
  }, []);

  const totalOutstanding = credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);
  const totalOverdue = credits.filter(c => c.status === 'OVERDUE').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);

  const selectedCreditRecord = credits.find(c => c.id === selectedRecord) || null;

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !repayAmount) return;

    const amountNum = parseFloat(repayAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    try {
      await recordRepayment(selectedRecord, amountNum);
      setSelectedRecord(null);
      setRepayAmount('');
      toast.success('Repayment of MWK ' + amountNum.toLocaleString() + ' recorded.');
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Repayment saved locally and will sync when online.' });
        setSelectedRecord(null);
        setRepayAmount('');
      } else {
        toast.error('Failed to record repayment', { description: err.message });
      }
    }
  };

  return (
    <div className="p-4 md:p-8 bg-background min-h-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Credit Sales &amp; Debt Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track customer debts, due dates, and record partial or full repayments.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card p-4 md:p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-full">
            <CreditCard size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Total Outstanding Debt</span>
            <h3 className="text-2xl font-bold text-amber-700 font-mono">MWK {totalOutstanding.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-full">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Overdue Debt</span>
            <h3 className="text-2xl font-bold text-red-700 font-mono">MWK {totalOverdue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-full">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Active Debtors</span>
            <h3 className="text-2xl font-bold">{credits.filter(c => c.status !== 'FULLY_PAID').length}</h3>
          </div>
        </div>
      </div>

      {/* Credit Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4">Invoice #</th>
              <th className="p-4">Customer Name</th>
              <th className="p-4">Phone Number</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Total (MWK)</th>
              <th className="p-4">Balance Due (MWK)</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {credits.map(c => {
              const balance = c.totalAmount - c.paidAmount;
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-mono font-bold text-primary">{c.invoiceNumber}</td>
                  <td className="p-4 font-medium">{c.customerName}</td>
                  <td className="p-4 text-gray-600">{c.customerPhone}</td>
                  <td className="p-4 flex items-center gap-1.5 text-gray-600">
                    <Calendar size={15} />
                    {c.dueDate}
                  </td>
                  <td className="p-4 font-mono">MWK {c.totalAmount.toLocaleString()}</td>
                  <td className="p-4 font-mono font-bold text-red-600">MWK {balance.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      c.status === 'FULLY_PAID' ? 'bg-green-100 text-green-800' :
                      c.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {c.status !== 'FULLY_PAID' && (
                       <button 
                        onClick={() => setSelectedRecord(c.id)}
                        className="flex items-center gap-1 text-xs bg-primary text-white hover:bg-blue-700 px-3 py-1.5 rounded font-medium transition ml-auto"
                      >
                        <DollarSign size={14} />
                        Record Repayment
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Record Repayment Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedRecord(null)}>
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">Record Credit Repayment</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedCreditRecord?.customerName} - {selectedCreditRecord?.invoiceNumber}</p>
            
            <div className="p-3 bg-gray-50 border rounded mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Credit:</span>
                <span className="font-mono">MWK {selectedCreditRecord?.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already Paid:</span>
                <span className="font-mono">MWK {selectedCreditRecord?.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600 pt-1 border-t">
                <span>Remaining Balance:</span>
                <span className="font-mono">MWK {((selectedCreditRecord?.totalAmount || 0) - (selectedCreditRecord?.paidAmount || 0)).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleRepay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Payment Amount (MWK) *</label>
                <input 
                  type="number" 
                  required 
                  className="w-full p-2 border rounded font-mono font-bold"
                  placeholder="Enter amount paid"
                  value={repayAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={e => setRepayAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payment Method</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={repayMethod}
                  onChange={e => setRepayMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700 font-medium"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
