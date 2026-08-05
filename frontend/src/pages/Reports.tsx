import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, ShoppingBag, AlertCircle, Printer, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSaleStore, useExpenseStore } from '../store/dataStore';

const today = new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [reportDate, setReportDate] = useState(today);
  const { sales } = useSaleStore();
  const { expenses } = useExpenseStore();

  const trendData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      
      const daySales = sales.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.total, 0);
      const dayExpenses = expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0);
      
      data.push({
        name: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: dateStr,
        Sales: daySales,
        Expenses: dayExpenses,
        Profit: daySales - dayExpenses
      });
    }
    return data;
  }, [sales, expenses]);

  const data = useMemo(() => {
    const daySales = sales.filter(s => s.date === reportDate);
    const dayExpenses = expenses.filter(e => e.date === reportDate);

    const cashSales = daySales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const transferSales = daySales.filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.total, 0);
    const creditSales = daySales.filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.total, 0);
    const totalSales = cashSales + transferSales + creditSales;
    
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netCash = cashSales - totalExpenses;
    
    return {
      date: reportDate,
      cashSales,
      transferSales,
      creditSales,
      totalSales,
      totalExpenses,
      netCash,
      txCount: daySales.length,
      transactions: daySales
    };
  }, [reportDate, sales, expenses]);

  const handlePrint = () => window.print();

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <BarChart3 size={28} /> Reports &amp; End of Day
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Shift summary, cash reconciliation, and sales breakdown</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary outline-none text-sm" />
          <button onClick={handlePrint} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition text-sm">
            <Printer size={18} /> Print
          </button>
        </div>
      </div>

      {/* Cash Reconciliation Box */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-6 mb-6 shadow-lg">
        <div className="text-blue-200 font-medium mb-2 flex items-center gap-2">
          <DollarSign size={18} /> Expected Cash in Drawer
        </div>
        <div className="text-5xl font-extrabold mb-1">MWK {data.netCash.toLocaleString()}</div>
        <div className="text-blue-200 text-sm mt-2">Cash Sales (MWK {data.cashSales.toLocaleString()}) – Expenses (MWK {data.totalExpenses.toLocaleString()})</div>
        {data.netCash < 0 && (
          <div className="mt-3 flex items-center gap-2 bg-red-400/30 px-3 py-2 rounded-lg text-sm font-semibold">
            <AlertCircle size={16} /> Warning: Expenses exceed cash sales today!
          </div>
        )}
      </div>

      {/* 7-Day Trend Chart */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={20} /> 7-Day Trend Overview</h2>
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
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(val) => `MWK ${(val/1000)}k`} dx={-10} />
              <Tooltip 
                formatter={(value: number) => [`MWK ${value.toLocaleString()}`]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Total Sales</div>
            <TrendingUp size={20} className="text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">MWK {data.totalSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{data.txCount} transactions</div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Cash Sales</div>
            <DollarSign size={20} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">MWK {data.cashSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{data.totalSales > 0 ? Math.round(data.cashSales / data.totalSales * 100) : 0}% of total</div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Credit Sales</div>
            <CreditCard size={20} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">MWK {data.creditSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Not received in cash</div>
        </div>

        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Total Expenses</div>
            <TrendingDown size={20} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">MWK {data.totalExpenses.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Deducted from cash</div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingBag size={20} /> Payment Method Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Cash', value: data.cashSales, color: 'bg-blue-500' },
              { label: 'Bank Transfer', value: data.transferSales, color: 'bg-purple-500' },
              { label: 'Credit / Pay Later', value: data.creditSales, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <span className="font-bold">MWK {item.value.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${data.totalSales > 0 ? Math.round(item.value / data.totalSales * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Reconciliation Steps */}
        <div className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={20} /> Cash Reconciliation</h2>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">+ Cash Sales</span>
              <span className="font-semibold text-green-600">+ MWK {data.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">– Expenses Paid</span>
              <span className="font-semibold text-red-600">– MWK {data.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 mt-3">
              <span className="font-bold text-gray-800">Expected in Drawer</span>
              <span className="font-extrabold text-blue-700 text-lg">MWK {data.netCash.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales log table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
          <span>Transactions for {reportDate}</span>
          <span className="text-sm font-normal text-gray-500">{data.txCount} total</span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Time</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Cashier</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Method</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Amount (MWK)</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">No transactions found for this date.</td></tr>
            ) : (
              data.transactions.map(tx => (
                <tr key={tx.invoiceNumber} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-mono text-sm text-primary font-semibold">{tx.invoiceNumber}</td>
                  <td className="p-4 text-gray-600">{tx.time}</td>
                  <td className="p-4">{tx.cashier}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      tx.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                      tx.paymentMethod === 'CREDIT' ? 'bg-amber-100 text-amber-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>{tx.paymentMethod.replace('_', ' ')}</span>
                  </td>
                  <td className="p-4 text-right font-bold">{tx.total.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
