import { useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSaleStore, useCreditStore, useEmployeeStore, useExpenseStore } from '../store/dataStore';
import { useProductStore } from '../store/cartStore';
import { useStationeryStore } from '../store/stationeryStore';
import { useAuditStore } from '../store/auditStore';
import { Settings as SettingsIcon, User, Briefcase, Upload, Users, KeyRound, Trash2, Plus, Eye, EyeOff, ShieldCheck, Download, RefreshCw, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, getDocs, writeBatch, addDoc } from 'firebase/firestore';
import AuditLogs from '../components/AuditLogs';

export default function Settings() {
  const { user, updateProfile, users, resetPassword, addUser, deleteUser } = useAuthStore();
  const settings = useSettingsStore();
  const { updateSettings } = settings;
  
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', username: user?.username || '', profilePic: user?.profilePic || '' });
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
  const [newUserForm, setNewUserForm] = useState({ name: '', username: '', password: '', role: 'CASHIER' as 'ADMIN' | 'CASHIER' });
  const [showAddPw, setShowAddPw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Change My Password State
  const [userPwForm, setUserPwForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showUserPw, setShowUserPw] = useState(false);
  const [isChangingUserPw, setIsChangingUserPw] = useState(false);

  // Selective Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    sales: true,
    inventory: true,
    expenses: true,
    stationery: true,
    credits: true,
    employees: false,
    auditLogs: false,
    settings: false,
    userSessions: false,
  });
  const [isWiping, setIsWiping] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(profileForm.name, profileForm.username, profileForm.profilePic);
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
        profileForm.username,
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

  const handleChangeUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userPwForm.newPassword !== userPwForm.confirmPassword) {
      toast.error('Passwords do not match', { description: 'New password and confirmation must match.' });
      return;
    }
    if (userPwForm.newPassword.length < 6) {
      toast.error('Password too short', { description: 'Password must be at least 6 characters.' });
      return;
    }

    setIsChangingUserPw(true);
    try {
      const { changePassword } = useAuthStore.getState();
      await changePassword(userPwForm.newPassword);
      setUserPwForm({ newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully!', {
        description: 'Your new password is now active. Admin has been notified of this action.'
      });
    } catch (err: any) {
      toast.error('Password update failed', { description: err.message || 'Please check your inputs.' });
    } finally {
      setIsChangingUserPw(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    try {
      await resetPassword(resetTarget, newPassword.trim());
      setResetTarget(null);
      setNewPassword('');
      showSuccess('Password reset successfully!');
    } catch (err: any) {
      toast.error('Password reset failed', { description: err.message });
    }
  };

  const handleToggleAllReset = (enable: boolean) => {
    setResetOptions({
      sales: enable,
      inventory: enable,
      expenses: enable,
      stationery: enable,
      credits: enable,
      employees: enable,
      auditLogs: enable,
      settings: enable,
      userSessions: enable,
    });
  };

  const handleExecuteSelectiveReset = async () => {
    const selectedKeys = Object.entries(resetOptions).filter(([_, val]) => val).map(([k]) => k);
    if (selectedKeys.length === 0) {
      toast.error('Please select at least one item to reset.');
      return;
    }

    setIsWiping(true);
    try {
      const clearCollection = async (collName: string) => {
        try {
          const q = query(collection(db, collName));
          const snapshot = await getDocs(q);
          if (snapshot.empty) return;
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 400);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (err) {
          console.warn(`Could not clear Firestore collection ${collName}`, err);
        }
      };

      if (resetOptions.sales) {
        await clearCollection('sales');
        useSaleStore.setState({ sales: [] });
      }
      if (resetOptions.credits) {
        await clearCollection('credits');
        useCreditStore.setState({ credits: [] });
      }
      if (resetOptions.inventory) {
        await clearCollection('products');
        useProductStore.setState({ products: [] });
      }
      if (resetOptions.expenses) {
        await clearCollection('expenses');
        useExpenseStore.setState({ expenses: [] });
      }
      if (resetOptions.stationery) {
        await clearCollection('stationeryServices');
        useStationeryStore.setState({ stationeryServices: [] });
      }
      if (resetOptions.employees) {
        await clearCollection('employees');
        useEmployeeStore.setState({ employees: [] });
      }
      if (resetOptions.auditLogs) {
        await clearCollection('auditLogs');
        useAuditStore.setState({ logs: [] });
      }
      if (resetOptions.settings) {
        await clearCollection('settings');
        localStorage.removeItem('jef-settings-storage');
      }
      if (resetOptions.userSessions) {
        localStorage.removeItem('jef-auth-storage');
        localStorage.removeItem('jef-data-storage');
      }

      if (!resetOptions.auditLogs) {
        try {
          await addDoc(collection(db, 'auditLogs'), {
            action: 'SELECTIVE_RESET',
            details: `Selective Factory Reset executed by Admin "${user?.name}". Cleared categories: ${selectedKeys.join(', ')}.`,
            user: user?.name || 'Admin',
            timestamp: Date.now()
          });
        } catch (e) {
          // ignore
        }
      }

      toast.success('Selective reset complete!', {
        description: `Reset categories: ${selectedKeys.join(', ')}`
      });
      setShowResetModal(false);

      if (resetOptions.userSessions) {
        setTimeout(() => { window.location.href = '/login'; }, 1000);
      }
    } catch (err: any) {
      toast.error('Selective reset failed', { description: err.message });
    } finally {
      setIsWiping(false);
    }
  };

  const showSuccess = (msg: string) => toast.success(msg);

  const isAdmin = user?.role === 'ADMIN';

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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                <input type="text" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <input type="text" value={user?.role || ''} disabled className="w-full p-2.5 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
              </div>
              <button type="submit" className="w-full bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition">Save Profile</button>
            </form>

            {/* Change My Password Section for logged in user */}
            <div className="p-6 border-t bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <KeyRound size={16} className="text-primary" /> Change My Password
              </h3>
              <form onSubmit={handleChangeUserPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">New Password *</label>
                  <div className="relative">
                    <input
                      type={showUserPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={userPwForm.newPassword}
                      onChange={e => setUserPwForm(f => ({ ...f, newPassword: e.target.value }))}
                      className="w-full p-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white text-sm"
                      placeholder="At least 6 characters"
                    />
                    <button type="button" onClick={() => setShowUserPw(!showUserPw)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showUserPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password *</label>
                  <input
                    type={showUserPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={userPwForm.confirmPassword}
                    onChange={e => setUserPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white text-sm"
                    placeholder="Re-enter new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isChangingUserPw}
                  className="w-full py-2 bg-gray-800 text-white font-semibold text-sm rounded-lg hover:bg-gray-900 transition flex items-center justify-center gap-2"
                >
                  {isChangingUserPw ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Update My Password
                </button>
              </form>
            </div>
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
          ) : (
            <div className="bg-gray-50 rounded-xl shadow-sm border p-6 flex flex-col items-center justify-center text-center text-gray-500">
              <Briefcase size={48} className="mb-4 text-gray-300" />
              <h3 className="font-bold text-gray-700 mb-1">Admin Access Required</h3>
              <p className="text-sm">Only administrators can modify company branding and settings.</p>
            </div>
          )}
        </div>

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
                    <th className="p-4 font-semibold text-gray-600">Name</th>
                    <th className="p-4 font-semibold text-gray-600">Username</th>
                    <th className="p-4 font-semibold text-gray-600">Role</th>
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
                      <td className="p-4 text-gray-600 font-mono text-sm">{u.username}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {u.role}
                        </span>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Download className="text-blue-600" size={24} />
                  </div>
                  <h4 className="font-bold text-gray-700 mb-1">Export Backup</h4>
                  <p className="text-xs text-gray-500 mb-4">Download a full JSON backup of all sales, inventory, and settings.</p>
                  <button onClick={handleExportData} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">Download JSON</button>
                </div>

                <div className="border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <Upload className="text-green-600" size={24} />
                  </div>
                  <h4 className="font-bold text-gray-700 mb-1">Import Backup</h4>
                  <p className="text-xs text-gray-500 mb-4">Restore a previously downloaded JSON backup file.</p>
                  <label className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition cursor-pointer text-center">
                    Select File
                    <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                  </label>
                </div>

                <div className="border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-red-50/30">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                  <h4 className="font-bold text-red-700 mb-1">Factory Reset</h4>
                  <p className="text-xs text-gray-500 mb-4">Selectively wipe specific system data or perform a full system reset.</p>
                  <button onClick={() => setShowResetModal(true)} className="w-full py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition">Configure & Wipe Data</button>
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

      {/* Selective Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto border border-red-100">
            <div className="flex items-center gap-3 pb-3 border-b mb-4 text-red-600">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 leading-tight">Selective Factory Reset</h3>
                <p className="text-xs text-gray-500">Choose specifically what data you want to permanently wipe.</p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select Categories to Wipe</span>
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleToggleAllReset(true)}
                  className="text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleAllReset(false)}
                  className="text-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-6 max-h-[45vh] overflow-y-auto pr-1">
              {[
                { key: 'sales', label: 'Sales & Credit History', desc: 'All transactions, receipts, and customer debt records' },
                { key: 'inventory', label: 'Product Inventory', desc: 'All inventory products, stock levels, and cost prices' },
                { key: 'expenses', label: 'Expense Records', desc: 'All logged business operational expenses' },
                { key: 'stationery', label: 'Stationery Services', desc: 'Stationery service items and paper sheet mappings' },
                { key: 'employees', label: 'Employee Directory', desc: 'Registered staff records' },
                { key: 'auditLogs', label: 'Audit Logs', desc: 'System activity logs and administrative audit entries' },
                { key: 'settings', label: 'App Settings & Branding', desc: 'Company details, receipt config, and lock security options' },
                { key: 'userSessions', label: 'User Auth & Local Cache', desc: 'Log out current session and wipe offline browser cache' },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    resetOptions[opt.key as keyof typeof resetOptions]
                      ? 'bg-red-50/50 border-red-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={resetOptions[opt.key as keyof typeof resetOptions]}
                    onChange={e => setResetOptions(o => ({ ...o, [opt.key]: e.target.checked }))}
                    className="mt-1 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-800 font-medium">
              ⚠️ Warning: Wiping data cannot be undone. Only checked categories will be deleted.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isWiping}
                className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSelectiveReset}
                disabled={isWiping}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                {isWiping ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirm Selective Reset
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username *</label>
                <input type="text" required value={newUserForm.username} onChange={e => setNewUserForm(f => ({ ...f, username: e.target.value }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. jane" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <select value={newUserForm.role} onChange={e => setNewUserForm(f => ({ ...f, role: e.target.value as 'ADMIN' | 'CASHIER' }))} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white">
                  <option value="CASHIER">Cashier</option>
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
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 border py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-primary hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
