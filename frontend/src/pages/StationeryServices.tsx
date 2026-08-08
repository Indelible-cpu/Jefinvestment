import { useState, useEffect } from 'react';
import { Plus, Printer, Edit, Trash2, X, Layers, Zap, Users, Package, DollarSign } from 'lucide-react';
import { useStationeryStore, type StationeryService } from '../store/stationeryStore';
import { useProductStore } from '../store/cartStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from 'sonner';

const EMPTY_SERVICE: Omit<StationeryService, 'id'> = {
  serviceName: '',
  sellingPrice: 0,
  laborCost: 0,
  electricityCost: 0,
  otherOverheadCost: 0,
  materialsUsed: [],
};

export default function StationeryServices() {
  const { services, loadStationeryServices, addStationeryService, updateStationeryService, deleteStationeryService } = useStationeryStore();
  const { products, loadProducts } = useProductStore();
  const settings = useSettingsStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<StationeryService, 'id'>>(EMPTY_SERVICE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StationeryService | null>(null);

  useEffect(() => {
    loadStationeryServices();
    loadProducts();
  }, []);

  // Only show physical products (not isService) as selectable materials
  const inventoryProducts = products.filter(p => !p.isService);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_SERVICE);
    setShowModal(true);
  };

  const openEdit = (svc: StationeryService) => {
    setEditingId(svc.id);
    setForm({
      serviceName: svc.serviceName,
      sellingPrice: svc.sellingPrice,
      laborCost: svc.laborCost,
      electricityCost: svc.electricityCost,
      otherOverheadCost: svc.otherOverheadCost,
      materialsUsed: svc.materialsUsed.map(m => ({ ...m })),
    });
    setShowModal(true);
  };

  const addMaterialRow = () => {
    setForm(f => ({
      ...f,
      materialsUsed: [...f.materialsUsed, { inventoryItemId: '', quantityPerUnit: 1 }],
    }));
  };

  const removeMaterialRow = (index: number) => {
    setForm(f => ({ ...f, materialsUsed: f.materialsUsed.filter((_, i) => i !== index) }));
  };

  const updateMaterialRow = (index: number, field: 'inventoryItemId' | 'quantityPerUnit', value: string | number) => {
    setForm(f => ({
      ...f,
      materialsUsed: f.materialsUsed.map((m, i) => i === index ? { ...m, [field]: value } : m),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceName.trim()) { toast.error('Service name is required'); return; }
    if (form.sellingPrice <= 0) { toast.error('Selling price must be greater than 0'); return; }
    if (form.materialsUsed.some(m => !m.inventoryItemId)) { toast.error('Please select a product for each material row'); return; }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateStationeryService(editingId, form);
        toast.success('Service updated successfully');
      } else {
        await addStationeryService(form);
        toast.success(`"${form.serviceName}" added successfully`);
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error('Failed to save service', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteStationeryService(confirmDelete.id);
      toast.success(`"${confirmDelete.serviceName}" deleted`);
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error('Failed to delete', { description: err.message });
    }
  };

  const getProductName = (id: string) => inventoryProducts.find(p => p.id === id)?.name || id;

  const calcUnitCost = (svc: StationeryService) => {
    const matCost = svc.materialsUsed.reduce((sum, m) => {
      const product = inventoryProducts.find(p => p.id === m.inventoryItemId);
      return sum + (product?.costPrice || 0) * m.quantityPerUnit;
    }, 0);
    return matCost + svc.laborCost + svc.electricityCost + svc.otherOverheadCost;
  };

  return (
    <div className="p-4 md:p-8 bg-background min-h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Printer size={28} className="text-primary" /> Stationery Services
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure printing, copying, laminating and other material-based services. Materials are deducted from shared inventory on each sale.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition shadow-md self-start"
        >
          <Plus size={20} /> Add Service
        </button>
      </div>

      {/* Service Cards */}
      {services.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400 py-20">
            <Printer size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No stationery services configured yet</p>
            <p className="text-sm">Click "Add Service" to configure printing, copying, etc.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {services.map(svc => {
            const unitCost = calcUnitCost(svc);
            const unitProfit = svc.sellingPrice - unitCost;
            return (
              <div key={svc.id} className="bg-card border rounded-xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-bold text-lg text-foreground">{svc.serviceName}</h2>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Stationery Service</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(svc)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete(svc)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Pricing breakdown */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-green-50 rounded-lg p-2.5">
                    <div className="text-gray-500 text-xs">Selling Price</div>
                    <div className="font-bold text-green-700">{settings.currency} {svc.sellingPrice.toLocaleString()}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2.5">
                    <div className="text-gray-500 text-xs">Total Unit Cost</div>
                    <div className="font-bold text-red-600">{settings.currency} {unitCost.toFixed(2)}</div>
                  </div>
                  <div className="col-span-2 bg-blue-50 rounded-lg p-2.5">
                    <div className="text-gray-500 text-xs">Est. Profit / Unit</div>
                    <div className={`font-bold text-lg ${unitProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {settings.currency} {unitProfit.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Cost breakdown chips */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-1">
                    <Users size={11} /> Labor: {settings.currency} {svc.laborCost}
                  </span>
                  <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-full flex items-center gap-1">
                    <Zap size={11} /> Electricity: {settings.currency} {svc.electricityCost}
                  </span>
                  <span className="bg-gray-50 text-gray-600 border px-2 py-1 rounded-full flex items-center gap-1">
                    <Layers size={11} /> Overhead: {settings.currency} {svc.otherOverheadCost}
                  </span>
                </div>

                {/* Materials */}
                {svc.materialsUsed.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <Package size={12} /> MATERIALS USED PER UNIT
                    </div>
                    <div className="space-y-1">
                      {svc.materialsUsed.map((m, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                          <span>{getProductName(m.inventoryItemId)}</span>
                          <span className="font-semibold">× {m.quantityPerUnit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-xl border my-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Service' : 'New Stationery Service'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Service Name */}
              <div>
                <label className="block text-xs font-semibold mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border rounded-lg"
                  placeholder="e.g. Black & White Printing"
                  value={form.serviceName}
                  onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                />
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign size={13} /> Pricing (per unit / page)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Selling Price ({settings.currency}) *</label>
                    <input
                      type="number" min={0} required
                      className="w-full p-2 border rounded-lg"
                      value={form.sellingPrice || ''}
                      onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Labor Cost ({settings.currency})</label>
                    <input
                      type="number" min={0}
                      className="w-full p-2 border rounded-lg"
                      value={form.laborCost || ''}
                      onChange={e => setForm(f => ({ ...f, laborCost: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Electricity Cost ({settings.currency})</label>
                    <input
                      type="number" min={0}
                      className="w-full p-2 border rounded-lg"
                      value={form.electricityCost || ''}
                      onChange={e => setForm(f => ({ ...f, electricityCost: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Other Overhead ({settings.currency})</label>
                    <input
                      type="number" min={0}
                      className="w-full p-2 border rounded-lg"
                      value={form.otherOverheadCost || ''}
                      onChange={e => setForm(f => ({ ...f, otherOverheadCost: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>

              {/* Materials */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold flex items-center gap-1"><Package size={13} /> Materials Used Per Unit</label>
                  <button type="button" onClick={addMaterialRow} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={13} /> Add Material
                  </button>
                </div>
                {form.materialsUsed.length === 0 && (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded p-3 text-center">
                    No materials added. Click "Add Material" to link inventory items.
                  </p>
                )}
                <div className="space-y-2">
                  {form.materialsUsed.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        className="flex-1 p-2 border rounded-lg text-sm"
                        value={m.inventoryItemId}
                        onChange={e => updateMaterialRow(i, 'inventoryItemId', e.target.value)}
                        required
                      >
                        <option value="">— Select Product —</option>
                        {inventoryProducts.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.unit}) — Stock: {p.stock}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        className="w-20 p-2 border rounded-lg text-sm text-center"
                        title="Quantity per unit"
                        value={m.quantityPerUnit}
                        onChange={e => updateMaterialRow(i, 'quantityPerUnit', Number(e.target.value))}
                      />
                      <button type="button" onClick={() => removeMaterialRow(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Delete Service?</h3>
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete <strong>"{confirmDelete.serviceName}"</strong>? This cannot be undone. Existing sales records will not be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
