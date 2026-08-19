import { useState, useMemo } from 'react';
import { useProductStore } from '../store/cartStore';
import { useSaleStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuditStore } from '../store/auditStore';
import { db } from '../lib/firebase';
import { doc, writeBatch, increment } from 'firebase/firestore';
import { TrendingUp, AlertCircle, Package, Printer, Download, Share2, CheckCircle, Trash2, Plus, PencilLine } from 'lucide-react';
import { toast } from 'sonner';

interface OrderRow {
  id: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  soldPastDays: number;
  suggestedStock: number;
  reorderAmount: number;
  costPrice: number;
  priority: string;
  edited: boolean; // true if user manually changed qty
}

export default function Order() {
  const { products } = useProductStore();
  const { sales } = useSaleStore();
  const settings = useSettingsStore();
  const { addLog } = useAuditStore();

  const [daysToAnalyze, setDaysToAnalyze] = useState(30);
  const [restocking, setRestocking] = useState(false);

  // ── Compute base suggestions ──────────────────────────────────────────────
  const baseSuggestions = useMemo(() => {
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
        const priority = reorderAmount > 0 && p.stock <= (p.reorderLevel || 5) ? 'HIGH'
                       : reorderAmount > 0 ? 'MEDIUM' : 'LOW';
        return {
          id: p.id,
          name: p.name,
          currentStock: p.stock,
          reorderLevel: p.reorderLevel || 5,
          soldPastDays,
          suggestedStock,
          reorderAmount,
          costPrice: p.costPrice || 0,
          priority,
          edited: false,
        } as OrderRow;
      })
      .filter(p => p.reorderAmount > 0 || p.priority === 'HIGH')
      .sort((a, b) => b.reorderAmount - a.reorderAmount);
  }, [products, sales, daysToAnalyze]);

  // ── Editable order list ───────────────────────────────────────────────────
  const [orderList, setOrderList] = useState<OrderRow[]>([]);
  const [initializedFor, setInitializedFor] = useState<string>('');

  // Sync orderList when baseSuggestions change (period changed) — preserve user edits
  const currentKey = daysToAnalyze + '-' + baseSuggestions.map(r => r.id).join(',');
  if (initializedFor !== currentKey) {
    setInitializedFor(currentKey);
    setOrderList(baseSuggestions.map(r => ({ ...r, edited: false })));
  }

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const updateQty = (id: string, value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setOrderList(prev => prev.map(r => r.id === id ? { ...r, reorderAmount: num, edited: true } : r));
  };

  const removeRow = (id: string) => {
    setOrderList(prev => prev.filter(r => r.id !== id));
  };

  // Products not yet in the list (for manual add)
  const remainingProducts = products.filter(
    p => !p.isService && !orderList.find(r => r.id === p.id)
  );

  const addProduct = (id: string) => {
    const p = products.find(pr => pr.id === id);
    if (!p) return;
    const row: OrderRow = {
      id: p.id,
      name: p.name,
      currentStock: p.stock,
      reorderLevel: p.reorderLevel || 5,
      soldPastDays: 0,
      suggestedStock: 0,
      reorderAmount: 1,
      costPrice: p.costPrice || 0,
      priority: 'LOW',
      edited: true,
    };
    setOrderList(prev => [...prev, row]);
  };

  // ── Grand Total ───────────────────────────────────────────────────────────
  const activeOrderList = orderList.filter(r => r.reorderAmount > 0);
  const grandTotal = activeOrderList.reduce((sum, r) => sum + (r.reorderAmount * r.costPrice), 0);
  const totalItems = activeOrderList.length;

  // ── Restock: apply to Firestore ───────────────────────────────────────────
  const handleRestock = async () => {
    if (activeOrderList.length === 0) {
      toast.error('No items to restock. Quantities are all zero.');
      return;
    }

    setRestocking(true);
    try {
      const batch = writeBatch(db);
      activeOrderList.forEach(r => {
        const ref = doc(db, 'products', r.id);
        batch.update(ref, { stock: increment(r.reorderAmount) });
      });
      await batch.commit();

      const summary = activeOrderList.map(r => `${r.name} +${r.reorderAmount}`).join(', ');
      addLog('RESTOCK_APPLIED', `Restocked ${activeOrderList.length} items: ${summary}`);
      toast.success(`✅ Restocked ${activeOrderList.length} item${activeOrderList.length !== 1 ? 's' : ''} successfully!`);

      // Clear list after restock
      setOrderList([]);
      setInitializedFor('');
    } catch (err: any) {
      toast.error('Restock failed: ' + (err.message || 'Unknown error'));
    } finally {
      setRestocking(false);
    }
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const today = new Date().toLocaleDateString();
    const rows = activeOrderList.map(p =>
      `<tr>
        <td>${p.name}</td>
        <td>${p.reorderAmount}</td>
        <td>${settings.currency} ${p.costPrice.toLocaleString()}</td>
        <td>${settings.currency} ${(p.reorderAmount * p.costPrice).toLocaleString()}</td>
      </tr>`
    ).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    
    const brandHeader = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;" />` : ''}
          <div style="font-weight: bold; font-size: 18px;">${settings.companyName}</div>
          ${settings.address ? `<div style="color: #666; font-size: 12px;">${settings.address}</div>` : ''}
          ${settings.phone ? `<div style="color: #666; font-size: 12px;">${settings.phone}</div>` : ''}
          ${settings.email ? `<div style="color: #666; font-size: 12px;">${settings.email}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 22px; font-weight: bold; color: #1d4ed8;">ORDER LIST</div>
          <div style="color: #666; font-size: 12px; margin-top: 4px;">Prepared on: ${today}</div>
        </div>
      </div>
    `;

    win.document.write(`
      <html><head>
        <title>Order List — ${settings.companyName}</title>
        <style>
          body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;padding:32px;font-size:13px;color:#111;max-width:800px;margin:0 auto;}
          table{width:100%;border-collapse:collapse;margin-top:8px;}
          th{background:#f3f4f6;text-align:left;padding:8px 10px;border:1px solid #e5e7eb;color:#374151;font-weight:600;}
          td{padding:8px 10px;border:1px solid #e5e7eb;}
          tr:nth-child(even) td{background:#f8fafc;}
          .total-row {font-weight:bold; background:#eff6ff;}
          .footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;padding-top:16px;border-top:1px dashed #ccc;font-weight:400;}
        </style>
      </head><body>
        ${brandHeader}
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Order Qty</th>
              <th>Unit Cost</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; color:#1d4ed8;">GRAND TOTAL</td>
              <td style="color:#1d4ed8;">${settings.currency} ${grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          StoreSight. One System. Total Control.<br/>
          Powered by Indelible Technologies
        </div>
        <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const header = ['Product Name', 'Order Qty', `Unit Cost (${settings.currency})`, `Total Cost (${settings.currency})`];
    const rows = activeOrderList.map(p =>
      [p.name, p.reorderAmount, p.costPrice, (p.reorderAmount * p.costPrice)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    // Add grand total row
    rows.push(`"GRAND TOTAL","","","${grandTotal}"`);
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const handleShareWhatsApp = () => {
    const today = new Date().toLocaleDateString();
    const lines = activeOrderList.map((p, i) =>
      `${i + 1}. *${p.name}*\n   Qty: ${p.reorderAmount} x ${settings.currency}${p.costPrice.toLocaleString()} = ${settings.currency}${(p.reorderAmount * p.costPrice).toLocaleString()}`
    ).join('\n\n');
    const msg = `*${settings.companyName} — Purchase Order*\n📅 ${today}\n\n${lines}\n\n*GRAND TOTAL: ${settings.currency} ${grandTotal.toLocaleString()}*\n\n_Generated by StoreSight POS_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };


  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><TrendingUp size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Smart Order List</h1>
            <p className="text-sm text-gray-500">Edit quantities, add items, then click Restock to apply</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Analyze Past:</label>
            <select
              value={daysToAnalyze}
              onChange={e => setDaysToAnalyze(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>

          {orderList.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
                <Printer size={15}/> Print
              </button>
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition">
                <Download size={15}/> CSV
              </button>
              <button onClick={handleShareWhatsApp} className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium px-3 py-2 rounded-lg transition">
                <Share2 size={15}/> WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Add product manually ────────────────────────────────────────────── */}
      {remainingProducts.length > 0 && (
        <div className="bg-white border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-gray-600 shrink-0">
            <Plus size={18} className="text-blue-500"/>
            <span className="text-sm font-semibold">Add product to order list:</span>
          </div>
          <select
            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
            onChange={e => { if (e.target.value) { addProduct(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>— choose a product —</option>
            {remainingProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {orderList.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
            <Package size={48} className="mb-4 opacity-50"/>
            <h3 className="text-lg font-bold text-gray-600">Stock Levels are Healthy</h3>
            <p className="text-sm mt-1">No items currently need restocking based on recent sales.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b text-gray-500 font-semibold">
                  <tr>
                    <th className="p-4">#</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Sold ({daysToAnalyze}d)</th>
                    <th className="p-4">Suggested</th>
                    <th className="p-4">Unit Cost</th>
                    <th className="p-4 min-w-[140px]">
                      <span className="flex items-center gap-1"><PencilLine size={14}/> Order Qty</span>
                    </th>
                    <th className="p-4">Total Cost</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orderList.map((p, i) => (
                    <tr key={p.id} className={`hover:bg-gray-50 ${p.reorderAmount === 0 ? 'opacity-40' : ''}`}>
                      <td className="p-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="p-4 font-medium text-gray-800">
                        {p.name}
                        {p.edited && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">edited</span>}
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${p.currentStock <= p.reorderLevel ? 'text-red-500' : 'text-gray-700'}`}>
                          {p.currentStock}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-gray-600">{p.soldPastDays}</td>
                      <td className="p-4 text-gray-600">{p.suggestedStock}</td>
                      <td className="p-4 font-mono text-gray-600">{settings.currency} {p.costPrice.toLocaleString()}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          min={0}
                          value={p.reorderAmount}
                          onChange={e => updateQty(p.id, e.target.value)}
                          className="w-24 border rounded-lg px-3 py-1.5 text-sm font-bold text-blue-800 bg-blue-50 focus:ring-2 focus:ring-blue-400 outline-none"
                        />
                      </td>
                      <td className="p-4 font-mono font-bold text-gray-800">
                        {settings.currency} {(p.reorderAmount * p.costPrice).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {p.priority === 'HIGH' && <span className="flex items-center gap-1 text-red-600 font-bold text-xs"><AlertCircle size={13}/> HIGH</span>}
                        {p.priority === 'MEDIUM' && <span className="text-amber-600 font-bold text-xs">MEDIUM</span>}
                        {p.priority === 'LOW' && <span className="text-green-600 font-bold text-xs">LOW</span>}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => removeRow(p.id)}
                          title="Remove from order list"
                          className="text-gray-400 hover:text-red-500 transition p-1 rounded"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={7} className="p-4 text-right font-bold text-gray-700">GRAND TOTAL:</td>
                    <td className="p-4 font-bold text-lg text-blue-700 font-mono whitespace-nowrap">
                      {settings.currency} {grandTotal.toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Footer with Restock button ─────────────────────────────── */}
            <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-gray-700">{totalItems}</span> item{totalItems !== 1 ? 's' : ''} ready to restock &nbsp;•&nbsp;
                <span className="text-xs text-gray-400">Based on {daysToAnalyze}-day velocity</span>
              </p>
              <button
                onClick={handleRestock}
                disabled={restocking || totalItems === 0}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-md"
              >
                <CheckCircle size={18}/>
                {restocking ? 'Applying Restock…' : `✅ Restock ${totalItems} Item${totalItems !== 1 ? 's' : ''} Now`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
