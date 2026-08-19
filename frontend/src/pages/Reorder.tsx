import React, { useState, useMemo } from 'react';
import { useProductStore } from '../store/cartStore';
import { useSaleStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { ShoppingCart, TrendingUp, AlertCircle, Package } from 'lucide-react';

export default function Reorder() {
  const { products } = useProductStore();
  const { sales } = useSaleStore();
  const settings = useSettingsStore();

  const [daysToAnalyze, setDaysToAnalyze] = useState(30);

  const reorderData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
    const cutoffString = cutoffDate.toISOString().slice(0, 10);

    // Calculate sales velocity (quantity sold) for each product
    const salesMap: Record<string, number> = {};
    sales.forEach(sale => {
      if (sale.status === 'completed' && sale.date >= cutoffString) {
        sale.items.forEach(item => {
          if (!item.isService && !item.isStationeryService) {
            const pid = item.productId || item.id;
            salesMap[pid] = (salesMap[pid] || 0) + item.quantity;
          }
        });
      }
    });

    const data = products
      .filter(p => !p.isService)
      .map(p => {
        const soldPastDays = salesMap[p.id] || 0;
        const dailyVelocity = soldPastDays / daysToAnalyze;
        
        // Suggest stock for next 30 days based on velocity
        const suggestedStock = Math.ceil(dailyVelocity * 30);
        
        // Recommended reorder amount (if current stock is less than suggested)
        const reorderAmount = Math.max(0, suggestedStock - p.stock);
        
        const priority = reorderAmount > 0 && p.stock <= (p.minStockLevel || 5) ? 'HIGH' :
                         reorderAmount > 0 ? 'MEDIUM' : 'LOW';

        return {
          ...p,
          soldPastDays,
          dailyVelocity,
          suggestedStock,
          reorderAmount,
          priority
        };
      })
      .filter(p => p.reorderAmount > 0 || p.priority === 'HIGH')
      .sort((a, b) => b.reorderAmount - a.reorderAmount);

    return data;
  }, [products, sales, daysToAnalyze]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
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
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
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
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Current Stock</th>
                  <th className="p-4">Sold (Past {daysToAnalyze} Days)</th>
                  <th className="p-4">Suggested Level</th>
                  <th className="p-4">Recommend Reorder</th>
                  <th className="p-4">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reorderData.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{p.name}</td>
                    <td className="p-4">
                      <span className={`font-bold ${p.stock <= (p.minStockLevel || 5) ? 'text-red-500' : 'text-gray-700'}`}>
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
          </div>
        )}
      </div>
    </div>
  );
}
