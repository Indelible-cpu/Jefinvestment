import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, ShoppingBag, AlertCircle, Printer, Calendar, Package, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { useSaleStore, useExpenseStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

const today = new Date().toISOString().slice(0, 10);

/** Compute estimated profit from a list of completed sale records */
function calcSaleProfit(sale: { items: Array<{ quantity: number; unitPrice: number; costPrice?: number }>; profit?: number; discount?: number }): number {
  if ((sale as any).profit !== undefined) return (sale as any).profit as number;
  const gross = sale.items.reduce((sum, item) => {
    const rev = item.quantity * item.unitPrice;
    const cost = (item.costPrice || 0) * item.quantity;
    return sum + (rev - cost);
  }, 0);
  return gross - (sale.discount || 0);
}

export default function Reports() {
  const [reportDate, setReportDate] = useState(today);
  const { sales } = useSaleStore();
  const { expenses } = useExpenseStore();
  const settings = useSettingsStore();

  // Only count completed sales everywhere
  const completedSales = useMemo(() => sales.filter(s => (s.status ?? 'completed') === 'completed'), [sales]);

  /* ── 7-day trend ── */
  const trendData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const daySales = completedSales.filter(s => s.date === dateStr);
      const daySalesTotal = daySales.reduce((sum, s) => sum + s.total, 0);
      const dayExpenses = expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0);
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
  }, [completedSales, expenses]);

  /* ── Daily report (completed only) ── */
  const data = useMemo(() => {
    const daySales = completedSales.filter(s => s.date === reportDate);
    const dayExpenses = expenses.filter(e => e.date === reportDate);
    const cashSales = daySales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const transferSales = daySales.filter(s => s.paymentMethod === 'BANK_TRANSFER').reduce((sum, s) => sum + s.total, 0);
    const creditSales = daySales.filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.total, 0);
    const totalSales = cashSales + transferSales + creditSales;
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netCash = cashSales - totalExpenses;
    // Estimated daily profit = gross profit from items minus expenses
    const dailyProfit = daySales.reduce((sum, s) => sum + calcSaleProfit(s), 0) - totalExpenses;
    return { date: reportDate, cashSales, transferSales, creditSales, totalSales, totalExpenses, netCash, dailyProfit, txCount: daySales.length, transactions: daySales };
  }, [reportDate, completedSales, expenses]);

  /* ── Cumulative (all-time) totals ── */
  const cumulative = useMemo(() => {
    const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalProfit = completedSales.reduce((sum, s) => sum + calcSaleProfit(s), 0) - totalExpenses;
    return { totalRevenue, totalExpenses, totalProfit };
  }, [completedSales, expenses]);

  /* ── Item Analytics (All Products & Services) ── */
  const itemData = useMemo(() => {
    const byItem: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    
    for (const sale of completedSales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const name = item.name || 'Unknown';
        if (!byItem[name]) byItem[name] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        
        const rev = item.quantity * item.unitPrice;
        const cst = (item.costPrice || 0) * item.quantity;
        const prof = rev - cst;
        
        byItem[name].revenue += rev;
        byItem[name].cost += cst;
        byItem[name].profit += prof;
        byItem[name].count += item.quantity;
      }
    }

    const itemRows = Object.entries(byItem).map(([name, v]) => ({ name, ...v }));
    itemRows.sort((a, b) => b.profit - a.profit);
    
    // Top 10 items for the chart
    const topItems = itemRows.slice(0, 10);
    const chartData = topItems.map(r => ({ name: r.name, Revenue: r.revenue, Cost: r.cost, Profit: r.profit }));

    return { itemRows, chartData };
  }, [completedSales]);

  const handlePrint = () => window.print();

  const cur = settings.currency;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <BarChart3 size={28} /> Business Reports
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Shift summary, cash reconciliation, and business analytics</p>
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
        <div className="text-5xl font-extrabold mb-1">{cur} {data.netCash.toLocaleString()}</div>
        <div className="text-blue-200 text-sm mt-2">Cash Sales ({cur} {data.cashSales.toLocaleString()}) – Expenses ({cur} {data.totalExpenses.toLocaleString()})</div>
        {data.netCash < 0 && (
          <div className="mt-3 flex items-center gap-2 bg-red-400/30 px-3 py-2 rounded-lg text-sm font-semibold">
            <AlertCircle size={16} /> Warning: Expenses exceed cash sales today!
          </div>
        )}
      </div>

      {/* KPI Cards — 5 cards including Est. Daily Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Total Sales</div>
            <TrendingUp size={20} className="text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{cur} {data.totalSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{data.txCount} transactions</div>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Cash Sales</div>
            <DollarSign size={20} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{cur} {data.cashSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">{data.totalSales > 0 ? Math.round(data.cashSales / data.totalSales * 100) : 0}% of total</div>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Credit Sales</div>
            <CreditCard size={20} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{cur} {data.creditSales.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Not received in cash</div>
        </div>
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-500 font-medium">Total Expenses</div>
            <TrendingDown size={20} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{cur} {data.totalExpenses.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Deducted from cash</div>
        </div>
        <div className={`p-5 rounded-lg border shadow-sm ${data.dailyProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-between items-start mb-3">
            <div className="text-sm text-gray-600 font-medium">Est. Daily Profit</div>
            <Activity size={20} className={data.dailyProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
          </div>
          <div className={`text-2xl font-bold ${data.dailyProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {cur} {data.dailyProfit.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {data.totalSales > 0 ? `${Math.round(data.dailyProfit / data.totalSales * 100)}% margin` : 'No sales today'}
          </div>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Method Breakdown */}
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
                  <span className="font-bold">{cur} {item.value.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${data.totalSales > 0 ? Math.round(item.value / data.totalSales * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Cash Reconciliation */}
        <div className="bg-white rounded-lg border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={20} /> Cash Reconciliation</h2>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">+ Cash Sales</span>
              <span className="font-semibold text-green-600">+ {cur} {data.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">– Expenses Paid</span>
              <span className="font-semibold text-red-600">– {cur} {data.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 mt-3">
              <span className="font-bold text-gray-800">Expected in Drawer</span>
              <span className="font-extrabold text-blue-700 text-lg">{cur} {data.netCash.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Item Analytics ── */}
      {itemData.chartData.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Package size={20} /> Top Items by Revenue & Profit (All Time)</h2>
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
                  <th className="py-2 text-right">Est. Profit</th>
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

      {/* ── Cumulative All-Time Summary ── */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl p-6 mb-6 shadow-lg">
        <h2 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Activity size={20} className="text-emerald-400" /> Cumulative All-Time Summary
          <span className="text-xs font-normal text-slate-400 ml-2">(completed sales only)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Revenue</div>
            <div className="text-3xl font-extrabold text-white">{cur} {cumulative.totalRevenue.toLocaleString()}</div>
            <div className="text-slate-400 text-xs mt-1">All completed sales</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Total Expenses</div>
            <div className="text-3xl font-extrabold text-red-300">{cur} {cumulative.totalExpenses.toLocaleString()}</div>
            <div className="text-slate-400 text-xs mt-1">All recorded expenses</div>
          </div>
          <div className={`rounded-xl p-4 ${cumulative.totalProfit >= 0 ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}>
            <div className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-1">Est. Total Profit</div>
            <div className={`text-3xl font-extrabold ${cumulative.totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {cur} {cumulative.totalProfit.toLocaleString()}
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {cumulative.totalRevenue > 0 ? `${Math.round(cumulative.totalProfit / cumulative.totalRevenue * 100)}% overall margin` : 'No sales yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
          <span>Transactions for {reportDate}</span>
          <span className="text-sm font-normal text-gray-500">{data.txCount} completed</span>
        </div>
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-sm font-semibold text-gray-600">Invoice #</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Time</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Cashier</th>
              <th className="p-4 text-sm font-semibold text-gray-600">Method</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Amount ({cur})</th>
              <th className="p-4 text-sm font-semibold text-gray-600 text-right">Est. Profit ({cur})</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No completed transactions found for this date.</td></tr>
            ) : (
              data.transactions.map(tx => {
                const txProfit = calcSaleProfit(tx);
                return (
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
                    <td className={`p-4 text-right font-bold ${txProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {txProfit.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
