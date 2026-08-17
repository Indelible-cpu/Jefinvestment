import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Settings as SettingsIcon, User, Briefcase, Upload, Users, KeyRound, Trash2, Plus, Eye, EyeOff, ShieldCheck, Download, RefreshCw, AlertTriangle, Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import AuditLogs from '../components/AuditLogs';
import { clearEmbeddingCache } from '../hooks/useEmbeddingPrewarm';
import { Sparkles } from 'lucide-react';

export default function Settings() {
  const { 
    user, updateProfile, users, resetPassword, addUser, deleteUser, loadUsers, passwordRequests, approvePasswordRequest, rejectPasswordRequest
  } = useAuthStore();
  const settings = useSettingsStore();
  const { updateSettings } = settings;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  const [profileForm, setProfileForm] = useState({ name: user?.name || '', profilePic: user?.profilePic || '' });
  const [brandForm, setBrandForm] = useState({ 
    companyName: settings.companyName,
    currency: settings.currency || 'MWK',
    address: settings.address, 
    phone: settings.phone, 
    email: settings.email, 
    taxNumber: settings.taxNumber,
    airtelNumber: settings.airtelNumber || '',
    mpambaNumber: settings.mpambaNumber || '',
    nbsDetails: settings.nbsDetails || '',
    nbmDetails: settings.nbmDetails || ''
  });

  const [securityForm, setSecurityForm] = useState({
    autoLockEnabled: settings.autoLockEnabled || false,
    workTimeStart: settings.workTimeStart || '08:00',
    workTimeEnd: settings.workTimeEnd || '20:00',
    idleLockMinutes: settings.idleLockMinutes || 10
  });

  // User management state
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'CASHIER' as 'ADMIN' | 'CASHIER' | 'MANAGER' });
  const [showAddPw, setShowAddPw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Data Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOptions, setResetOptions] = useState({ sales: true, expenses: true, inventory: false, auditLogs: false });
  const [isResetting, setIsResetting] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(profileForm.name, profileForm.profilePic);
    showSuccess('Profile updated and synced to all devices!');
  };

  const handleSecuritySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(securityForm);
      showSuccess('Security settings saved!');
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Security settings saved locally and will sync when online.' });
      } else {
        toast.error('Failed to save security settings');
      }
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large', { description: 'Please choose an image under 5MB.' });
      return;
    }
    setUploadingPic(true);
    try {
      const userId = useAuthStore.getState().user?.id;
      const storageRef = ref(storage, `profile-pictures/${userId}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      // Save URL to Firestore immediately so it syncs across devices
      await useAuthStore.getState().updateProfile(
        profileForm.name,
        downloadURL
      );
      setProfileForm(f => ({ ...f, profilePic: downloadURL }));
      toast.success('Profile picture updated!', { description: 'Synced to all your devices.' });
    } catch (err: any) {
      toast.error('Upload failed', { description: err.message });
    } finally {
      setUploadingPic(false);
    }
  };

  const handleBrandSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(brandForm);
      showSuccess('Company branding & payment details saved!');
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') {
        toast.warning('Offline', { description: 'Settings saved locally and will sync when online.' });
      } else {
        toast.error('Failed to save settings', { description: err.message });
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await updateSettings({ companyLogo: reader.result as string });
          showSuccess('Company logo updated!');
        } catch (err: any) {
          if (err.message === 'OFFLINE_QUEUED') {
            toast.warning('Offline', { description: 'Logo saved locally and will sync when online.' });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    if (checkPasswordStrength(newPassword).score < 3) {
      toast.error('Password is too weak. Please use a stronger password.');
      return;
    }
    try {
      await resetPassword(resetTarget, newPassword.trim());
      setResetTarget(null);
      setNewPassword('');
      showSuccess('Password reset successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password.');
    }
  };

  const checkPasswordStrength = (pw: string) => {
    let score = 0;
    if (!pw) return { score, text: '', color: 'bg-gray-200' };
    if (pw.length > 5) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    
    if (pw.length < 6) return { score: 0, text: 'Too short (min 6 chars)', color: 'bg-red-500' };
    if (score <= 1) return { score, text: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score, text: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score, text: 'Good', color: 'bg-blue-500' };
    return { score, text: 'Strong', color: 'bg-green-500' };
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) return;
    if (checkPasswordStrength(newUserForm.password).score < 3) {
      toast.error('Password is too weak. Please use a stronger password.');
      return;
    }
    
    try {
      await addUser(newUserForm);
      const addedName = newUserForm.name;
      setNewUserForm({ name: '', email: '', password: '', role: 'CASHIER' });
      setShowAddUser(false);
      showSuccess(`User "${addedName}" added successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user. Please check the email and try again.');
    }
  };

  const handleDeleteUser = (userId: string, name: string) => {
    if (userId === user?.id) { toast.error('You cannot delete your own account.'); return; }
    toast(`Delete user "${name}"?`, {
      description: 'This cannot be undone.',
      action: { label: 'Delete', onClick: () => { deleteUser(userId); toast.success(`User "${name}" deleted.`); } },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleExportData = () => {
    try {
      const allData: Record<string, string | null> = {
        'jef-auth-storage': localStorage.getItem('jef-auth-storage'),
        'jef-data-storage': localStorage.getItem('jef-data-storage'),
        'jef-settings-storage': localStorage.getItem('jef-settings-storage')
      };
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StoreSight_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Backup exported successfully!');
    } catch (e) {
      toast.error('Failed to export data');
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data['jef-auth-storage']) localStorage.setItem('jef-auth-storage', data['jef-auth-storage']);
        if (data['jef-data-storage']) localStorage.setItem('jef-data-storage', data['jef-data-storage']);
        if (data['jef-settings-storage']) localStorage.setItem('jef-settings-storage', data['jef-settings-storage']);
        
        toast.success('Data imported successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = () => {
    setShowResetModal(true);
  };

  const executeReset = async () => {
    setIsResetting(true);
    try {
      const batchDelete = async (colName: string) => {
        const snap = await getDocs(collection(db, colName));
        const chunks = [];
        let i = 0;
        while (i < snap.docs.length) {
          chunks.push(snap.docs.slice(i, i + 500));
          i += 500;
        }
        for (const chunk of chunks) {
          const b = writeBatch(db);
          chunk.forEach(doc => b.delete(doc.ref));
          await b.commit();
        }
      };

      if (resetOptions.sales) await batchDelete('sales');
      if (resetOptions.expenses) await batchDelete('expenses');
      if (resetOptions.inventory) await batchDelete('products');
      if (resetOptions.auditLogs) await batchDelete('auditLogs');

      toast.success('Selected data has been reset successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset data');
      setIsResetting(false);
    }
  };

  const showSuccess = (msg: string) => toast.success(msg);



  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <SettingsIcon size={32} /> Settings
        </h1>
        <p className="text-gray-500 mt-1">Manage your profile, users, and company configuration.</p>
      </div>

      <div className="space-y-6">
        {/* Row 1: Profile + Branding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Profile */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex items-center gap-2">
              <User size={18} /> Personal Profile
            </div>
            <form onSubmit={handleProfileSave} className="p-6 space-y-4">
              <div className="flex items-center gap-6 pb-4 border-b mb-4">
                {profileForm.profilePic ? (
                  <img src={profileForm.profilePic} alt="Profile" className="w-16 h-16 object-cover rounded-full shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-1">Profile Picture</h3>
                  <label className={`text-sm bg-gray-100 border hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded flex items-center gap-1 transition w-max ${uploadingPic ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                    {uploadingPic ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingPic ? 'Uploading...' : 'Upload New'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} disabled={uploadingPic} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email (Login)</label>
                <input type="email" value={user?.email || ''} disabled className="w-full p-2.5 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">Contact an administrator to change your login email.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <input type="text" value={user?.role || ''} disabled className="w-full p-2.5 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition">Save Profile</button>
            </form>
          </div>

          {/* Company Branding */}
          {isAdmin ? (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex items-center gap-2">
                <Briefcase size={18} /> Company Branding & Tax
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-6 pb-4 border-b">
                  {settings.companyLogo ? (
                    <img src={settings.companyLogo} alt="Logo" className="w-20 h-20 object-cover rounded-full border-2 p-1 shadow-sm" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full border-2 border-dashed flex items-center justify-center text-gray-400 text-xs">No Logo</div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-1">Company Logo</h3>
                    <p className="text-xs text-gray-500 mb-2">Appears on login screen and receipts.</p>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm bg-gray-100 border hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded flex items-center gap-1 transition"><Upload size={14} /> Upload</button>
                      {settings.companyLogo && <button type="button" onClick={() => { updateSettings({ companyLogo: '' }); showSuccess('Logo removed!'); }} className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded transition">Remove</button>}
                    </div>
                  </div>
                </div>
                <form onSubmit={handleBrandSave} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">Company Name</label><input type="text" value={brandForm.companyName} onChange={e => setBrandForm(f => ({ ...f, companyName: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" required /></div>
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">Currency (e.g. MWK, USD)</label><input type="text" value={brandForm.currency} onChange={e => setBrandForm(f => ({ ...f, currency: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label><input type="text" value={brandForm.phone} onChange={e => setBrandForm(f => ({ ...f, phone: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">TPIN</label><input type="text" value={brandForm.taxNumber} onChange={e => setBrandForm(f => ({ ...f, taxNumber: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                  </div>
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Email</label><input type="email" value={brandForm.email} onChange={e => setBrandForm(f => ({ ...f, email: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                  <div><label className="block text-sm font-semibold text-gray-700 mb-1">Address</label><input type="text" value={brandForm.address} onChange={e => setBrandForm(f => ({ ...f, address: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                  <div className="pt-3 border-t">
                    <h4 className="font-bold text-sm text-gray-700 mb-3">Payment Details (MoMo & Bank)</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">Airtel Money Number</label><input type="text" value={brandForm.airtelNumber} onChange={e => setBrandForm(f => ({ ...f, airtelNumber: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. 0999000000" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">TNM Mpamba Number</label><input type="text" value={brandForm.mpambaNumber} onChange={e => setBrandForm(f => ({ ...f, mpambaNumber: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. 0888000000" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">NBS Bank Account</label><input type="text" value={brandForm.nbsDetails} onChange={e => setBrandForm(f => ({ ...f, nbsDetails: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Acc: 1234567" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">National Bank (NBM)</label><input type="text" value={brandForm.nbmDetails} onChange={e => setBrandForm(f => ({ ...f, nbmDetails: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Acc: 9876543" /></div>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <h4 className="font-bold text-sm text-gray-700 mb-3">Tax Settings</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">Tax Name</label><input type="text" value={settings.taxName} onChange={e => updateSettings({ taxName: e.target.value })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">Rate (%)</label><input type="number" step="0.1" value={settings.taxRate} onChange={e => updateSettings({ taxRate: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1">Type</label><select value={settings.taxType} onChange={e => updateSettings({ taxType: e.target.value as 'INCLUSIVE' | 'EXCLUSIVE' })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"><option value="EXCLUSIVE">Exclusive</option><option value="INCLUSIVE">Inclusive</option></select></div>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition">Save Settings</button>
                </form>
              </div>
            </div>
          ) : null}
        </div>

        {/* Password Change Requests (Admin only) */}
        {isAdmin && passwordRequests && passwordRequests.filter(r => r.status === 'PENDING').length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
            <div className="bg-amber-50 p-4 border-b border-amber-200 flex justify-between items-center">
              <div className="font-bold text-amber-800 flex items-center gap-2">
                <ShieldCheck size={18} className="text-amber-600" /> Pending Password Change Requests
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm bg-gray-50">
                    <th className="p-4 font-semibold text-gray-600">User Name</th>
                    <th className="p-4 font-semibold text-gray-600">Reason</th>
                    <th className="p-4 font-semibold text-gray-600">Requested</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {passwordRequests.filter(r => r.status === 'PENDING').map(req => (
                    <tr key={req.id} className="hover:bg-amber-50/50 transition">
                      <td className="p-4 font-medium">{req.userName}</td>
                      <td className="p-4 text-gray-600 text-sm">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border">
                          {req.reason}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-sm">
                        {new Date(req.requestedAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={async () => {
                              try {
                                await approvePasswordRequest(req.id);
                                toast.success(`Approved password change for ${req.userName}`);
                              } catch(e) {
                                toast.error('Failed to approve request');
                              }
                            }}
                            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded font-bold transition"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await rejectPasswordRequest(req.id);
                                toast.success(`Rejected password change for ${req.userName}`);
                              } catch(e) {
                                toast.error('Failed to reject request');
                              }
                            }}
                            className="flex items-center gap-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded font-bold transition"
                          >
                            <Trash2 size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Row 2: User Management (Admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
              <div className="font-bold text-gray-700 flex items-center gap-2"><Users size={18} /> User Management & Password Reset</div>
              <button onClick={() => setShowAddUser(true)} className="flex items-center gap-1.5 bg-primary text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium">
                <Plus size={16} /> Add User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm">
                    <th className="p-4 font-semibold text-gray-600">Full Name</th>
                    <th className="p-4 font-semibold text-gray-600">Email</th>
                    <th className="p-4 font-semibold text-gray-600">Role</th>
                    <th className="p-4 font-semibold text-gray-600">Status</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-medium">
                        {u.name}
                        {u.id === user?.id && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                      </td>
                      <td className="p-4 text-gray-500 text-sm">{u.email || '—'}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {Date.now() - (u.lastActiveAt || 0) < 3 * 60 * 1000 ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-full w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Offline
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setResetTarget(u.id); setNewPassword(''); setShowNewPw(false); }}
                            className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded font-medium transition"
                          >
                            <KeyRound size={14} /> Reset Password
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2 py-1.5 rounded font-medium transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Row 3: Data Management */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex items-center gap-2">
              <RefreshCw size={18} /> System Data & Backup
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-800 font-medium">
                  This system automatically syncs with the secure cloud for maximum reliability, while keeping offline copies for blazing fast performance. However, downloading manual backups is still highly recommended for your own business records.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Download className="text-blue-600" size={24} />
                  </div>
                  <h4 className="font-bold text-gray-700 mb-1">Export Backup</h4>
                  <p className="text-xs text-gray-500 mb-4">Download a full JSON backup of all sales, inventory, and settings.</p>
                  <button onClick={handleExportData} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition mt-auto">Download JSON</button>
                </div>

                <div className="border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <Upload className="text-green-600" size={24} />
                  </div>
                  <h4 className="font-bold text-gray-700 mb-1">Import Backup</h4>
                  <p className="text-xs text-gray-500 mb-4">Restore a previously downloaded JSON backup file.</p>
                  <label className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition cursor-pointer text-center mt-auto block">
                    Select File
                    <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                  </label>
                </div>

                <div className="border rounded-xl p-4 flex flex-col items-center justify-center text-center bg-purple-50/30">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                    <Sparkles className="text-purple-600" size={24} />
                  </div>
                  <h4 className="font-bold text-gray-700 mb-1">Clear AI Cache</h4>
                  <p className="text-xs text-gray-500 mb-4">Clear pre-computed AI image embeddings. Forces a full recompute on next page load.</p>
                  <button onClick={async () => { await clearEmbeddingCache(); toast.success('AI Image Cache cleared!'); }} className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition mt-auto">Clear AI Cache</button>
                </div>

                <div className="border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-red-50/30">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                  <h4 className="font-bold text-red-700 mb-1">Data Reset</h4>
                  <p className="text-xs text-gray-500 mb-4">Selectively wipe Sales, Expenses, Inventory, or Audit Logs. Irreversible.</p>
                  <button onClick={handleFactoryReset} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition mt-auto">Reset Data...</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security & Access Section */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex items-center gap-2">
            <Lock size={18} /> Security & Access Control
          </div>
          <form onSubmit={handleSecuritySave} className="p-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg mb-6">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">Automatic System Lock</h3>
                <p className="text-sm text-gray-600 mt-1">Lock the system outside of business hours. Admins can temporarily unlock it.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={securityForm.autoLockEnabled}
                  onChange={e => setSecurityForm(f => ({ ...f, autoLockEnabled: e.target.checked }))}
                />
                <div
                  style={{
                    width: 44, height: 24, borderRadius: 12, position: 'relative',
                    backgroundColor: securityForm.autoLockEnabled ? 'var(--color-primary, #2563eb)' : '#d1d5db',
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: securityForm.autoLockEnabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: 10, backgroundColor: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </label>
            </div>
            
            {securityForm.autoLockEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Work Start Time</label>
                  <input type="time" value={securityForm.workTimeStart} onChange={e => setSecurityForm(f => ({ ...f, workTimeStart: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Work End Time</label>
                  <input type="time" value={securityForm.workTimeEnd} onChange={e => setSecurityForm(f => ({ ...f, workTimeEnd: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Idle Lock (mins)</label>
                  <input type="number" min="1" max="60" value={securityForm.idleLockMinutes} onChange={e => setSecurityForm(f => ({ ...f, idleLockMinutes: parseInt(e.target.value) || 10 }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
            )}
            
            <button type="submit" className="w-full md:w-auto bg-primary text-white font-bold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition">Save Security Settings</button>
          </form>
        </div>
      )}
      
      {/* Audit Logs Section */}
      {isAdmin && <AuditLogs />}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-amber-100 p-2 rounded-full"><KeyRound size={20} className="text-amber-600" /></div>
              <div>
                <h2 className="font-bold text-gray-800">Reset Password</h2>
                <p className="text-sm text-gray-500">{users.find(u => u.id === resetTarget)?.name}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full p-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Enter new password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} className={`h-full flex-1 ${checkPasswordStrength(newPassword).score >= level ? checkPasswordStrength(newPassword).color : 'bg-transparent'}`} />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 font-medium text-right ${checkPasswordStrength(newPassword).color.replace('bg-', 'text-')}`}>
                    {checkPasswordStrength(newPassword).text}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setResetTarget(null)} className="flex-1 border py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={handleResetPassword} disabled={!newPassword.trim()} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                <ShieldCheck size={18} /> Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddUser(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-blue-100 p-2 rounded-full"><Users size={20} className="text-blue-600" /></div>
              <h2 className="font-bold text-gray-800 text-lg">Add New User</h2>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input type="text" required value={newUserForm.name} onChange={e => setNewUserForm(f => ({ ...f, name: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email (Login) *</label>
                <input type="email" required value={newUserForm.email} onChange={e => setNewUserForm(f => ({ ...f, email: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. jane@example.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <select value={newUserForm.role} onChange={e => setNewUserForm(f => ({ ...f, role: e.target.value as 'ADMIN' | 'CASHIER' | 'MANAGER' }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white">
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input type={showAddPw ? 'text' : 'password'} required value={newUserForm.password} onChange={e => setNewUserForm(f => ({ ...f, password: e.target.value }))} className="w-full p-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="Set initial password" />
                  <button type="button" onClick={() => setShowAddPw(!showAddPw)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showAddPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newUserForm.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level} className={`h-full flex-1 ${checkPasswordStrength(newUserForm.password).score >= level ? checkPasswordStrength(newUserForm.password).color : 'bg-transparent'}`} />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 font-medium text-right ${checkPasswordStrength(newUserForm.password).color.replace('bg-', 'text-')}`}>
                      {checkPasswordStrength(newUserForm.password).text}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 border py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-primary hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isResetting && setShowResetModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-red-100 p-2 rounded-full"><AlertTriangle size={20} className="text-red-600" /></div>
              <h2 className="font-bold text-gray-800 text-lg">Reset Data</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Select the data you want to permanently delete from the system:</p>
            
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border">
                <input type="checkbox" checked={resetOptions.sales} onChange={e => setResetOptions(o => ({...o, sales: e.target.checked}))} className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm text-gray-700">Sales Records</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border">
                <input type="checkbox" checked={resetOptions.expenses} onChange={e => setResetOptions(o => ({...o, expenses: e.target.checked}))} className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm text-gray-700">Expenses</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 border">
                <input type="checkbox" checked={resetOptions.auditLogs} onChange={e => setResetOptions(o => ({...o, auditLogs: e.target.checked}))} className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm text-gray-700">Audit Logs</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-red-50 border border-red-100 bg-red-50/30">
                <input type="checkbox" checked={resetOptions.inventory} onChange={e => setResetOptions(o => ({...o, inventory: e.target.checked}))} className="w-4 h-4 text-red-600" />
                <span className="font-medium text-sm text-red-700">Inventory & Products</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button type="button" disabled={isResetting} onClick={() => setShowResetModal(false)} className="flex-1 border py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isResetting || !Object.values(resetOptions).some(Boolean)} onClick={executeReset} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50">
                {isResetting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Reset Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
