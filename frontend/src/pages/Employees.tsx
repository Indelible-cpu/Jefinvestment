import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, UserPlus, CheckCircle, Clock, Banknote, RotateCcw, PlusCircle,
  Trash2, Edit, Camera, Upload, Eye, X, Phone, Mail, MapPin,
  Calendar, ShieldCheck, HeartHandshake, FileText, Search, ZoomIn,
  AlertCircle, Image as ImageIcon
} from 'lucide-react';
import { useEmployeeStore, type Employee } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { storage } from '../lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import CameraCaptureModal from '../components/CameraCaptureModal';
import { toast } from 'sonner';

export default function Employees() {
  const {
    employees, isLoading, loadEmployees, addEmployee, updateEmployee,
    updateStatus, recordAdvancePay, recordSalaryPay, clearAdvancePay,
    deleteEmployee, getTotalAdvancePay
  } = useEmployeeStore();
  const settings = useSettingsStore();

  useEffect(() => {
    loadEmployees();
  }, []);

  // Filter / Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LEAVE'>('ALL');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'identity' | 'kin'>('basic');
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Cashier');
  const [newSalary, setNewSalary] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDateOfBirth, setNewDateOfBirth] = useState('');
  const [newDateJoined, setNewDateJoined] = useState(new Date().toISOString().slice(0, 10));

  // Identification & Photos
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [idCardPreview, setIdCardPreview] = useState<string>('');
  const [newIdNumber, setNewIdNumber] = useState('');

  // Next of Kin
  const [newNextOfKinName, setNewNextOfKinName] = useState('');
  const [newNextOfKinRelationship, setNewNextOfKinRelationship] = useState('Spouse');
  const [newNextOfKinPhone, setNewNextOfKinPhone] = useState('');
  const [newNextOfKinAddress, setNewNextOfKinAddress] = useState('');

  // Camera Capture Modal state
  const [cameraModalConfig, setCameraModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    mode: 'portrait' | 'document';
    target: 'photo' | 'idCard';
  }>({
    isOpen: false,
    title: '',
    mode: 'portrait',
    target: 'photo',
  });

  // Full Employee Dossier Modal
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Zoom ID Card modal
  const [zoomedIdImageUrl, setZoomedIdImageUrl] = useState<string | null>(null);

  // Advance Pay Modal state
  const [selectedEmpForAdvance, setSelectedEmpForAdvance] = useState<Employee | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);

  // Salary Pay Modal state
  const [selectedEmpForSalary, setSelectedEmpForSalary] = useState<Employee | null>(null);
  const [salaryNotes, setSalaryNotes] = useState('');
  const [isSubmittingSalary, setIsSubmittingSalary] = useState(false);

  // Hidden file inputs
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const idCardFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;
      const search = searchTerm.toLowerCase().trim();
      if (!search) return matchesStatus;

      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();
      const idNum = (emp.idNumber || '').toLowerCase();
      const kinName = (emp.nextOfKinName || '').toLowerCase();

      const matchesSearch = fullName.includes(search) ||
        phone.includes(search) ||
        role.includes(search) ||
        idNum.includes(search) ||
        kinName.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [employees, searchTerm, statusFilter]);

  const openAddModal = () => {
    setEditingEmpId(null);
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setNewRole('Cashier');
    setNewSalary('');
    setNewAddress('');
    setNewDateOfBirth('');
    setNewDateJoined(new Date().toISOString().slice(0, 10));
    setPhotoPreview('');
    setIdCardPreview('');
    setNewIdNumber('');
    setNewNextOfKinName('');
    setNewNextOfKinRelationship('Spouse');
    setNewNextOfKinPhone('');
    setNewNextOfKinAddress('');
    setActiveFormTab('basic');
    setShowAddModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setNewFirstName(emp.firstName || '');
    setNewLastName(emp.lastName || '');
    setNewPhone(emp.phone || '');
    setNewEmail(emp.email || '');
    setNewRole(emp.role || 'Cashier');
    setNewSalary(emp.salary ? emp.salary.toString() : '');
    setNewAddress(emp.address || '');
    setNewDateOfBirth(emp.dateOfBirth || '');
    setNewDateJoined(emp.dateJoined || '');
    setPhotoPreview(emp.photoUrl || '');
    setIdCardPreview(emp.idCardUrl || '');
    setNewIdNumber(emp.idNumber || '');
    setNewNextOfKinName(emp.nextOfKinName || '');
    setNewNextOfKinRelationship(emp.nextOfKinRelationship || 'Spouse');
    setNewNextOfKinPhone(emp.nextOfKinPhone || '');
    setNewNextOfKinAddress(emp.nextOfKinAddress || '');
    setActiveFormTab('basic');
    setShowAddModal(true);
  };

  // Image compression helper (keeps Firestore documents ultralight ~30-60KB)
  const compressImage = (dataUrl: string, maxDimension: number = 800, quality: number = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Helper for image upload to Firebase Storage with Firestore fallback
  const uploadImageIfDataUrl = async (dataUrl: string, path: string, isDoc: boolean = false): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return dataUrl; // Already a remote URL or empty
    }
    const compressed = await compressImage(dataUrl, isDoc ? 900 : 500, 0.72);
    try {
      const storageRef = ref(storage, path);
      await uploadString(storageRef, compressed, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch {
      // If Firebase Storage is not enabled (e.g. on Spark free plan),
      // seamlessly save the lightweight compressed image directly in Firestore!
      return compressed;
    }
  };

  // Handle local file picking for Photo & ID card
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'idCard') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      toast.error('File too large', { description: 'Please choose an image under 12MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const compressed = await compressImage(reader.result, target === 'photo' ? 500 : 900, 0.75);
        if (target === 'photo') {
          setPhotoPreview(compressed);
        } else {
          setIdCardPreview(compressed);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleOpenLiveCamera = (target: 'photo' | 'idCard') => {
    setCameraModalConfig({
      isOpen: true,
      title: target === 'photo' ? 'Take Employee Portrait' : 'Take ID Card / Document Photo',
      mode: target === 'photo' ? 'portrait' : 'document',
      target,
    });
  };

  const handleCameraCapture = (imageDataUrl: string) => {
    if (cameraModalConfig.target === 'photo') {
      setPhotoPreview(imageDataUrl);
      toast.success('Portrait photo captured!');
    } else {
      setIdCardPreview(imageDataUrl);
      toast.success('ID document photo captured!');
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) {
      toast.error('Please provide both first name and last name.');
      setActiveFormTab('basic');
      return;
    }

    setIsSubmitting(true);
    try {
      const tempId = editingEmpId || `emp_${Date.now()}`;

      // Upload photos if newly captured/picked
      const finalPhotoUrl = await uploadImageIfDataUrl(photoPreview, `employee-photos/${tempId}_photo`, false);
      const finalIdCardUrl = await uploadImageIfDataUrl(idCardPreview, `employee-ids/${tempId}_idcard`, true);

      const employeePayload = {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        role: newRole,
        salary: Number(newSalary) || 0,
        address: newAddress.trim(),
        dateOfBirth: newDateOfBirth,
        dateJoined: newDateJoined,
        photoUrl: finalPhotoUrl,
        idCardUrl: finalIdCardUrl,
        idNumber: newIdNumber.trim(),
        nextOfKinName: newNextOfKinName.trim(),
        nextOfKinRelationship: newNextOfKinRelationship,
        nextOfKinPhone: newNextOfKinPhone.trim(),
        nextOfKinAddress: newNextOfKinAddress.trim(),
      };

      if (editingEmpId) {
        await updateEmployee(editingEmpId, employeePayload);
        toast.success(`Employee ${newFirstName} updated successfully.`);
      } else {
        await addEmployee({
          ...employeePayload,
          status: 'PRESENT',
          advancePay: 0,
        });
        toast.success(`Employee ${newFirstName} ${newLastName} added successfully.`);
      }

      setShowAddModal(false);
      setEditingEmpId(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save employee', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (id: string, current: string) => {
    const next = current === 'PRESENT' ? 'ABSENT' : current === 'ABSENT' ? 'LEAVE' : 'PRESENT';
    updateStatus(id, next);
    toast.info(`Attendance status updated to ${next}`);
  };

  const handleRecordAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForAdvance || !advanceAmount || Number(advanceAmount) <= 0) {
      toast.error('Please enter a valid advance pay amount.');
      return;
    }

    setIsSubmittingAdvance(true);
    try {
      await recordAdvancePay(selectedEmpForAdvance.id, Number(advanceAmount), advanceNotes);
      toast.success(`Advance pay of ${settings.currency} ${Number(advanceAmount).toLocaleString()} recorded for ${selectedEmpForAdvance.firstName}!`, {
        description: 'Logged to expenses automatically.'
      });
      setSelectedEmpForAdvance(null);
      setAdvanceAmount('');
      setAdvanceNotes('');
    } catch (err: any) {
      toast.error('Failed to record advance pay', { description: err.message });
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const handleRecordSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForSalary) return;

    const netAmount = selectedEmpForSalary.salary - (selectedEmpForSalary.advancePay || 0);

    setIsSubmittingSalary(true);
    try {
      await recordSalaryPay(selectedEmpForSalary.id, netAmount, salaryNotes);
      toast.success(`Salary payment of ${settings.currency} ${netAmount.toLocaleString()} recorded for ${selectedEmpForSalary.firstName}!`, {
        description: 'Logged to expenses automatically.'
      });
      setSelectedEmpForSalary(null);
      setSalaryNotes('');
    } catch (err: any) {
      toast.error('Failed to record salary', { description: err.message });
    } finally {
      setIsSubmittingSalary(false);
    }
  };

  const handleClearAdvance = async (emp: Employee) => {
    if (!emp.advancePay || emp.advancePay <= 0) return;
    toast(`Reset advance pay balance (${settings.currency} ${emp.advancePay.toLocaleString()}) for ${emp.firstName}?`, {
      action: {
        label: 'Confirm Reset',
        onClick: async () => {
          await clearAdvancePay(emp.id);
          toast.success(`Advance pay balance cleared for ${emp.firstName}.`);
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  const handleDelete = (emp: Employee) => {
    toast(`Remove employee "${emp.firstName} ${emp.lastName}"?`, {
      action: {
        label: 'Remove',
        onClick: () => {
          deleteEmployee(emp.id);
          toast.success(`Employee "${emp.firstName} ${emp.lastName}" removed.`);
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    });
  };

  return (
    <div className="p-1.5 sm:p-3 md:p-8 bg-background min-h-full pb-24">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={photoFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={e => handleFileSelect(e, 'photo')}
      />
      <input
        type="file"
        ref={idCardFileInputRef}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => handleFileSelect(e, 'idCard')}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Employee &amp; HR Management</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Staff directory, photo verification, ID records, Next of Kin, attendance &amp; payroll.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-semibold hover:bg-blue-700 flex items-center gap-2 transition shadow-sm sm:shadow-md self-start text-xs sm:text-sm"
        >
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-card p-4 md:p-5 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-primary rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Staff</span>
            <h3 className="text-2xl font-bold mt-0.5">{employees.length}</h3>
          </div>
        </div>

        <div className="bg-card p-4 md:p-5 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-xl">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Present Today</span>
            <h3 className="text-2xl font-bold text-green-700 mt-0.5">{employees.filter(e => e.status === 'PRESENT').length}</h3>
          </div>
        </div>

        <div className="bg-card p-4 md:p-5 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-100 text-yellow-700 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">On Leave / Absent</span>
            <h3 className="text-2xl font-bold text-yellow-700 mt-0.5">{employees.filter(e => e.status !== 'PRESENT').length}</h3>
          </div>
        </div>

        <div className="bg-card p-4 md:p-5 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
            <Banknote size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Advances</span>
            <h3 className="text-2xl font-bold font-mono text-amber-900 mt-0.5">
              {settings.currency} {getTotalAdvancePay().toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card rounded-2xl border p-3 mb-6 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name, phone, role, ID number, or next of kin..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border self-start sm:self-auto">
          {(['ALL', 'PRESENT', 'ABSENT', 'LEAVE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === tab
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-muted'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'PRESENT' ? 'Present' : tab === 'ABSENT' ? 'Absent' : 'On Leave'}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-card rounded-2xl border p-12 text-center text-gray-500">
            <div className="flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-600">Loading staff records...</p>
            </div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-card rounded-2xl border p-12 text-center text-gray-500">
            <Users size={40} className="mx-auto mb-3 text-gray-400 opacity-60" />
            <h3 className="font-bold text-gray-700 text-base">No matching staff found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {employees.length === 0
                ? 'Click "Add Employee" to register your first team member.'
                : 'Try adjusting your search terms or filter.'}
            </p>
          </div>
        ) : (
          filteredEmployees.map(emp => (
            <div
              key={emp.id}
              className="bg-card rounded-2xl border shadow-sm p-4 hover:border-primary/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Employee Avatar & Basic Information */}
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                {/* Photo / Avatar */}
                <div
                  onClick={() => setViewingEmployee(emp)}
                  className="relative cursor-pointer group flex-shrink-0"
                  title="Click to view full dossier"
                >
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={`${emp.firstName} ${emp.lastName}`}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-primary/20 group-hover:border-primary transition shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition">
                      {emp.firstName?.[0]?.toUpperCase()}{emp.lastName?.[0]?.toUpperCase()}
                    </div>
                  )}
                  {emp.idCardUrl && (
                    <span
                      title="ID Document on file"
                      className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full border-2 border-white shadow-xs"
                    >
                      <ShieldCheck size={10} />
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setViewingEmployee(emp)}
                      className="font-bold text-base text-foreground hover:text-primary transition text-left"
                    >
                      {emp.firstName} {emp.lastName}
                    </button>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      emp.status === 'PRESENT' ? 'bg-green-100 text-green-800 border border-green-200' :
                      emp.status === 'ABSENT' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                    }`}>
                      {emp.status}
                    </span>
                    {emp.idNumber && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-md font-mono text-gray-600 border">
                        ID: {emp.idNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-primary">{emp.role}</span>
                    {emp.phone && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Phone size={12} className="text-gray-400" /> {emp.phone}
                      </span>
                    )}
                    {emp.nextOfKinName && (
                      <span className="flex items-center gap-1 text-gray-600" title={`Next of Kin: ${emp.nextOfKinName} (${emp.nextOfKinRelationship || 'Kin'})`}>
                        <HeartHandshake size={12} className="text-rose-500" /> Kin: {emp.nextOfKinName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                    <span className="font-mono font-semibold text-gray-800">
                      Salary: {settings.currency} {emp.salary.toLocaleString()}
                    </span>
                    {(emp.advancePay || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold">
                        <Banknote size={12} /> Advance: {settings.currency} {emp.advancePay?.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400">No advance</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-3 md:pt-0">
                <button
                  onClick={() => setViewingEmployee(emp)}
                  className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-xl font-semibold transition border shadow-xs"
                  title="View Full Profile Dossier"
                >
                  <Eye size={14} className="text-primary" /> Profile
                </button>
                <button
                  onClick={() => setSelectedEmpForSalary(emp)}
                  className="flex items-center gap-1 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-xl font-semibold transition shadow-sm"
                  title="Pay Full Salary"
                >
                  <Banknote size={14} /> Pay Salary
                </button>
                <button
                  onClick={() => setSelectedEmpForAdvance(emp)}
                  className="flex items-center gap-1 text-xs bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-xl font-semibold transition shadow-sm"
                  title="Record Advance Pay"
                >
                  <PlusCircle size={14} /> Pay Advance
                </button>
                {(emp.advancePay || 0) > 0 && (
                  <button
                    onClick={() => handleClearAdvance(emp)}
                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border hover:bg-gray-200 px-2.5 py-1.5 rounded-xl font-medium transition"
                    title="Clear Advance Balance"
                  >
                    <RotateCcw size={13} /> Clear
                  </button>
                )}
                <button
                  onClick={() => handleToggleStatus(emp.id, emp.status)}
                  className="text-xs bg-gray-100 border hover:bg-gray-200 px-2.5 py-1.5 rounded-xl font-medium transition"
                  title="Cycle attendance status"
                >
                  Toggle
                </button>
                <button
                  onClick={() => openEditModal(emp)}
                  className="text-xs text-blue-600 hover:bg-blue-50 p-2 rounded-xl border border-transparent hover:border-blue-200 transition"
                  title="Edit Employee"
                >
                  <Edit size={15} />
                </button>
                <button
                  onClick={() => handleDelete(emp)}
                  className="text-xs text-red-600 hover:bg-red-50 p-2 rounded-xl border border-transparent hover:border-red-200 transition"
                  title="Delete Employee"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-muted/40 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingEmpId ? 'Edit Employee Record' : 'Register New Employee'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete staff profile with photos, identification, and emergency particulars.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-muted transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b bg-muted/20 px-6">
              <button
                type="button"
                onClick={() => setActiveFormTab('basic')}
                className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
                  activeFormTab === 'basic'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users size={16} /> 1. Employment &amp; Contact
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('identity')}
                className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
                  activeFormTab === 'identity'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Camera size={16} /> 2. Photos &amp; ID Document
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('kin')}
                className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
                  activeFormTab === 'kin'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <HeartHandshake size={16} /> 3. Next of Kin &amp; Address
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveEmployee} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB 1: Basic & Employment */}
              {activeFormTab === 'basic' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">First Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newFirstName}
                        onChange={e => setNewFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Last Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Banda"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newLastName}
                        onChange={e => setNewLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Phone Number *</label>
                      <input
                        type="tel"
                        placeholder="e.g. +265 999 123 456"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Email Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input
                        type="email"
                        placeholder="e.g. john@storesight.mw"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Job Role / Designation</label>
                      <select
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                      >
                        <option value="Cashier">Cashier</option>
                        <option value="Sales Representative">Sales Representative</option>
                        <option value="Technician">Technician</option>
                        <option value="Print Shop Operator">Print Shop Operator</option>
                        <option value="Store Manager">Store Manager</option>
                        <option value="Inventory Officer">Inventory Officer</option>
                        <option value="Security Guard">Security Guard</option>
                        <option value="Accountant">Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">
                        Monthly Salary ({settings.currency})
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 150000"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono text-sm bg-background"
                        value={newSalary}
                        onChange={e => setNewSalary(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Date of Joining</label>
                      <input
                        type="date"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newDateJoined}
                        onChange={e => setNewDateJoined(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Date of Birth</label>
                      <input
                        type="date"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newDateOfBirth}
                        onChange={e => setNewDateOfBirth(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Photo & Identification */}
              {activeFormTab === 'identity' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* National ID / Passport Number */}
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700">
                      National ID / Passport / Voter ID Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MW-NIN-99482710 or Passport No."
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono text-sm bg-background uppercase"
                      value={newIdNumber}
                      onChange={e => setNewIdNumber(e.target.value)}
                    />
                  </div>

                  {/* Photo & ID Card Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Employee Portrait Photo */}
                    <div className="border rounded-2xl p-4 bg-muted/20 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <Users size={14} className="text-primary" /> Employee Portrait
                          </span>
                          {photoPreview && (
                            <button
                              type="button"
                              onClick={() => setPhotoPreview('')}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="w-full h-40 bg-background border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center mb-3 relative">
                          {photoPreview ? (
                            <img
                              src={photoPreview}
                              alt="Portrait Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-3 text-gray-400">
                              <ImageIcon size={32} className="mx-auto mb-1 opacity-50" />
                              <span className="text-xs">No photo selected</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLiveCamera('photo')}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                        >
                          <Camera size={15} /> Take Live Pic
                        </button>
                        <button
                          type="button"
                          onClick={() => photoFileInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-card border hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition"
                        >
                          <Upload size={15} /> Upload File
                        </button>
                      </div>
                    </div>

                    {/* Employee ID Card Document */}
                    <div className="border rounded-2xl p-4 bg-muted/20 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-600" /> ID Card / Document Scan
                          </span>
                          {idCardPreview && (
                            <button
                              type="button"
                              onClick={() => setIdCardPreview('')}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="w-full h-40 bg-background border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center mb-3 relative">
                          {idCardPreview ? (
                            <img
                              src={idCardPreview}
                              alt="ID Document Preview"
                              className="w-full h-full object-contain bg-black/5"
                            />
                          ) : (
                            <div className="text-center p-3 text-gray-400">
                              <FileText size={32} className="mx-auto mb-1 opacity-50" />
                              <span className="text-xs">No ID card scan selected</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLiveCamera('idCard')}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                        >
                          <Camera size={15} /> Take ID Pic
                        </button>
                        <button
                          type="button"
                          onClick={() => idCardFileInputRef.current?.click()}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-card border hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition"
                        >
                          <Upload size={15} /> Upload File
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Next of Kin & Address */}
              {activeFormTab === 'kin' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                    <HeartHandshake size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Next of Kin / Emergency Contact:</strong> In case of workplace emergencies, illness, or critical notices, this contact will be notified immediately.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Next of Kin Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Mary Banda"
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newNextOfKinName}
                        onChange={e => setNewNextOfKinName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-gray-700">Relationship</label>
                      <select
                        className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                        value={newNextOfKinRelationship}
                        onChange={e => setNewNextOfKinRelationship(e.target.value)}
                      >
                        <option value="Spouse">Spouse (Husband / Wife)</option>
                        <option value="Parent">Parent (Father / Mother)</option>
                        <option value="Sibling">Sibling (Brother / Sister)</option>
                        <option value="Child">Son / Daughter</option>
                        <option value="Guardian">Legal Guardian</option>
                        <option value="Relative">Relative / Cousin</option>
                        <option value="Friend">Friend / Colleague</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700">Next of Kin Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +265 888 765 432"
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                      value={newNextOfKinPhone}
                      onChange={e => setNewNextOfKinPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700">
                      Next of Kin Address / Special Notes <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Area 25, Sector 4, Lilongwe"
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                      value={newNextOfKinAddress}
                      onChange={e => setNewNextOfKinAddress(e.target.value)}
                    />
                  </div>

                  <div className="pt-2 border-t">
                    <label className="block text-xs font-semibold mb-1 text-gray-700">
                      Employee Residential Address <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Plot 12, Area 47 Sector 3, Lilongwe"
                      className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-background"
                      value={newAddress}
                      onChange={e => setNewAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div>
                  {activeFormTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => setActiveFormTab(activeFormTab === 'kin' ? 'identity' : 'basic')}
                      className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-muted transition"
                    >
                      ← Back
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeFormTab !== 'kin' ? (
                    <button
                      type="button"
                      onClick={() => setActiveFormTab(activeFormTab === 'basic' ? 'identity' : 'kin')}
                      className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
                    >
                      Next Step →
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>Saving...</>
                    ) : editingEmpId ? (
                      <>Save Changes</>
                    ) : (
                      <>Register Employee</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Employee Profile / Dossier Modal */}
      {viewingEmployee && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50"
          onClick={() => setViewingEmployee(null)}
        >
          <div
            className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden max-h-[92vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header banner */}
            <div className="relative bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6">
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {viewingEmployee.photoUrl ? (
                  <img
                    src={viewingEmployee.photoUrl}
                    alt={viewingEmployee.firstName}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white/20 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/20 flex items-center justify-center text-2xl font-black">
                    {viewingEmployee.firstName?.[0]}{viewingEmployee.lastName?.[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold">{viewingEmployee.firstName} {viewingEmployee.lastName}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                      {viewingEmployee.status}
                    </span>
                  </div>
                  <p className="text-blue-100 font-medium text-sm mt-0.5">{viewingEmployee.role}</p>
                  {viewingEmployee.idNumber && (
                    <p className="text-xs font-mono text-blue-200 mt-1">National ID: {viewingEmployee.idNumber}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Dossier Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Financial / Compensation Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-muted/40 border rounded-xl p-3">
                  <span className="text-xs text-gray-500 font-medium">Monthly Salary</span>
                  <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                    {settings.currency} {viewingEmployee.salary.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/40 border rounded-xl p-3">
                  <span className="text-xs text-gray-500 font-medium">Advance Balance</span>
                  <p className={`text-base font-bold font-mono mt-0.5 ${(viewingEmployee.advancePay || 0) > 0 ? 'text-amber-800 font-black' : 'text-gray-900'}`}>
                    {settings.currency} {(viewingEmployee.advancePay || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/40 border rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-xs text-gray-500 font-medium">Net Due This Month</span>
                  <p className="text-base font-bold font-mono text-emerald-800 mt-0.5">
                    {settings.currency} {(viewingEmployee.salary - (viewingEmployee.advancePay || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Contact & Personal Details */}
              <div className="bg-card border rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Users size={14} className="text-primary" /> Contact &amp; Particulars
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone size={15} className="text-gray-400" />
                    <span className="text-gray-600">Phone:</span>
                    {viewingEmployee.phone ? (
                      <a href={`tel:${viewingEmployee.phone}`} className="font-semibold text-primary hover:underline">
                        {viewingEmployee.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-gray-400" />
                    <span className="text-gray-600">Email:</span>
                    {viewingEmployee.email ? (
                      <a href={`mailto:${viewingEmployee.email}`} className="font-semibold text-primary hover:underline">
                        {viewingEmployee.email}
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-gray-400" />
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium text-gray-900">{viewingEmployee.address || 'Not set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-gray-400" />
                    <span className="text-gray-600">Date Joined:</span>
                    <span className="font-medium text-gray-900">{viewingEmployee.dateJoined || 'Not set'}</span>
                  </div>
                </div>
              </div>

              {/* Next of Kin Card */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <HeartHandshake size={15} className="text-rose-600" /> Next of Kin (Emergency Contact)
                </h4>
                {viewingEmployee.nextOfKinName ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs block">Contact Name</span>
                      <span className="font-bold text-gray-900">{viewingEmployee.nextOfKinName}</span>
                      <span className="text-xs text-rose-700 font-semibold ml-2">({viewingEmployee.nextOfKinRelationship || 'Kin'})</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Emergency Phone</span>
                      {viewingEmployee.nextOfKinPhone ? (
                        <a
                          href={`tel:${viewingEmployee.nextOfKinPhone}`}
                          className="inline-flex items-center gap-1 font-bold text-rose-700 hover:underline"
                        >
                          <Phone size={13} /> {viewingEmployee.nextOfKinPhone}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </div>
                    {viewingEmployee.nextOfKinAddress && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-500 text-xs block">Location / Notes</span>
                        <span className="text-gray-800">{viewingEmployee.nextOfKinAddress}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No Next of Kin details recorded yet.</p>
                )}
              </div>

              {/* ID Document Card */}
              <div className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-emerald-600" /> National ID Document
                  </h4>
                  {viewingEmployee.idCardUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomedIdImageUrl(viewingEmployee.idCardUrl || null)}
                      className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <ZoomIn size={13} /> Enlarge Scan
                    </button>
                  )}
                </div>

                {viewingEmployee.idCardUrl ? (
                  <div
                    onClick={() => setZoomedIdImageUrl(viewingEmployee.idCardUrl || null)}
                    className="cursor-pointer group relative w-full h-48 bg-muted rounded-xl border overflow-hidden flex items-center justify-center hover:opacity-95 transition"
                  >
                    <img
                      src={viewingEmployee.idCardUrl}
                      alt="ID Scan"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <ZoomIn size={16} /> Click to View Full Resolution
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 bg-muted/20 border border-dashed rounded-xl text-gray-400">
                    <AlertCircle size={28} className="mx-auto mb-1 opacity-50" />
                    <p className="text-xs">No physical ID card scan attached to this profile.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dossier Footer */}
            <div className="p-4 bg-muted/40 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const emp = viewingEmployee;
                  setViewingEmployee(null);
                  openEditModal(emp);
                }}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-muted transition flex items-center gap-1.5"
              >
                <Edit size={14} /> Edit Record
              </button>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ID Card Zoom Lightbox Modal */}
      {zoomedIdImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[130] flex flex-col items-center justify-center p-4"
          onClick={() => setZoomedIdImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomedIdImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-1 flex items-center gap-1 text-sm font-semibold"
            >
              <X size={20} /> Close
            </button>
            <img
              src={zoomedIdImageUrl}
              alt="Full Resolution ID Document"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-gray-700 shadow-2xl bg-black"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Live Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={cameraModalConfig.isOpen}
        title={cameraModalConfig.title}
        captureMode={cameraModalConfig.mode}
        onClose={() => setCameraModalConfig(c => ({ ...c, isOpen: false }))}
        onCapture={handleCameraCapture}
      />

      {/* Record Advance Pay Modal */}
      {selectedEmpForAdvance && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEmpForAdvance(null)}>
          <div className="bg-card w-full max-w-md rounded-2xl shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <Banknote size={24} />
              <h2 className="text-xl font-bold text-foreground">Record Salary Advance</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Recording advance pay for <strong className="text-gray-800">{selectedEmpForAdvance.firstName} {selectedEmpForAdvance.lastName}</strong>. Monthly salary: {settings.currency} {selectedEmpForAdvance.salary.toLocaleString()}.
            </p>

            <form onSubmit={handleRecordAdvance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Advance Amount ({settings.currency}) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Enter amount paid"
                  className="w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono text-base bg-white"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Reason / Notes <span className="font-normal text-gray-500">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Emergency medical advance"
                  className="w-full p-2.5 border rounded-xl text-sm bg-white"
                  value={advanceNotes}
                  onChange={e => setAdvanceNotes(e.target.value)}
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                💡 <strong>Note:</strong> Saving this will update the employee's advance balance and automatically record a <strong>Cash Expense</strong> under <em>Salary / Advance Pay</em> for accounting.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmpForAdvance(null)}
                  className="px-4 py-2 border rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdvance}
                  className="px-4 py-2 bg-amber-700 text-white rounded-xl hover:bg-amber-800 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {isSubmittingAdvance ? 'Saving...' : 'Record Advance Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Salary Modal */}
      {selectedEmpForSalary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEmpForSalary(null)}>
          <div className="bg-card w-full max-w-md rounded-2xl shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-green-700">
              <Banknote size={24} />
              <h2 className="text-xl font-bold text-foreground">Record Salary Payment</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Recording final salary payment for <strong className="text-gray-900">{selectedEmpForSalary.firstName} {selectedEmpForSalary.lastName}</strong>.
            </p>

            <form onSubmit={handleRecordSalary} className="space-y-4">
              <div className="bg-gray-50 border rounded-xl p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Salary:</span>
                  <span className="font-medium">{settings.currency} {selectedEmpForSalary.salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Less Advance Pay:</span>
                  <span>- {settings.currency} {(selectedEmpForSalary.advancePay || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t text-gray-900">
                  <span>Net Payout:</span>
                  <span>{settings.currency} {(selectedEmpForSalary.salary - (selectedEmpForSalary.advancePay || 0)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Reason / Notes <span className="font-normal text-gray-500">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. August 2026 Salary"
                  className="w-full p-2.5 border rounded-xl text-sm bg-white"
                  value={salaryNotes}
                  onChange={e => setSalaryNotes(e.target.value)}
                />
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 leading-relaxed">
                💡 <strong>Note:</strong> Saving this will record a cash expense for the net payout and clear any pending advance balance for this employee.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmpForSalary(null)}
                  className="px-4 py-2 border rounded-xl text-gray-700 hover:bg-gray-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSalary}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {isSubmittingSalary ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
