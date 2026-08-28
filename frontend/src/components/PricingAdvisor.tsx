import { useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { useProductStore, type Product } from '../store/cartStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from 'sonner';

interface PricingAdvice {
  product: Product;
  type: 'DROP' | 'INCREASE';
  reason: string;
  suggestedPrice: number;
}

export default function PricingAdvisor() {
  const { products, updateProduct } = useProductStore();
  const settings = useSettingsStore();

  const adviceList = useMemo(() => {
    const list: PricingAdvice[] = [];
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    products.forEach((p) => {
      // Skip services and equipment
      if (p.isService || p.isEquipment) return;
      if (!p.createdAt) return; // Skip if we don't know the age

      const ageDays = (now - p.createdAt) / DAY_MS;

      // Rule 1: Slow Movers
      // Added > 30 days ago AND stock is high (> 3x reorder level, or > 20 if no reorder level)
      const highStockThreshold = p.reorderLevel > 0 ? p.reorderLevel * 3 : 20;
      if (ageDays > 30 && p.stock > highStockThreshold) {
        const potentialNewPrice = Math.floor(p.sellingPrice * 0.9); // 10% drop
        // Only suggest if the new price is above cost price and different from current
        if (potentialNewPrice >= p.costPrice && potentialNewPrice < p.sellingPrice) {
          list.push({
            product: p,
            type: 'DROP',
            reason: `In stock for >30 days with high inventory (${p.stock}).`,
            suggestedPrice: potentialNewPrice
          });
          return;
        }
      }

      // Rule 2: High Demand
      // Added < 14 days ago AND stock is already low (<= reorderLevel)
      const lowStockThreshold = p.reorderLevel > 0 ? p.reorderLevel : 5;
      if (ageDays < 14 && p.stock <= lowStockThreshold && p.stock > 0) {
        const potentialNewPrice = Math.ceil(p.sellingPrice * 1.05); // 5% increase
        if (potentialNewPrice > p.sellingPrice) {
          list.push({
            product: p,
            type: 'INCREASE',
            reason: `Selling fast! Stock is low (${p.stock}) after just ${Math.floor(ageDays)} days.`,
            suggestedPrice: potentialNewPrice
          });
        }
      }
    });

    return list;
  }, [products]);

  const handleApply = async (advice: PricingAdvice) => {
    try {
      await updateProduct({
        ...advice.product,
        sellingPrice: advice.suggestedPrice
      });
      toast.success(`Price updated for ${advice.product.name} to ${settings.currency} ${advice.suggestedPrice.toLocaleString()}`);
    } catch (err: any) {
      toast.error('Failed to update price', { description: err.message });
    }
  };

  if (adviceList.length === 0) {
    return null; // Don't show anything if no advice
  }

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-blue-600" size={20} />
          <h2 className="font-bold text-blue-900 text-lg">Smart Pricing Advisor</h2>
        </div>
        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          {adviceList.length} Insights
        </span>
      </div>
      
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {adviceList.map((advice) => (
          <div key={advice.product.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {advice.type === 'DROP' ? (
                  <TrendingDown className="text-amber-500" size={18} />
                ) : (
                  <TrendingUp className="text-emerald-500" size={18} />
                )}
                <span className="font-semibold text-gray-800">{advice.product.name}</span>
                <span className="text-xs text-gray-500 font-mono">({advice.product.sku})</span>
              </div>
              <p className="text-sm text-gray-600">{advice.reason}</p>
              
              <div className="flex items-center gap-3 mt-2 text-sm font-medium">
                <span className="line-through text-gray-400">
                  {settings.currency} {advice.product.sellingPrice.toLocaleString()}
                </span>
                <ChevronRight size={14} className="text-gray-400" />
                <span className={advice.type === 'DROP' ? 'text-amber-600' : 'text-emerald-600'}>
                  {settings.currency} {advice.suggestedPrice.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 font-normal ml-2">
                  (Cost: {settings.currency} {advice.product.costPrice.toLocaleString()})
                </span>
              </div>
            </div>
            
            <button
              onClick={() => handleApply(advice)}
              className="whitespace-nowrap px-4 py-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-blue-600 text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-1"
            >
              <CheckCircle size={16} /> Apply Price
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
