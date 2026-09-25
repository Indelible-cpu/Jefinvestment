import { useState, useEffect, Fragment } from 'react';
import { CreditCard, DollarSign, Calendar, CheckCircle2, Clock, ChevronDown, ChevronUp, History, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useCreditStore, type CreditRecord } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import type { CartItem } from '../store/cartStore';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

export default function CreditManagement() {
  const { credits, isLoading, loadCredits, recordRepayment } = useCreditStore();
  const settings = useSettingsStore();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [settlementReceiptData, setSettlementReceiptData] = useState<any | null>(null);

  useEffect(() => {
    loadCredits();
  }, []);

  const openSettledReceipt = (c: CreditRecord) => {
    // Build complete payment history for receipt: initial deposit + all repayments
    const paymentHistory: Array<{ amount: number; method: string; date: string; cashier?: string }> = [];

    if (c.initialDeposit > 0) {
      paymentHistory.push({
        amount: c.initialDeposit,
        method: 'DEPOSIT (POS)',
        date: c.date,
        cashier: 'POS Cashier',
      });
    }

    if (c.repayments && c.repayments.length > 0) {
      c.repayments.forEach(r => {
        paymentHistory.push({
          amount: Number(r.amount),
          method: r.method || 'CASH',
          date: r.date,
          cashier: r.cashier || 'Staff',
        });
      });
    }

    const items: CartItem[] = (c.items && c.items.length > 0)
      ? c.items.map((i: any, idx: number) => ({
          id: i.productId || i.id || `${c.invoiceNumber}-${idx}`,
          name: i.name || 'Item',
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || 0,
          sku: i.sku || '',
          discount: i.discount || 0,
          isService: !!i.isService,
        }))
      : [
          {
            id: c.invoiceNumber,
            name: `Credit Sale Settlement - ${c.customerName}`,
            quantity: 1,
            unitPrice: c.totalAmount,
            sku: '',
            discount: 0,
            isService: true,
          }
        ];

    setSettlementReceiptData({
      items,
      subtotal: c.subtotal || c.totalAmount,
      discount: c.discount || 0,
      taxAmount: c.taxAmount || 0,
      taxName: c.taxName || settings.taxName || 'VAT',
      taxType: c.taxType || settings.taxType || 'INCLUSIVE',
      total: c.totalAmount,
      paymentMethod: 'CREDIT',
      amountPaid: c.paidAmount,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      customerId: c.customerId,
      invoiceNumber: c.invoiceNumber,
      dueDate: c.dueDate,
      repayments: paymentHistory,
      isSettledCredit: true,
    });
  };

  const totalOutstanding = credits.filter(c => c.status !== 'FULLY_PAID').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);
  const totalOverdue = credits.filter(c => c.status === 'OVERDUE').reduce((sum, c) => sum + (c.totalAmount - c.paidAmount), 0);

  const selectedCreditRecord = credits.find(c => c.id === selectedRecord) || null;

  const displayCredits = credits
    .filter(c => showPaid || c.status !== 'FULLY_PAID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !repayAmount) return;

    const amountNum = parseFloat(repayAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (selectedCreditRecord) {
      const remainingBalance = Math.max(0, selectedCreditRecord.totalAmount - selectedCreditRecord.paidAmount);
      if (amountNum > remainingBalance) {
        toast.error(`Payment cannot exceed outstanding balance of ${settings.currency} ${remainingBalance.toLocaleString()}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await recordRepayment(selectedRecord, amountNum, repayMethod);
      setSelectedRecord(null);
      setRepayAmount('');
      toast.success(`Repayment of ${settings.currency} ${amountNum.toLocaleString()} recorded successfully.`);
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Repayment saved locally and will sync when online.' });
        setSelectedRecord(null);
        setRepayAmount('');
      } else {
        toast.error('Failed to record repayment', { description: err.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-1.5 sm:p-3 md:p-8 bg-background min-h-full pb-24">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Credit Sales &amp; Debt Management</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Track customer debts, due dates, and record partial or full repayments.</p>
        </div>
        <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-white border px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 transition shadow-xs sm:shadow-sm self-start sm:self-auto">
          <input 
            type="checkbox" 
            checked={showPaid} 
            onChange={(e) => setShowPaid(e.target.checked)} 
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          Show fully paid credits
        </label>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-card p-3.5 sm:p-5 md:p-6 rounded-xl border shadow-xs sm:shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-amber-100 text-amber-700 rounded-full shrink-0">
            <CreditCard size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-gray-500 text-xs sm:text-sm">Total Outstanding Debt</span>
            <h3 className="text-lg sm:text-2xl font-bold text-amber-700 font-mono truncate">{settings.currency} {totalOutstanding.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 md:p-6 rounded-xl border shadow-xs sm:shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-red-100 text-red-700 rounded-full shrink-0">
            <Clock size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-gray-500 text-xs sm:text-sm">Overdue Debt</span>
            <h3 className="text-lg sm:text-2xl font-bold text-red-600 font-mono truncate">{settings.currency} {totalOverdue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-card p-3.5 sm:p-5 md:p-6 rounded-xl border shadow-xs sm:shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-green-100 text-green-700 rounded-full shrink-0">
            <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-gray-500 text-xs sm:text-sm">Active Debtors</span>
            <h3 className="text-lg sm:text-2xl font-bold text-green-700 font-mono truncate">{credits.filter(c => c.status !== 'FULLY_PAID').length}</h3>
          </div>
        </div>
      </div>

      {/* Credit Table */}
      <div className="bg-card rounded-lg border shadow-sm flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4">Invoice #</th>
              <th className="p-4">Customer Name</th>
              <th className="p-4">Phone Number</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Total ({settings.currency})</th>
              <th className="p-4">Paid ({settings.currency})</th>
              <th className="p-4">Balance Due ({settings.currency})</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-lg font-medium text-gray-600">Loading credits...</p>
                    <p className="text-sm">Please wait while we fetch the records.</p>
                  </div>
                </td>
              </tr>
            ) : displayCredits.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <CreditCard size={48} className="text-gray-300 mb-3" />
                    <p className="text-lg font-medium text-gray-600">No credit records found</p>
                    <p className="text-sm">Active credits will appear here.</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayCredits.map(c => {
                const balance = Math.max(0, c.totalAmount - c.paidAmount);
                const isExpanded = expandedRowId === c.id;
                const hasHistory = (c.initialDeposit > 0) || (c.repayments && c.repayments.length > 0);

                return (
                  <Fragment key={c.id}>
                    <tr 
                      onClick={() => setExpandedRowId(isExpanded ? null : c.id)}
                      className={`hover:bg-gray-50 transition cursor-pointer ${isExpanded ? 'bg-blue-50/20' : ''}`}
                    >
                      <td className="p-4 font-mono font-bold text-primary">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRowId(isExpanded ? null : c.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"
                            title={isExpanded ? 'Collapse' : 'Expand payment history'}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span>{c.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium">
                        {c.customerName}
                      </td>
                      <td className="p-4 text-gray-600">
                        {c.customerPhone || '—'}
                      </td>
                      <td className="p-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={15} />
                          {c.dueDate || '—'}
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        {settings.currency} {c.totalAmount.toLocaleString()}
                      </td>
                      <td className="p-4 font-mono font-semibold text-green-700">
                        {settings.currency} {c.paidAmount.toLocaleString()}
                      </td>
                      <td className="p-4 font-mono font-bold text-red-600">
                        {settings.currency} {balance.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          c.status === 'FULLY_PAID' ? 'bg-green-100 text-green-800' :
                          c.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                          c.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {c.status !== 'FULLY_PAID' ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(c.id);
                              setRepayAmount('');
                            }}
                            className="flex items-center gap-1 text-xs bg-primary text-white hover:bg-blue-700 px-3 py-1.5 rounded font-medium transition ml-auto shadow-xs"
                          >
                            <DollarSign size={14} />
                            Record Repayment
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                              ✓ Settled
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSettledReceipt(c);
                              }}
                              className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-md font-medium transition shadow-xs"
                              title="View printable & shareable settlement receipt"
                            >
                              <FileText size={13} />
                              <span>Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Payment History Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={9} className="p-4 sm:p-6">
                          <div className="bg-white rounded-lg border p-4 shadow-xs">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                              <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                                <History size={16} className="text-primary" />
                                <span>Payment &amp; Settlement History for {c.invoiceNumber}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Total: {settings.currency} {c.totalAmount.toLocaleString()} &bull; Balance: {settings.currency} {balance.toLocaleString()}
                              </div>
                            </div>

                            {!hasHistory ? (
                              <div className="text-xs text-gray-500 py-3 text-center">
                                No repayments recorded yet. The customer has {settings.currency} {balance.toLocaleString()} outstanding.
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-gray-50 text-gray-600">
                                      <th className="p-2 text-left">Type / Transaction</th>
                                      <th className="p-2 text-left">Date &amp; Time</th>
                                      <th className="p-2 text-left">Method</th>
                                      <th className="p-2 text-left">Received By</th>
                                      <th className="p-2 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y text-gray-700">
                                    {c.initialDeposit > 0 && (
                                      <tr className="hover:bg-gray-50/50">
                                        <td className="p-2 font-medium text-blue-700">Initial Deposit (at POS checkout)</td>
                                        <td className="p-2 text-gray-500">{c.date}</td>
                                        <td className="p-2">
                                          <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">CREDIT_DEPOSIT</span>
                                        </td>
                                        <td className="p-2 text-gray-500">POS Cashier</td>
                                        <td className="p-2 text-right font-mono font-bold text-green-700">
                                          {settings.currency} {c.initialDeposit.toLocaleString()}
                                        </td>
                                      </tr>
                                    )}

                                    {c.repayments && c.repayments.map((rep, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="p-2 font-medium">Repayment #{idx + 1}</td>
                                        <td className="p-2 text-gray-500">
                                          {rep.date ? new Date(rep.date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                        </td>
                                        <td className="p-2">
                                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                                            {rep.method || 'CASH'}
                                          </span>
                                        </td>
                                        <td className="p-2 text-gray-600">
                                          <div className="flex items-center gap-1">
                                            <User size={12} className="text-gray-400" />
                                            <span>{rep.cashier || 'Staff'}</span>
                                          </div>
                                        </td>
                                        <td className="p-2 text-right font-mono font-bold text-green-700">
                                          {settings.currency} {Number(rep.amount).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t bg-gray-50/80 font-bold">
                                      <td colSpan={4} className="p-2 text-right text-gray-600">Total Settled:</td>
                                      <td className="p-2 text-right font-mono text-green-700">
                                        {settings.currency} {c.paidAmount.toLocaleString()}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
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
                <span className="font-mono">{settings.currency} {selectedCreditRecord?.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already Paid:</span>
                <span className="font-mono">{settings.currency} {selectedCreditRecord?.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600 pt-1 border-t">
                <span>Remaining Balance:</span>
                <span className="font-mono">{settings.currency} {Math.max(0, (selectedCreditRecord?.totalAmount || 0) - (selectedCreditRecord?.paidAmount || 0)).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleRepay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Payment Amount ({settings.currency}) *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required 
                    min="1"
                    max={Math.max(0, (selectedCreditRecord?.totalAmount || 0) - (selectedCreditRecord?.paidAmount || 0))}
                    className="w-full p-2 border rounded font-mono font-bold pr-20"
                    placeholder="Enter amount paid"
                    value={repayAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setRepayAmount(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, (selectedCreditRecord?.totalAmount || 0) - (selectedCreditRecord?.paidAmount || 0));
                      setRepayAmount(rem.toString());
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded font-semibold transition"
                  >
                    Pay Full
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payment Method</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={repayMethod}
                  onChange={e => setRepayMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="MOMO_AIRTEL">Airtel Money</option>
                  <option value="MOMO_MPAMBA">TNM Mpamba</option>
                  <option value="BANK_NBS">NBS Bank</option>
                  <option value="BANK_NBM">National Bank (NBM)</option>
                  <option value="BANK_TRANSFER">Other Bank Transfer</option>
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
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settled Credit Receipt Modal */}
      {settlementReceiptData && (
        <ReceiptPreviewModal
          {...settlementReceiptData}
          onClose={() => setSettlementReceiptData(null)}
        />
      )}
    </div>
  );
}
