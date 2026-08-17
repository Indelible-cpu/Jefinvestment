import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, Package, AlertTriangle, ScanLine, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';
import { useProductStore, type Product } from '../store/cartStore';
import BarcodeScanner from '../components/BarcodeScanner';

const UNITS = ['pcs', 'box', 'ream', 'roll', 'pack', 'sheet'];
const SHEETS_PER_REAM = 500;

const emptyForm: Omit<Product, 'id'> = {
  name: '', sku: '', category: 'Accessories', costPrice: 0, sellingPrice: 0,
  stock: 0, reorderLevel: 5, isService: false, isEquipment: false, unit: 'pcs',
};

export default function Inventory() {
  const { products, isLoading: productsLoading, addProduct, updateProduct, deleteProduct, loadProducts } = useProductStore();
  const settings = useSettingsStore();

  useEffect(() => {
    loadProducts();
  }, []);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const autoClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ?search= param into the search field
  useEffect(() => {
    const query = searchParams.get('search');
    if (query !== null) setSearch(query);
  }, [searchParams]);

  // Handle ?highlight=<id> — scroll to, pulse-highlight, then clear
  useEffect(() => {
    const id = searchParams.get('highlight');
    if (!id) return;
    setHighlightId(id);
    // Give the table time to render before scrolling
    const scrollTimer = setTimeout(() => {
      const row = rowRefs.current[id];
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    // Remove highlight and clean up URL param after 3 s
    const clearTimer = setTimeout(() => {
      setHighlightId(null);
      navigate('/inventory', { replace: true });
    }, 3500);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, [searchParams]);

  // Auto-clear the search field 8 seconds after the user stops typing
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (autoClearRef.current) clearTimeout(autoClearRef.current);
    if (val.trim()) {
      autoClearRef.current = setTimeout(() => {
        setSearch('');
      }, 8000);
    }
  }, []);

  const [catFilter, setCatFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'All' | 'Products' | 'Services' | 'Equipment'>('All');
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reamRestockProduct, setReamRestockProduct] = useState<Product | null>(null);
  const [reamQty, setReamQty] = useState('');

  const CATEGORIES = Array.from(new Set([
    'Accessories', 'Stationery Items', 'Stationery Service', 'Services',
    ...products.map(p => p.category === 'Stationery' ? 'Stationery Items' : p.category)
  ])).filter(c => c && c !== 'General' && c !== 'Other' && c !== 'Smartphones');

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || p.category === catFilter;
    const matchTab =
      activeTab === 'All' ||
      (activeTab === 'Equipment' && p.isEquipment) ||
      (activeTab === 'Services' && p.isService && !p.isEquipment) ||
      (activeTab === 'Products' && !p.isService && !p.isEquipment);
    return matchSearch && matchCat && matchTab;
  });

  const equipmentList = products.filter(p => p.isEquipment);
  const totalEquipmentCost = equipmentList.reduce((sum, p) => sum + (p.costPrice || 0), 0);

  const lowStockCount = products.filter(p => !p.isService && !p.isEquipment && p.stock <= p.reorderLevel).length;

  // Resale Inventory Valuation (Excludes Services & Equipment)
  const resaleProducts = products.filter(p => !p.isService && !p.isEquipment && p.stock > 0);
  const totalInventoryCost = resaleProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
  const expectedRevenue = resaleProducts.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0);
  const expectedProfit = expectedRevenue - totalInventoryCost;

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (p: Product) => { const { id, ...rest } = p; setForm(rest); setEditId(id); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim()) return;
    setIsSubmitting(true);
    
    // Ensure equipment doesn't save a reorder level
    const submitForm = { 
      ...form,
      costPrice: Number(form.costPrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      stock: Number(form.stock) || 0,
      reorderLevel: Number(form.reorderLevel) || 0
    };
    if (submitForm.isEquipment) {
      submitForm.reorderLevel = 0;
    }

    try {
      if (editId) {
        await updateProduct({ ...submitForm, id: editId });
        toast.success('Product updated successfully');
      } else {
        await addProduct({ ...submitForm, id: Date.now().toString() });
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReamRestock = async () => {
    if (!reamRestockProduct || !reamQty || Number(reamQty) <= 0) return;
    const sheetsToAdd = Math.round(Number(reamQty) * SHEETS_PER_REAM);
    setIsSubmitting(true);
    try {
      await updateProduct({ ...reamRestockProduct, stock: reamRestockProduct.stock + sheetsToAdd });
      toast.success(`Added ${sheetsToAdd.toLocaleString()} sheets (${reamQty} ream${Number(reamQty) > 1 ? 's' : ''}) to ${reamRestockProduct.name}`);
      setReamRestockProduct(null);
      setReamQty('');
    } catch (err: any) {
      toast.error('Restock failed', { description: err.message });
    } finally {
      setIsSubmitting(false);
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
        : ['costPrice', 'sellingPrice', 'stock', 'reorderLevel'].includes(name) ? (value === '' ? '' : (parseFloat(value) || 0))
        : value
    }));
  };

  const generateSKU = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const prefix = form.name ? form.name.substring(0, 3).toUpperCase() : 'SKU';
    setForm(prev => ({ ...prev, sku: `${prefix}-${randomNum}` }));
  };

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
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
            <Plus size={20} /> Add Product / Equipment
          </button>
        </div>
      </div>

      {/* Inventory Valuation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Inventory Cost</div>
          <div className="text-2xl font-black text-gray-800 mt-1">
            {settings.currency} {totalInventoryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Current capital invested in stock</div>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Expected Revenue</div>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {settings.currency} {expectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Value if all current stock is sold</div>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Expected Profit</div>
          <div className={`text-2xl font-black mt-1 ${expectedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {settings.currency} {expectedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Potential gross margin from stock</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {(['All', 'Products', 'Services', 'Equipment'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === tab
                ? tab === 'Equipment' ? 'border-amber-500 text-amber-700' : 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'Equipment' && equipmentList.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{equipmentList.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Equipment Summary (shown when Equipment tab is active) */}
      {activeTab === 'Equipment' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-amber-600" />
          </div>
          <div>
            <div className="font-bold text-amber-900 text-sm">{equipmentList.length} Business Asset{equipmentList.length !== 1 ? 's' : ''} registered</div>
            <div className="text-xs text-amber-700 mt-0.5">Total acquisition cost: <span className="font-bold">{settings.currency} {totalEquipmentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> — Excluded from resale inventory valuation</div>
          </div>
        </div>
      )}

      {/* Category Filters (only when not in Equipment tab) */}
      {activeTab !== 'Equipment' && (
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input type="text" placeholder="Search by name or SKU..." className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary outline-none" value={search} onChange={handleSearchChange} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['All', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${catFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'Equipment' && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input type="text" placeholder="Search equipment..." className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-amber-400 outline-none" value={search} onChange={handleSearchChange} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4 font-semibold text-gray-600">Product</th>
                <th className="p-4 font-semibold text-gray-600">SKU</th>
                <th className="p-4 font-semibold text-gray-600">Category</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Cost ({settings.currency})</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Price ({settings.currency})</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Profit ({settings.currency})</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Stock</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Type</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-gray-400">No products found.</td></tr>
              ) : filtered.map(p => (
                <tr
                  key={p.id}
                  ref={el => { rowRefs.current[p.id] = el; }}
                  className={`border-b hover:bg-gray-50 transition ${
                    highlightId === p.id
                      ? 'ring-2 ring-inset ring-amber-400 bg-amber-50 animate-pulse'
                      : ''
                  }`}
                >
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-gray-500 font-mono text-sm">{p.sku}</td>
                  <td className="p-4 text-gray-600">{p.category}</td>
                  <td className="p-4 text-right text-gray-600">{p.costPrice.toLocaleString()}</td>
                  <td className="p-4 text-right font-semibold text-primary">
                    {p.isEquipment ? <span className="text-gray-400 text-sm">—</span> : p.sellingPrice.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-semibold">
                    {p.isEquipment ? <span className="text-gray-400 text-sm">—</span> : (() => {
                      const profit = p.sellingPrice - p.costPrice;
                      if (profit > 0) return <span className="text-green-600">+{profit.toLocaleString()}</span>;
                      if (profit < 0) return <span className="text-red-600">{profit.toLocaleString()}</span>;
                      return <span className="text-gray-400">0</span>;
                    })()}
                  </td>
                  <td className="p-4 text-center">
                    {p.isService ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${(!p.isEquipment && p.stock <= p.reorderLevel) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {p.isEquipment ? `Asset: ${p.stock}` : `${p.stock} ${p.unit || ''}`}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.isEquipment ? 'bg-amber-100 text-amber-800' : p.isService ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.isEquipment ? 'Equipment' : p.isService ? 'Service' : 'Product'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {!p.isService && p.unit === 'ream' && (
                        <button
                          onClick={() => { setReamRestockProduct(p); setReamQty(''); }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                          title="Restock in Reams"
                        >
                          <RefreshCw size={14} /> Restock
                        </button>
                      )}
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
          <form className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); handleSave(); }}>
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
              {/* Category — hidden for equipment */}
              {!form.isEquipment && (
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
              )}
              {/* Prices — Equipment only shows purchase/acquisition cost */}
              {form.isEquipment ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Equipment / Asset Details</div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Purchase / Acquisition Cost ({settings.currency})</label>
                    <input name="costPrice" type="number" value={form.costPrice} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" min={0} />
                    <p className="text-xs text-amber-700 mt-1">This is the amount paid to acquire the equipment. It is <strong>not</strong> added to resale inventory or expected profit.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cost Price ({settings.currency})</label>
                    <input name="costPrice" type="number" value={form.costPrice} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Selling Price ({settings.currency}) *</label>
                    <input name="sellingPrice" type="number" value={form.sellingPrice} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                  </div>
                </div>
              )}
              {/* Stock / Asset Quantity */}
              {!form.isService && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={form.isEquipment ? "col-span-2" : ""}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{form.isEquipment ? "Asset Quantity" : "Current Stock"}</label>
                    <input name="stock" type="number" value={form.stock} onChange={handleFormChange} onFocus={(e) => e.target.select()} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none ${form.isEquipment ? 'focus:ring-amber-400' : 'focus:ring-primary'}`} min={0} />
                  </div>
                  {!form.isEquipment && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Reorder Level</label>
                      <input name="reorderLevel" type="number" value={form.reorderLevel} onChange={handleFormChange} onFocus={(e) => e.target.select()} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" min={0} />
                    </div>
                  )}
                </div>
              )}
              {/* Is Service / Equipment checkboxes */}
              <div className="space-y-2">
                {!form.isEquipment && (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                    <input type="checkbox" id="isService" name="isService" checked={form.isService} onChange={e => {
                      const checked = e.target.checked;
                      setForm(prev => ({ ...prev, isService: checked, ...(checked ? { isEquipment: false } : {}) }));
                    }} className="w-5 h-5 accent-purple-600" />
                    <label htmlFor="isService" className="text-sm font-medium text-purple-800">This is a Service (not a physical product)</label>
                  </div>
                )}

                {!form.isService && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <input type="checkbox" id="isEquipment" name="isEquipment" checked={form.isEquipment || false} onChange={e => {
                      const checked = e.target.checked;
                      setForm(prev => ({ ...prev, isEquipment: checked, ...(checked ? { isService: false } : {}) }));
                    }} className="w-5 h-5 accent-amber-600" />
                    <div>
                      <label htmlFor="isEquipment" className="text-sm font-semibold text-amber-900 block">Business Equipment / Asset</label>
                      <span className="text-xs text-amber-700">Printer, Computer, Copier, Laminator — Excluded from resale inventory valuation</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end rounded-b-xl">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium">Cancel</button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editId ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </form>
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

      {/* Ream Restock Modal */}
      {reamRestockProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReamRestockProduct(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Restock in Reams</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{reamRestockProduct.name}</strong> — Current stock: <strong>{reamRestockProduct.stock.toLocaleString()} sheets</strong><br />
              1 ream = {SHEETS_PER_REAM} sheets
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Number of Reams to Add</label>
              <input
                type="number" min={1} step={1}
                className="w-full p-2.5 border rounded-lg text-center font-bold text-lg"
                placeholder="e.g. 3"
                value={reamQty}
                onChange={e => setReamQty(e.target.value)}
                autoFocus
              />
              {reamQty && Number(reamQty) > 0 && (
                <p className="text-xs text-green-700 mt-1.5 font-medium">
                  Will add {(Number(reamQty) * SHEETS_PER_REAM).toLocaleString()} sheets → New stock: {(reamRestockProduct.stock + Number(reamQty) * SHEETS_PER_REAM).toLocaleString()} sheets
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReamRestockProduct(null)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 font-medium">Cancel</button>
              <button
                onClick={handleReamRestock}
                disabled={isSubmitting || !reamQty || Number(reamQty) <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Restocking...' : 'Confirm Restock'}
              </button>
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
