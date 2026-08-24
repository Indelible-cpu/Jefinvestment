import { useState, useEffect } from 'react';
import { GitBranch, Plus, Trash2, Edit2, Check, X, MapPin, Phone, User, Building2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useBranchStore, type Branch } from '../store/branchStore';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

const DEFAULT_BRANCH: Branch = {
  id: 'main',
  name: 'Main Branch',
  location: 'Headquarters',
  phone: '',
  managerName: '',
  isActive: true,
  createdAt: 0,
};

export default function Branches() {
  const { branches, isLoading, loadBranches, addBranch, updateBranch, deleteBranch } = useBranchStore();
  const { users } = useAuthStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', location: '', phone: '', managerName: '' });
  const [editForm, setEditForm] = useState({ name: '', location: '', phone: '', managerName: '' });

  useEffect(() => {
    loadBranches();
  }, []);

  // Combine the permanent default HQ branch with Firestore branches (preventing duplicates if edited)
  const firestoreMain = branches.find(b => b.id === 'main');
  const mainBranch = firestoreMain || DEFAULT_BRANCH;
  const allBranches = [mainBranch, ...branches.filter(b => b.id !== 'main')];

  const getUserCountForBranch = (branchId: string) =>
    users.filter((u) => (u.branchId || 'main') === branchId).length;

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Branch name is required.'); return; }
    if (!form.location.trim()) { toast.error('Branch location is required.'); return; }
    try {
      await addBranch({ name: form.name.trim(), location: form.location.trim(), phone: form.phone.trim(), managerName: form.managerName.trim() });
      toast.success(`Branch "${form.name}" created!`);
      setForm({ name: '', location: '', phone: '', managerName: '' });
      setShowAddForm(false);
    } catch (e) {
      toast.error('Failed to create branch. Please try again.');
    }
  };

  const startEdit = (b: Branch) => {
    setEditingId(b.id);
    setEditForm({ name: b.name, location: b.location, phone: b.phone || '', managerName: b.managerName || '' });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) { toast.error('Branch name is required.'); return; }
    try {
      await updateBranch(id, { name: editForm.name.trim(), location: editForm.location.trim(), phone: editForm.phone.trim(), managerName: editForm.managerName.trim() });
      toast.success('Branch updated successfully!');
      setEditingId(null);
    } catch (e) {
      toast.error('Failed to update branch.');
    }
  };

  const handleToggleActive = async (b: Branch) => {
    try {
      await updateBranch(b.id, { isActive: !b.isActive });
      toast.success(`Branch "${b.name}" ${!b.isActive ? 'activated' : 'deactivated'}.`);
    } catch (e) {
      toast.error('Failed to update branch status.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBranch(id);
      toast.success('Branch deleted.');
      setDeleteConfirmId(null);
    } catch (e) {
      toast.error('Failed to delete branch.');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch size={24} className="text-blue-600" />
            Branch Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage all business locations</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition shadow-sm"
        >
          <Plus size={18} /> Add New Branch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Branches</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{allBranches.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active</p>
          <p className="text-3xl font-black text-green-600 mt-1">{allBranches.filter(b => b.isActive).length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Staff Assigned</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{users.length}</p>
        </div>
      </div>

      {/* Add Branch Form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2"><Building2 size={18} className="text-blue-600" /> New Branch Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Branch Name *</label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Blantyre Branch"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Location / Address *</label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Blantyre, Malawi"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Branch Phone</label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. +265 999 000 000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Branch Manager Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. John Banda"
                value={form.managerName}
                onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition text-sm">
              <Check size={16} /> Create Branch
            </button>
            <button onClick={() => { setShowAddForm(false); setForm({ name: '', location: '', phone: '', managerName: '' }); }} className="flex items-center gap-2 bg-white border text-gray-600 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 active:scale-95 transition text-sm">
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Branch List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading branches...</div>
      ) : (
        <div className="space-y-3">
          {allBranches.map((branch) => {
            const isDefault = branch.id === 'main';
            const isEditing = editingId === branch.id;
            const isConfirmingDelete = deleteConfirmId === branch.id;
            const staffCount = getUserCountForBranch(branch.id);

            return (
              <div key={branch.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${!branch.isActive ? 'opacity-60' : ''}`}>
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDefault ? 'bg-blue-100' : 'bg-purple-100'}`}>
                        <Building2 size={20} className={isDefault ? 'text-blue-600' : 'text-purple-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            <input className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Branch name" />
                            <input className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" />
                            <input className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
                            <input className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.managerName} onChange={e => setEditForm(f => ({ ...f, managerName: e.target.value }))} placeholder="Manager name" />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-gray-900 text-base">{branch.name}</h3>
                              {isDefault && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wide">HQ</span>}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {branch.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                              <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={11} /> {branch.location}</span>
                              {branch.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} /> {branch.phone}</span>}
                              {branch.managerName && <span className="text-xs text-gray-500 flex items-center gap-1"><User size={11} /> {branch.managerName}</span>}
                            </div>
                          </>
                        )}
                        <div className="mt-2">
                          <span className="text-xs font-semibold text-gray-400">{staffCount} staff assigned</span>
                          {staffCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {users.filter(u => (u.branchId || 'main') === branch.id).slice(0, 5).map(u => (
                                <span key={u.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{u.name}</span>
                              ))}
                              {staffCount > 5 && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+{staffCount - 5} more</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleUpdate(branch.id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 transition"><Check size={13} /> Save</button>
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition"><X size={13} /> Cancel</button>
                        </>
                      ) : isConfirmingDelete ? (
                        <>
                          <span className="text-xs text-red-600 font-semibold">Delete?</span>
                          <button onClick={() => handleDelete(branch.id)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 transition">Yes</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition">No</button>
                        </>
                      ) : (
                        <>
                          {!isDefault && (
                            <button onClick={() => handleToggleActive(branch)} className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition" title={branch.isActive ? 'Deactivate' : 'Activate'}>
                              {branch.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                            </button>
                          )}
                          <button onClick={() => startEdit(branch)} className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          {!isDefault && (
                            <button onClick={() => setDeleteConfirmId(branch.id)} className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tip */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <strong>💡 Tip:</strong> After creating a branch, go to <strong>Settings → User Management</strong> to assign staff to it. Each user's branch is selected when you add or edit their account.
      </div>
    </div>
  );
}
