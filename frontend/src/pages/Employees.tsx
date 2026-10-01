import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, UserPlus, CheckCircle, Clock, Banknote, RotateCcw, PlusCircle,
  Trash2, Edit, Camera, Upload, Eye, X, Phone, Mail, MapPin,
  Calendar, ShieldCheck, HeartHandshake, FileText, Search, ZoomIn,
  AlertCircle, Image as ImageIcon, Share2, Printer, History, Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
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
    deleteEmployee, getTotalAdvancePay, loadAdvanceHistory, loadSalaryHistory
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
  const [dossierTab, setDossierTab] = useState<'profile' | 'advances' | 'salaries'>('profile');
  const [isSharingPayroll, setIsSharingPayroll] = useState(false);
  // History filters (shared between advance & salary tabs)
  const [historyMonthFilter, setHistoryMonthFilter] = useState(''); // 'YYYY-MM' or ''
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

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

  // Open dossier and load both histories in parallel
  const openDossier = (emp: Employee, initialTab: 'profile' | 'advances' | 'salaries' = 'profile') => {
    setViewingEmployee(emp);
    setDossierTab(initialTab);
    setHistoryMonthFilter('');
    setHistoryStartDate('');
    setHistoryEndDate('');
    loadAdvanceHistory(emp.id);
    loadSalaryHistory(emp.id);
  };

  // WhatsApp share: capture styled payroll document as image and share or fallback to styled text
  const handleWhatsAppShare = async (emp: Employee) => {
    setIsSharingPayroll(true);
    const toastId = toast.loading('Generating payroll card image...');
    try {
      const advHistory = emp.advanceHistory || [];
      const salHistory = emp.salaryHistory || [];
      const cur = settings.currency;
      const totalAdvances = advHistory.reduce((s, r) => s + r.amount, 0);
      const totalSalaries = salHistory.reduce((s, r) => s + r.netPaid, 0);

      // Create an offscreen, beautifully styled DOM container to screenshot
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '640px';
      container.style.background = '#ffffff';
      container.style.color = '#0f172a';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.padding = '28px';
      container.style.borderRadius = '16px';
      container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';

      const advRowsHtml = advHistory.length
        ? advHistory.map((r, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 6px;color:#64748b;font-size:12px;">#${i + 1}</td>
            <td style="padding:8px 6px;font-size:12px;font-weight:600;">${r.date}</td>
            <td style="padding:8px 6px;font-size:12px;color:#b45309;font-weight:700;text-align:right;">${cur} ${r.amount.toLocaleString()}</td>
            <td style="padding:8px 6px;font-size:11px;color:#475569;">${r.notes || '—'}</td>
            <td style="padding:8px 6px;font-size:11px;color:#94a3b8;">${r.loggedBy}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding:14px;text-align:center;color:#94a3b8;font-size:12px;">No advance payments recorded.</td></tr>';

      const salRowsHtml = salHistory.length
        ? salHistory.map((r, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 6px;color:#64748b;font-size:12px;">#${i + 1}</td>
            <td style="padding:8px 6px;font-size:12px;font-weight:600;">${r.date}</td>
            <td style="padding:8px 6px;font-size:12px;text-align:right;">${cur} ${r.grossSalary.toLocaleString()}</td>
            <td style="padding:8px 6px;font-size:12px;color:#b45309;text-align:right;">-${cur} ${r.advanceDeducted.toLocaleString()}</td>
            <td style="padding:8px 6px;font-size:12px;font-weight:700;color:#15803d;text-align:right;">${cur} ${r.netPaid.toLocaleString()}</td>
            <td style="padding:8px 6px;font-size:11px;color:#475569;">${r.notes || '—'}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="6" style="padding:14px;text-align:center;color:#94a3b8;font-size:12px;">No salary payments recorded.</td></tr>';

      container.innerHTML = `
        <div style="border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h2 style="margin:0;font-size:20px;font-weight:800;color:#1e3a8a;">${settings.companyName || 'MsikaFlo Limited'}</h2>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Employee Compensation &amp; Payroll Record</div>
          </div>
          <div style="text-align:right;">
            <span style="display:inline-block;padding:3px 10px;background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;border-radius:12px;">${emp.role}</span>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">ID: ${emp.idNumber || 'N/A'}</div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:18px;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px;">${emp.firstName} ${emp.lastName}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">MONTHLY SALARY</span>
              <strong style="font-size:14px;color:#0f172a;">${cur} ${emp.salary.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">ADVANCE BALANCE</span>
              <strong style="font-size:14px;color:${(emp.advancePay || 0) > 0 ? '#b45309' : '#0f172a'};">${cur} ${(emp.advancePay || 0).toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">NET DUE THIS MONTH</span>
              <strong style="font-size:14px;color:#15803d;">${cur} ${(emp.salary - (emp.advancePay || 0)).toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;color:#92400e;margin-bottom:6px;display:flex;justify-content:space-between;">
            <span>💵 Advance Pay History (${advHistory.length})</span>
            <span>Total: ${cur} ${totalAdvances.toLocaleString()}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead>
              <tr style="background:#fef3c7;color:#92400e;font-size:10px;text-transform:uppercase;">
                <th style="padding:6px;">#</th>
                <th style="padding:6px;">Date</th>
                <th style="padding:6px;text-align:right;">Amount</th>
                <th style="padding:6px;">Notes</th>
                <th style="padding:6px;">Logged By</th>
              </tr>
            </thead>
            <tbody>${advRowsHtml}</tbody>
          </table>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:800;color:#166534;margin-bottom:6px;display:flex;justify-content:space-between;">
            <span>✅ Salary Payments History (${salHistory.length})</span>
            <span>Total Paid: ${cur} ${totalSalaries.toLocaleString()}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead>
              <tr style="background:#dcfce7;color:#166534;font-size:10px;text-transform:uppercase;">
                <th style="padding:6px;">#</th>
                <th style="padding:6px;">Date</th>
                <th style="padding:6px;text-align:right;">Gross</th>
                <th style="padding:6px;text-align:right;">Advance</th>
                <th style="padding:6px;text-align:right;">Net Paid</th>
                <th style="padding:6px;">Notes</th>
              </tr>
            </thead>
            <tbody>${salRowsHtml}</tbody>
          </table>
        </div>

        <div style="border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
          <span>Generated on ${new Date().toLocaleString()}</span>
          <span>${settings.companyName || 'MsikaFlo'} Payroll</span>
        </div>
      `;

      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      document.body.removeChild(container);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Could not generate image.', { id: toastId });
          setIsSharingPayroll(false);
          return;
        }

        const fileName = `Payroll_${emp.firstName}_${emp.lastName}_${new Date().toISOString().slice(0, 10)}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // If Web Share API supports file sharing (mobile WhatsApp or native share)
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Payroll Record — ${emp.firstName} ${emp.lastName}`,
              text: `Payroll & Advance Pay statement for ${emp.firstName} ${emp.lastName} (${settings.companyName || 'MsikaFlo'})`,
            });
            toast.success('Shared successfully!', { id: toastId });
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              toast.error('Sharing failed', { id: toastId });
            } else {
              toast.dismiss(toastId);
            }
          }
        } else {
          // Desktop WhatsApp Web fallback: automatically download the image card & open WhatsApp
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);

          const summaryMsg = encodeURIComponent(
`*${settings.companyName || 'MsikaFlo'} — PAYROLL STATEMENT*
Employee: ${emp.firstName} ${emp.lastName} (${emp.role})
Monthly Salary: ${cur} ${emp.salary.toLocaleString()}
Advance Balance: ${cur} ${(emp.advancePay || 0).toLocaleString()}
Net Due: ${cur} ${(emp.salary - (emp.advancePay || 0)).toLocaleString()}

📸 *Note:* The full visual payroll card with complete advance & salary tables has been downloaded to your device (${fileName}). You can attach it directly to this chat!`
          );
          window.open(`https://wa.me/?text=${summaryMsg}`, '_blank');
          toast.success('Payroll image downloaded! Attach it to your WhatsApp chat.', { id: toastId });
        }
        setIsSharingPayroll(false);
      }, 'image/png');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate shareable image: ' + err.message, { id: toastId });
      setIsSharingPayroll(false);
    }
  };

  // Print payroll history for an employee
  const handlePrintPayrollHistory = (emp: Employee) => {
    const advHistory = emp.advanceHistory || [];
    const salHistory = emp.salaryHistory || [];
    const cur = settings.currency;
    const totalAdvances = advHistory.reduce((s, r) => s + r.amount, 0);
    const totalSalaries = salHistory.reduce((s, r) => s + r.netPaid, 0);

    const advRows = advHistory.length
      ? advHistory.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.date}</td>
          <td style="text-align:right">${cur} ${r.amount.toLocaleString()}</td>
          <td>${r.notes || '—'}</td>
          <td>${r.loggedBy}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#888">No advance records.</td></tr>';

    const salRows = salHistory.length
      ? salHistory.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.date}</td>
          <td style="text-align:right">${cur} ${r.grossSalary.toLocaleString()}</td>
          <td style="text-align:right;color:#b45309">-${cur} ${r.advanceDeducted.toLocaleString()}</td>
          <td style="text-align:right;font-weight:700">${cur} ${r.netPaid.toLocaleString()}</td>
          <td>${r.notes || '—'}</td>
          <td>${r.loggedBy}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;color:#888">No salary records.</td></tr>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payroll History — ${emp.firstName} ${emp.lastName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
    .badge { display:inline-block; background:#dbeafe; color:#1e40af; border-radius:4px; padding:2px 8px; font-size:11px; margin-left:6px; }
    h2 { font-size: 15px; margin-top: 24px; margin-bottom: 6px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .total-row { font-weight: 700; background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Payroll History <span class="badge">${emp.role}</span></h1>
  <div class="meta">
    <strong>${emp.firstName} ${emp.lastName}</strong> &nbsp;|&nbsp;
    ID: ${emp.idNumber || 'N/A'} &nbsp;|&nbsp;
    Monthly Salary: ${cur} ${emp.salary.toLocaleString()} &nbsp;|&nbsp;
    Current Advance Balance: ${cur} ${(emp.advancePay || 0).toLocaleString()}
  </div>

  <h2>💵 Advance Pay Records</h2>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Reason / Notes</th><th>Logged By</th></tr></thead>
    <tbody>${advRows}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="2">TOTAL ADVANCED</td>
      <td style="text-align:right">${cur} ${totalAdvances.toLocaleString()}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>

  <h2>✅ Salary Pay Records</h2>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Gross Salary</th><th>Advance Deducted</th><th>Net Paid</th><th>Notes</th><th>Logged By</th></tr></thead>
    <tbody>${salRows}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="4">TOTAL NET SALARIES PAID</td>
      <td style="text-align:right">${cur} ${totalSalaries.toLocaleString()}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>

  <div class="footer">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; MsikaFlo Payroll System</div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
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
                  onClick={() => openDossier(emp)}
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
                      onClick={() => openDossier(emp)}
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
                      <button
                        onClick={() => openDossier(emp, 'advances')}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-full font-bold transition cursor-pointer"
                        title="Click to view full Advance Pay history"
                      >
                        <Banknote size={12} /> Advance: {settings.currency} {emp.advancePay?.toLocaleString()}
                        <History size={11} className="ml-0.5 opacity-70" />
                      </button>
                    ) : (
                      <button
                        onClick={() => openDossier(emp, 'advances')}
                        className="text-gray-400 hover:text-gray-600 transition underline cursor-pointer"
                        title="Click to view Advance history"
                      >
                        No active advance
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-3 md:pt-0">
                <button
                  onClick={() => openDossier(emp, 'profile')}
                  className="flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-xl font-semibold transition border shadow-xs"
                  title="View Full Profile Dossier"
                >
                  <Eye size={14} className="text-primary" /> Profile
                </button>
                <button
                  onClick={() => openDossier(emp, 'advances')}
                  className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold transition shadow-xs"
                  title="View Full Advance & Salary History"
                >
                  <History size={14} className="text-amber-700" /> History
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
      {viewingEmployee && (() => {
        const emp = employees.find(e => e.id === viewingEmployee.id) || viewingEmployee;
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50"
            onClick={() => setViewingEmployee(null)}
          >
            <div
              className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header banner */}
              <div className="relative bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={emp.firstName}
                      className="w-20 h-20 rounded-2xl object-cover border-4 border-white/20 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/20 flex items-center justify-center text-2xl font-black">
                      {emp.firstName?.[0]}{emp.lastName?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-bold">{emp.firstName} {emp.lastName}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                        {emp.status}
                      </span>
                    </div>
                    <p className="text-blue-100 font-medium text-sm mt-0.5">{emp.role}</p>
                    {emp.idNumber && (
                      <p className="text-xs font-mono text-blue-200 mt-1">ID: {emp.idNumber}</p>
                    )}
                  </div>
                  {/* Share & Print buttons in header */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(emp)}
                      disabled={isSharingPayroll}
                      title="Share payroll history via WhatsApp"
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                    >
                      {isSharingPayroll ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                      {isSharingPayroll ? 'Generating...' : 'WhatsApp'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintPayrollHistory(emp)}
                      title="Print payroll history"
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition"
                    >
                      <Printer size={14} /> Print
                    </button>
                  </div>
                </div>

                {/* Financial summary strips */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wide block">Salary</span>
                    <span className="font-bold font-mono text-sm">{settings.currency} {emp.salary.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wide block">Advance</span>
                    <span className={`font-bold font-mono text-sm ${(emp.advancePay || 0) > 0 ? 'text-amber-300' : ''}`}>
                      {settings.currency} {(emp.advancePay || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2">
                    <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wide block">Net Due</span>
                    <span className="font-bold font-mono text-sm text-emerald-300">
                      {settings.currency} {(emp.salary - (emp.advancePay || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b bg-muted/20 px-5 gap-1">
                {([
                  { key: 'profile', label: 'Profile', Icon: Users },
                  { key: 'advances', label: `Advances (${(emp.advanceHistory || []).length})`, Icon: Banknote },
                  { key: 'salaries', label: `Salaries (${(emp.salaryHistory || []).length})`, Icon: CheckCircle },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDossierTab(key as any)}
                    className={`py-3 px-3 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                      dossierTab === key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* ── PROFILE TAB ── */}
                {dossierTab === 'profile' && (
                  <>
                    {/* Contact & Personal Details */}
                    <div className="bg-card border rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Users size={14} className="text-primary" /> Contact &amp; Particulars
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone size={15} className="text-gray-400" />
                          <span className="text-gray-600">Phone:</span>
                          {emp.phone ? (
                            <a href={`tel:${emp.phone}`} className="font-semibold text-primary hover:underline">
                              {emp.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Not set</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail size={15} className="text-gray-400" />
                          <span className="text-gray-600">Email:</span>
                          {emp.email ? (
                            <a href={`mailto:${emp.email}`} className="font-semibold text-primary hover:underline">
                              {emp.email}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Not set</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={15} className="text-gray-400" />
                          <span className="text-gray-600">Address:</span>
                          <span className="font-medium text-gray-900">{emp.address || 'Not set'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-gray-400" />
                          <span className="text-gray-600">Date Joined:</span>
                          <span className="font-medium text-gray-900">{emp.dateJoined || 'Not set'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Next of Kin */}
                    <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                        <HeartHandshake size={15} className="text-rose-600" /> Next of Kin (Emergency Contact)
                      </h4>
                      {emp.nextOfKinName ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs block">Contact Name</span>
                            <span className="font-bold text-gray-900">{emp.nextOfKinName}</span>
                            <span className="text-xs text-rose-700 font-semibold ml-2">({emp.nextOfKinRelationship || 'Kin'})</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs block">Emergency Phone</span>
                            {emp.nextOfKinPhone ? (
                              <a href={`tel:${emp.nextOfKinPhone}`} className="inline-flex items-center gap-1 font-bold text-rose-700 hover:underline">
                                <Phone size={13} /> {emp.nextOfKinPhone}
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">None</span>
                            )}
                          </div>
                          {emp.nextOfKinAddress && (
                            <div className="sm:col-span-2">
                              <span className="text-gray-500 text-xs block">Location / Notes</span>
                              <span className="text-gray-800">{emp.nextOfKinAddress}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No Next of Kin details recorded yet.</p>
                      )}
                    </div>

                    {/* ID Document */}
                    <div className="bg-card border rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                          <ShieldCheck size={15} className="text-emerald-600" /> National ID Document
                        </h4>
                        {emp.idCardUrl && (
                          <button
                            type="button"
                            onClick={() => setZoomedIdImageUrl(emp.idCardUrl || null)}
                            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            <ZoomIn size={13} /> Enlarge Scan
                          </button>
                        )}
                      </div>
                      {emp.idCardUrl ? (
                        <div
                          onClick={() => setZoomedIdImageUrl(emp.idCardUrl || null)}
                          className="cursor-pointer group relative w-full h-48 bg-muted rounded-xl border overflow-hidden flex items-center justify-center hover:opacity-95 transition"
                        >
                          <img src={emp.idCardUrl} alt="ID Scan" className="w-full h-full object-contain" />
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
                  </>
                )}

                {/* ── ADVANCE HISTORY TAB ── */}
                {dossierTab === 'advances' && (() => {
                  const allAdv = emp.advanceHistory;
                  const filtered = allAdv ? [...allAdv].reverse().filter(r => {
                    if (historyMonthFilter && !r.date.startsWith(historyMonthFilter)) return false;
                    if (historyStartDate && r.date < historyStartDate) return false;
                    if (historyEndDate && r.date > historyEndDate) return false;
                    return true;
                  }) : null;
                  const filteredTotal = filtered ? filtered.reduce((s, r) => s + r.amount, 0) : 0;
                  const allTotal = (allAdv || []).reduce((s, r) => s + r.amount, 0);
                  const hasFilter = !!(historyMonthFilter || historyStartDate || historyEndDate);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <Banknote size={16} className="text-amber-600" /> Advance Pay History
                        </h4>
                        <span className="text-xs text-gray-500">
                          Total: <span className="font-bold text-amber-800 font-mono">
                            {settings.currency} {(hasFilter ? filteredTotal : allTotal).toLocaleString()}
                          </span>
                          {hasFilter && <span className="text-gray-400"> (filtered)</span>}
                        </span>
                      </div>

                      {/* Filter bar */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
                          <Search size={12} /> Filter Records
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Month</label>
                            <input
                              type="month"
                              value={historyMonthFilter}
                              onChange={e => { setHistoryMonthFilter(e.target.value); setHistoryStartDate(''); setHistoryEndDate(''); }}
                              className="w-full border border-amber-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">From Date</label>
                            <input
                              type="date"
                              value={historyStartDate}
                              onChange={e => { setHistoryStartDate(e.target.value); setHistoryMonthFilter(''); }}
                              className="w-full border border-amber-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">To Date</label>
                            <input
                              type="date"
                              value={historyEndDate}
                              onChange={e => { setHistoryEndDate(e.target.value); setHistoryMonthFilter(''); }}
                              className="w-full border border-amber-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                        {hasFilter && (
                          <button
                            type="button"
                            onClick={() => { setHistoryMonthFilter(''); setHistoryStartDate(''); setHistoryEndDate(''); }}
                            className="text-[10px] text-amber-700 hover:text-amber-900 underline"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      {allAdv === undefined ? (
                        <div className="text-center py-8 text-gray-400">
                          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-xs">Loading history...</p>
                          <button
                            type="button"
                            onClick={() => loadAdvanceHistory(emp.id)}
                            className="mt-2 text-xs text-amber-600 hover:underline"
                          >
                            Tap to retry
                          </button>
                        </div>
                      ) : filtered!.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                          <History size={30} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">{hasFilter ? 'No records match filter.' : 'No advance records yet.'}</p>
                          {!hasFilter && <p className="text-xs mt-1">Advances recorded via the "Pay Advance" button will appear here.</p>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filtered!.map((rec, i) => (
                            <div key={rec.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                              <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                {filtered!.length - i}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-bold text-amber-900 font-mono text-sm">
                                    {settings.currency} {rec.amount.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-gray-500 font-mono">{rec.date}</span>
                                </div>
                                {rec.notes && (
                                  <p className="text-xs text-gray-700 mt-0.5 italic">"{rec.notes}"</p>
                                )}
                                <p className="text-[11px] text-gray-400 mt-1">Logged by: {rec.loggedBy}</p>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between items-center bg-amber-100 border border-amber-300 rounded-xl px-4 py-2.5 mt-2">
                            <span className="text-xs font-semibold text-amber-900">{hasFilter ? 'Filtered Total' : 'Total Advances Given'}</span>
                            <span className="font-bold font-mono text-amber-900">
                              {settings.currency} {filteredTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── SALARY HISTORY TAB ── */}
                {dossierTab === 'salaries' && (() => {
                  const allSal = emp.salaryHistory;
                  const filtered = allSal ? [...allSal].reverse().filter(r => {
                    if (historyMonthFilter && !r.date.startsWith(historyMonthFilter)) return false;
                    if (historyStartDate && r.date < historyStartDate) return false;
                    if (historyEndDate && r.date > historyEndDate) return false;
                    return true;
                  }) : null;
                  const filteredTotal = filtered ? filtered.reduce((s, r) => s + r.netPaid, 0) : 0;
                  const allTotal = (allSal || []).reduce((s, r) => s + r.netPaid, 0);
                  const hasFilter = !!(historyMonthFilter || historyStartDate || historyEndDate);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-600" /> Salary Pay History
                        </h4>
                        <span className="text-xs text-gray-500">
                          Total Paid: <span className="font-bold text-green-800 font-mono">
                            {settings.currency} {(hasFilter ? filteredTotal : allTotal).toLocaleString()}
                          </span>
                          {hasFilter && <span className="text-gray-400"> (filtered)</span>}
                        </span>
                      </div>

                      {/* Filter bar */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800 mb-1">
                          <Search size={12} /> Filter Records
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Month</label>
                            <input
                              type="month"
                              value={historyMonthFilter}
                              onChange={e => { setHistoryMonthFilter(e.target.value); setHistoryStartDate(''); setHistoryEndDate(''); }}
                              className="w-full border border-green-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">From Date</label>
                            <input
                              type="date"
                              value={historyStartDate}
                              onChange={e => { setHistoryStartDate(e.target.value); setHistoryMonthFilter(''); }}
                              className="w-full border border-green-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">To Date</label>
                            <input
                              type="date"
                              value={historyEndDate}
                              onChange={e => { setHistoryEndDate(e.target.value); setHistoryMonthFilter(''); }}
                              className="w-full border border-green-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                          </div>
                        </div>
                        {hasFilter && (
                          <button
                            type="button"
                            onClick={() => { setHistoryMonthFilter(''); setHistoryStartDate(''); setHistoryEndDate(''); }}
                            className="text-[10px] text-green-700 hover:text-green-900 underline"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      {allSal === undefined ? (
                        <div className="text-center py-8 text-gray-400">
                          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-xs">Loading history...</p>
                          <button
                            type="button"
                            onClick={() => loadSalaryHistory(emp.id)}
                            className="mt-2 text-xs text-green-600 hover:underline"
                          >
                            Tap to retry
                          </button>
                        </div>
                      ) : filtered!.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                          <History size={30} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">{hasFilter ? 'No records match filter.' : 'No salary records yet.'}</p>
                          {!hasFilter && <p className="text-xs mt-1">Salaries recorded via the "Pay Salary" button will appear here.</p>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filtered!.map((rec, i) => (
                            <div key={rec.id} className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {filtered!.length - i}
                                  </div>
                                  <span className="font-bold text-green-900 font-mono text-sm">
                                    Net: {settings.currency} {rec.netPaid.toLocaleString()}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 font-mono">{rec.date}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs ml-8">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Gross Salary:</span>
                                  <span className="font-mono font-semibold">{settings.currency} {rec.grossSalary.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Advance Deducted:</span>
                                  <span className="font-mono font-semibold text-amber-700">-{settings.currency} {rec.advanceDeducted.toLocaleString()}</span>
                                </div>
                              </div>
                              {rec.notes && (
                                <p className="text-xs text-gray-700 ml-8 italic">"{rec.notes}"</p>
                              )}
                              <p className="text-[11px] text-gray-400 ml-8">Logged by: {rec.loggedBy}</p>
                            </div>
                          ))}
                          <div className="flex justify-between items-center bg-green-100 border border-green-300 rounded-xl px-4 py-2.5 mt-2">
                            <span className="text-xs font-semibold text-green-900">{hasFilter ? 'Filtered Total' : 'Total Net Salaries Paid'}</span>
                            <span className="font-bold font-mono text-green-900">
                              {settings.currency} {filteredTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>

              {/* Dossier Footer */}
              <div className="p-4 bg-muted/40 border-t flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleWhatsAppShare(emp)}
                    disabled={isSharingPayroll}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    {isSharingPayroll ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                    {isSharingPayroll ? 'Generating...' : 'Share via WhatsApp'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintPayrollHistory(emp)}
                    className="flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-muted transition"
                  >
                    <Printer size={13} /> Print Report
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
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
          </div>
        );
      })()}

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
