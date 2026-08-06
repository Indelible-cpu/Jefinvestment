import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Package, AlertTriangle, ScanLine, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useProductStore, type Product } from '../store/cartStore';
import BarcodeScanner from '../components/BarcodeScanner';

const UNITS = ['pcs', 'box', 'ream', 'roll', 'pack'];

const emptyForm: Omit<Product, 'id'> = {
  name: '', sku: '', category: 'Accessories', costPrice: 0, sellingPrice: 0,
  stock: 0, reorderLevel: 5, isService: false, unit: 'pcs',
};

export default function Inventory() {
  const { products, isLoading: productsLoading, addProduct, updateProduct, deleteProduct, loadProducts } = useProductStore();

  useEffect(() => {
    loadProducts();
  }, []);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Get all unique categories dynamically
  const CATEGORIES = Array.from(new Set([
    'Smartphones', 'Accessories', 'Stationery', 'Services', 'Other', 
    ...products.map(p => p.category)
  ]));

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const lowStockCount = products.filter(p => !p.isService && p.stock <= p.reorderLevel).length;

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (p: Product) => { const { id, ...rest } = p; setForm(rest); setEditId(id); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim()) return;
    try {
      if (editId) {
        await updateProduct({ ...form, id: editId });
        toast.success('Product updated successfully');
      } else {
        await addProduct({ ...form, id: Date.now().toString() });
        toast.success('Product added successfully');
      }
      setShowModal(false);
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Product saved locally and will sync when online.' });
        setShowModal(false);
      } else {
        toast.error('Failed to save product', { description: err.message });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success('Product deleted');
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Delete queued and will sync when online.' });
      } else {
        toast.error('Failed to delete product', { description: err.message });
      }
    }
    setConfirmDelete(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked
        : ['costPrice', 'sellingPrice', 'stock', 'reorderLevel'].includes(name) ? parseFloat(value) || 0
        : value
    }));
  };

  const generateSKU = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const prefix = form.name ? form.name.substring(0, 3).toUpperCase() : 'SKU';
    setForm(prev => ({ ...prev, sku: `${prefix}-${randomNum}` }));
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
            <Package size={28} /> Inventory Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{products.length} products · {products.filter(p => !p.isService).reduce((s, p) => s + p.stock, 0)} units in stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm font-medium">
              <AlertTriangle size={16} />
              {lowStockCount} low stock
            </div>
          )}
          <button onClick={openAdd} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition shadow-md">
            <Plus size={20} /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input type="text" placeholder="Search by name or SKU..." className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${catFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4 font-semibold text-gray-600">Product</th>
                <th className="p-4 font-semibold text-gray-600">SKU</th>
                <th className="p-4 font-semibold text-gray-600">Category</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Cost (MWK)</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Price (MWK)</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Stock</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Type</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-gray-400">No products found.</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-gray-500 font-mono text-sm">{p.sku}</td>
                  <td className="p-4 text-gray-600">{p.category}</td>
                  <td className="p-4 text-right text-gray-600">{p.costPrice.toLocaleString()}</td>
                  <td className="p-4 text-right font-semibold text-primary">{p.sellingPrice.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    {p.isService ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${p.stock <= p.reorderLevel ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {p.stock} {p.unit}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isService ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.isService ? 'Service' : 'Product'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => setConfirmDelete(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">{editId ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Product / Service Name *</label>
                <input name="name" value={form.name} onChange={handleFormChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Samsung S23 FE" />
              </div>
              {/* SKU & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">SKU / Code *</label>
                  <div className="flex relative">
                    <input name="sku" value={form.sku} onChange={handleFormChange} className="w-full pl-3 pr-16 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono" placeholder="e.g. PH-S23FE" />
                    <div className="absolute right-1 top-1.5 flex gap-1">
                      <button type="button" onClick={generateSKU} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded" title="Generate SKU">
                        <RefreshCw size={16} />
                      </button>
                      {!form.isService && (
                        <button type="button" onClick={() => setShowScanner(true)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded" title="Scan Barcode">
                          <ScanLine size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {!form.isService && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
                    <select name="unit" value={form.unit} onChange={handleFormChange} className="w-full p-2.5 border rounded-lg">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                {!CATEGORIES.includes(form.category) && form.category !== '' ? (
                  <div className="flex gap-2">
                    <input 
                      name="category" 
                      value={form.category} 
                      onChange={handleFormChange} 
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" 
                      placeholder="Type custom category name..."
                    />
                    <button type="button" onClick={() => handleFormChange({ target: { name: 'category', value: CATEGORIES[0] } } as any)} className="px-3 border rounded-lg text-gray-500 hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select 
                    name="category" 
                    value={form.category} 
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        handleFormChange({ target: { name: 'category', value: 'New Category' } } as any);
                      } else {
                        handleFormChange(e);
                      }
                    }} 
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__CUSTOM__">+ Add Custom Category...</option>
                  </select>
                )}
              </div>
              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cost Price (MWK)</label>
                  <input name="costPrice" type="number" value={form.costPrice} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Selling Price (MWK) *</label>
                  <input name="sellingPrice" type="number" value={form.sellingPrice} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                </div>
              </div>
              {/* Stock (only for non-services) */}
              {!form.isService && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Current Stock</label>
                    <input name="stock" type="number" value={form.stock} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Reorder Level</label>
                    <input name="reorderLevel" type="number" value={form.reorderLevel} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                  </div>
                </div>
              )}
              {/* Is Service */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                <input type="checkbox" id="isService" name="isService" checked={form.isService} onChange={handleFormChange} className="w-5 h-5 accent-purple-600" />
                <label htmlFor="isService" className="text-sm font-medium text-purple-800">This is a Service (not a physical product)</label>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end rounded-b-xl">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium">Cancel</button>
              <button onClick={handleSave} className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                {editId ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2 text-gray-800">Delete Product?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone. The product will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 font-medium">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Scanner Modal for Inventory */}
      {showScanner && (
        <BarcodeScanner 
          onScan={(code) => {
            setForm(prev => ({ ...prev, sku: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
