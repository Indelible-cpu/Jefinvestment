import { useState, useMemo, useRef } from 'react';
import { useProductStore } from '../store/cartStore';
import { useSaleStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { TrendingUp, AlertCircle, Package, Printer, Download, Share2 } from 'lucide-react';

export default function Reorder() {
  const { products } = useProductStore();
  const { sales } = useSaleStore();
  const settings = useSettingsStore();
  const printRef = useRef<HTMLDivElement>(null);

  const [daysToAnalyze, setDaysToAnalyze] = useState(30);

  const reorderData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
    const cutoffString = cutoffDate.toISOString().slice(0, 10);

    const salesMap: Record<string, number> = {};
    sales.forEach(sale => {
      if (sale.status === 'completed' && sale.date >= cutoffString) {
        sale.items.forEach(item => {
          const itemAny = item as any;
          if (!itemAny.isService && !itemAny.isStationeryService) {
            const pid = itemAny.productId || itemAny.id;
            salesMap[pid] = (salesMap[pid] || 0) + item.quantity;
          }
        });
      }
    });

    return products
      .filter(p => !p.isService)
      .map(p => {
        const soldPastDays = salesMap[p.id] || 0;
        const dailyVelocity = soldPastDays / daysToAnalyze;
        const suggestedStock = Math.ceil(dailyVelocity * 30);
        const reorderAmount = Math.max(0, suggestedStock - p.stock);
        const priority = reorderAmount > 0 && p.stock <= (p.reorderLevel || 5) ? 'HIGH' :
                         reorderAmount > 0 ? 'MEDIUM' : 'LOW';
        return { ...p, soldPastDays, dailyVelocity, suggestedStock, reorderAmount, priority };
      })
      .filter(p => p.reorderAmount > 0 || p.priority === 'HIGH')
      .sort((a, b) => b.reorderAmount - a.reorderAmount);
  }, [products, sales, daysToAnalyze]);

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const today = new Date().toLocaleDateString();
    const rows = reorderData.map(p =>
      `<tr>
        <td>${p.name}</td>
        <td>${p.stock}</td>
        <td>${p.soldPastDays}</td>
        <td>${p.suggestedStock}</td>
        <td>+${p.reorderAmount}</td>
        <td class="${p.priority.toLowerCase()}">${p.priority}</td>
      </tr>`
    ).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Reorder List — ${settings.companyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #111; }
            h1 { font-size: 20px; margin: 0; }
            p.sub { color: #666; margin: 4px 0 16px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #f3f4f6; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; }
            td { padding: 8px 10px; border: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #fafafa; }
            .high { color: #dc2626; font-weight: bold; }
            .medium { color: #d97706; font-weight: bold; }
            .low { color: #16a34a; font-weight: bold; }
            .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${settings.companyName} — Smart Reorder List</h1>
          <p class="sub">Generated: ${today} &nbsp;|&nbsp; Based on past ${daysToAnalyze} days of sales</p>
          <table>
            <thead>
              <tr>
                <th>Product Name</th><th>Current Stock</th><th>Sold (${daysToAnalyze} Days)</th>
                <th>Suggested Level</th><th>Reorder Qty</th><th>Priority</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="footer">${settings.address} &nbsp;|&nbsp; ${settings.phone} &nbsp;|&nbsp; ${settings.email}</p>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const header = ['Product Name', 'Current Stock', `Sold (${daysToAnalyze} Days)`, 'Suggested Level', 'Reorder Qty', 'Priority'];
    const rows = reorderData.map(p =>
      [p.name, p.stock, p.soldPastDays, p.suggestedStock, p.reorderAmount, p.priority]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── WhatsApp Share ─────────────────────────────────────────────────────────
  const handleShareWhatsApp = () => {
    const today = new Date().toLocaleDateString();
    const lines = reorderData.map((p, i) =>
      `${i + 1}. *${p.name}*\n   Stock: ${p.stock} | Reorder: +${p.reorderAmount} | Priority: ${p.priority}`
    ).join('\n\n');
    const message = `*${settings.companyName} — Reorder List*\n📅 ${today} (Past ${daysToAnalyze} days)\n\n${lines}\n\n_Generated by StoreSight POS_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Smart Reorder Recommendations</h1>
            <p className="text-sm text-gray-500">AI-based restocking suggestions based on past sales</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Period selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Analyze Past:</label>
            <select
              value={daysToAnalyze}
              onChange={(e) => setDaysToAnalyze(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>

          {/* Action buttons — only shown when there is data */}
          {reorderData.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                title="Print reorder list"
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <Printer size={16} /> Print
              </button>
              <button
                onClick={handleExportCSV}
                title="Export as CSV spreadsheet"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <Download size={16} /> CSV
              </button>
              <button
                onClick={handleShareWhatsApp}
                title="Share via WhatsApp"
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <Share2 size={16} /> WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div ref={printRef} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {reorderData.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
            <Package size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-gray-600">Stock Levels are Healthy</h3>
            <p className="text-sm mt-1">Based on recent sales, no items currently need restocking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-gray-500 font-semibold">
                <tr>
                  <th className="p-4">#</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Current Stock</th>
                  <th className="p-4">Sold ({daysToAnalyze} Days)</th>
                  <th className="p-4">Suggested Level</th>
                  <th className="p-4">Reorder Qty</th>
                  <th className="p-4">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reorderData.map((p, i) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="p-4 font-medium text-gray-800">{p.name}</td>
                    <td className="p-4">
                      <span className={`font-bold ${p.stock <= (p.reorderLevel || 5) ? 'text-red-500' : 'text-gray-700'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-600">{p.soldPastDays}</td>
                    <td className="p-4 text-gray-600">{p.suggestedStock}</td>
                    <td className="p-4">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                        +{p.reorderAmount}
                      </span>
                    </td>
                    <td className="p-4">
                      {p.priority === 'HIGH' && <span className="flex items-center gap-1 text-red-600 font-bold text-xs"><AlertCircle size={14}/> HIGH</span>}
                      {p.priority === 'MEDIUM' && <span className="flex items-center gap-1 text-amber-600 font-bold text-xs">MEDIUM</span>}
                      {p.priority === 'LOW' && <span className="flex items-center gap-1 text-green-600 font-bold text-xs">LOW</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t bg-gray-50 text-xs text-gray-400 text-right">
              {reorderData.length} item{reorderData.length !== 1 ? 's' : ''} need restocking &nbsp;•&nbsp; Based on {daysToAnalyze}-day sales velocity
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
