import { useState } from 'react';
import { CreditCard, DollarSign, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CreditRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'FULLY_PAID';
}

const mockCreditSales: CreditRecord[] = [
  { id: '1', invoiceNumber: 'INV-882190', customerName: 'Blessings Musopole', customerPhone: '+265 999 555 444', totalAmount: 850000, paidAmount: 300000, dueDate: '2026-08-15', status: 'PENDING' },
  { id: '2', invoiceNumber: 'INV-773102', customerName: 'Yamikani Phiri', customerPhone: '+265 888 111 222', totalAmount: 45000, paidAmount: 0, dueDate: '2026-08-01', status: 'OVERDUE' },
  { id: '3', invoiceNumber: 'INV-551044', customerName: 'Grace Chinkhata', customerPhone: '+265 991 333 777', totalAmount: 12000, paidAmount: 12000, dueDate: '2026-07-28', status: 'FULLY_PAID' },
];

export default function CreditManagement() {
  const [credits, setCredits] = useState<CreditRecord[]>(mockCreditSales);
  const [selectedRecord, setSelectedRecord] = useState<CreditRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');

  const totalOutstanding = credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);
  const totalOverdue = credits.filter(c => c.status === 'OVERDUE').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !repayAmount) return;

    const amountNum = parseFloat(repayAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setCredits(credits.map(c => {
      if (c.id === selectedRecord.id) {
        const newPaid = c.paidAmount + amountNum;
        const newStatus = newPaid >= c.totalAmount ? 'FULLY_PAID' : c.status;
        return { ...c, paidAmount: newPaid, status: newStatus };
      }
      return c;
    }));

    setSelectedRecord(null);
    setRepayAmount('');
    toast.success('Repayment of MWK ' + amountNum.toLocaleString() + ' recorded.');
  };

  return (
    <div className="p-8 bg-background min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Credit Sales & Debt Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track customer debts, due dates, and record partial or full repayments.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
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
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
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
                        onClick={() => setSelectedRecord(c)}
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
            <p className="text-sm text-gray-500 mb-4">{selectedRecord.customerName} - {selectedRecord.invoiceNumber}</p>
            
            <div className="p-3 bg-gray-50 border rounded mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Credit:</span>
                <span className="font-mono">MWK {selectedRecord.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already Paid:</span>
                <span className="font-mono">MWK {selectedRecord.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600 pt-1 border-t">
                <span>Remaining Balance:</span>
                <span className="font-mono">MWK {(selectedRecord.totalAmount - selectedRecord.paidAmount).toLocaleString()}</span>
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
