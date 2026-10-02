import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Printer, Share2, FileText, User, History
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useEmployeeStore, type SalaryPayRecord } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

export default function EmployeePayslip() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { employees, isLoading, loadEmployees, loadSalaryHistory } = useEmployeeStore();
  const settings = useSettingsStore();
  const currentUser = useAuthStore(state => state.user);

  const recordParam = searchParams.get('record') || '';
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(recordParam || 'CURRENT');
  const [customPayPeriod, setCustomPayPeriod] = useState<string>('');
  const [customAuthorizer, setCustomAuthorizer] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (employees.length === 0) {
      loadEmployees();
    }
  }, [employees.length, loadEmployees]);

  useEffect(() => {
    if (id) {
      loadSalaryHistory(id);
    }
  }, [id, loadSalaryHistory]);

  const emp = employees.find(e => e.id === id);
  const salaryHistory = emp?.salaryHistory || [];
  const sortedSalaryHistory = [...salaryHistory].sort((a, b) => b.createdAt - a.createdAt);

  // Sync selectedPeriodKey when recordParam or salary history updates
  useEffect(() => {
    if (recordParam) {
      setSelectedPeriodKey(recordParam);
    } else if (sortedSalaryHistory.length > 0) {
      setSelectedPeriodKey(sortedSalaryHistory[0].id);
    } else {
      setSelectedPeriodKey('CURRENT');
    }
  }, [recordParam, sortedSalaryHistory.length]);

  if (isLoading && !emp) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">Loading employee payslip...</span>
        </div>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center mt-12">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <User size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Employee Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">The employee record could not be found.</p>
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>
      </div>
    );
  }

  const cur = settings.currency || 'MWK';
  const companyName = settings.companyName || 'JEF INVESTMENT';

  // Format pay period: accurately identifies if salary paid early in month M is for month M-1
  const formatPayPeriod = (dateStr: string, notesStr?: string) => {
    // 1. If notes explicitly mention a month, honor it
    if (notesStr) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      for (const m of months) {
        if (new RegExp(`\\b${m}\\b`, 'i').test(notesStr)) {
          const yearMatch = notesStr.match(/\b(20\d{2})\b/);
          const yr = yearMatch ? yearMatch[1] : (dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear());
          return `${m} ${yr}`;
        }
      }
    }
    if (!dateStr) return 'Current Period';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      // In payroll practice, salary settled on day 1 to 15 of month M is for month M-1 (last month)
      if (d.getDate() <= 15) {
        const prevMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        return prevMonthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      }
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    return dateStr;
  };

  const selectedRecord: SalaryPayRecord | undefined = sortedSalaryHistory.find(r => r.id === selectedPeriodKey);

  let defaultPayPeriod = '';
  let paymentDate = '';
  let basicSalary = 0;
  let grossSalary = 0;
  let advanceDeduction = 0;
  const otherDeductions = 0;
  let totalDeductions = 0;
  let netPay = 0;
  let paymentMethod = 'Cash';
  let paymentStatus = 'Paid';
  let payrollRef = '';
  let notes = '';
  let defaultAuthorizer = '';

  if (selectedRecord) {
    defaultPayPeriod = formatPayPeriod(selectedRecord.date, selectedRecord.notes);
    paymentDate = selectedRecord.date;
    basicSalary = selectedRecord.grossSalary || emp.salary;
    advanceDeduction = selectedRecord.advanceDeducted > 0
      ? selectedRecord.advanceDeducted
      : Math.max(0, basicSalary - selectedRecord.netPaid);
    grossSalary = basicSalary;
    totalDeductions = advanceDeduction + otherDeductions;
    netPay = selectedRecord.netPaid;
    paymentMethod = selectedRecord.paymentMethod || 'Cash';
    paymentStatus = 'Paid';
    payrollRef = `PAY-${selectedRecord.id.slice(-6).toUpperCase()}`;
    notes = selectedRecord.notes || '';
    defaultAuthorizer = selectedRecord.loggedBy || currentUser?.name || 'Administrator';
  } else {
    // Current Period fallback
    const now = new Date();
    defaultPayPeriod = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    paymentDate = now.toISOString().slice(0, 10);
    basicSalary = emp.salary || 0;
    grossSalary = basicSalary;
    advanceDeduction = emp.advancePay || 0;
    totalDeductions = advanceDeduction;
    netPay = Math.max(0, grossSalary - totalDeductions);
    paymentMethod = 'Cash';
    paymentStatus = advanceDeduction > 0 || netPay > 0 ? 'Pending Settlement' : 'Up to Date';
    payrollRef = `DRAFT-${emp.id.slice(-4).toUpperCase()}`;
    notes = '';
    defaultAuthorizer = currentUser?.name || 'Administrator';
  }

  // Active pay period and authorizer (allows user override if needed)
  const payPeriod = customPayPeriod || defaultPayPeriod;
  const authorizer = customAuthorizer || defaultAuthorizer;
  const authDate = paymentDate || new Date().toISOString().slice(0, 10);
  const generatedDateTime = new Date().toLocaleString();

  // Print Payslip
  const handlePrintPayslip = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip — ${emp.firstName} ${emp.lastName} — ${payPeriod}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 13px;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
      line-height: 1.45;
    }
    .payslip-wrapper {
      max-width: 780px;
      margin: 0 auto;
      border: 1.5px solid #0f172a;
      border-radius: 8px;
      padding: 24px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .header img {
      max-height: 55px;
      max-width: 140px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #0f172a;
      margin: 0;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 3px;
      color: #1e3a8a;
      margin: 4px 0 0 0;
    }
    .pay-period-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 14px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .info-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 18px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 8px;
      column-gap: 20px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 4px;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
    }
    .tables-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }
    .table-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .table-header {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
    }
    .table-body {
      padding: 8px 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .row:last-child {
      border-bottom: none;
    }
    .row-label {
      color: #475569;
    }
    .row-value {
      font-weight: 600;
      font-family: monospace;
      color: #0f172a;
    }
    .table-total {
      background: #f8fafc;
      border-top: 1.5px solid #cbd5e1;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: 12px;
    }
    .net-pay-banner {
      background: #f0fdf4;
      border: 2px solid #16a34a;
      border-radius: 8px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .net-pay-label {
      font-size: 14px;
      font-weight: 800;
      color: #166534;
      letter-spacing: 1px;
    }
    .net-pay-amount {
      font-size: 24px;
      font-weight: 900;
      color: #15803d;
      font-family: monospace;
    }
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      color: #92400e;
      margin-bottom: 16px;
    }
    .authorization-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
    }
    .auth-block {
      text-align: left;
    }
    .auth-value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      min-height: 22px;
      padding-bottom: 2px;
    }
    .auth-line {
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 4px;
    }
    .auth-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="payslip-wrapper">
    <div class="header">
      ${settings.companyLogo ? `<img src="${settings.companyLogo}" alt="Logo" />` : ''}
      <h1 class="company-title">${companyName}</h1>
      <div class="doc-title">PAYSLIP</div>
      <div class="pay-period-badge">PAY PERIOD: ${payPeriod.toUpperCase()}</div>
    </div>

    <!-- Employee Information -->
    <div class="info-section">
      <div class="info-item">
        <span class="info-label">Employee Name:</span>
        <span class="info-value">${emp.firstName} ${emp.lastName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Employee ID:</span>
        <span class="info-value">${emp.id}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Position / Role:</span>
        <span class="info-value">${emp.role}</span>
      </div>
      ${emp.department ? `
      <div class="info-item">
        <span class="info-label">Department:</span>
        <span class="info-value">${emp.department}</span>
      </div>` : `
      <div class="info-item">
        <span class="info-label">Payment Date:</span>
        <span class="info-value">${paymentDate}</span>
      </div>`}
      ${emp.department ? `
      <div class="info-item">
        <span class="info-label">Payment Date:</span>
        <span class="info-value">${paymentDate}</span>
      </div>` : ''}
      <div class="info-item">
        <span class="info-label">Payment Status:</span>
        <span class="info-value">${paymentStatus}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Payroll Reference:</span>
        <span class="info-value">${payrollRef}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Payment Method:</span>
        <span class="info-value">${paymentMethod}</span>
      </div>
    </div>

    <!-- Earnings & Deductions Tables -->
    <div class="tables-container">
      <!-- Earnings Box -->
      <div class="table-box">
        <div class="table-header">
          <span>Earnings</span>
          <span>Amount (${cur})</span>
        </div>
        <div class="table-body">
          <div class="row">
            <span class="row-label">Basic / Monthly Salary</span>
            <span class="row-value">${cur} ${basicSalary.toLocaleString()}</span>
          </div>
        </div>
        <div class="table-total">
          <span>GROSS SALARY</span>
          <span>${cur} ${grossSalary.toLocaleString()}</span>
        </div>
      </div>

      <!-- Deductions Box -->
      <div class="table-box">
        <div class="table-header" style="background:#475569;">
          <span>Deductions</span>
          <span>Amount (${cur})</span>
        </div>
        <div class="table-body">
          <div class="row">
            <span class="row-label">Advance Deduction</span>
            <span class="row-value" style="color:#b45309;">-${cur} ${advanceDeduction.toLocaleString()}</span>
          </div>
        </div>
        <div class="table-total">
          <span>TOTAL DEDUCTIONS</span>
          <span style="color:#b45309;">${cur} ${totalDeductions.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Prominent Net Pay -->
    <div class="net-pay-banner">
      <div class="net-pay-label">NET PAY</div>
      <div class="net-pay-amount">${cur} ${netPay.toLocaleString()}</div>
    </div>

    ${notes ? `
    <div class="notes-box">
      <strong>NOTES:</strong> ${notes}
    </div>` : ''}

    <!-- Autofilled Authorization Section (Employee Signature & Prepared By removed) -->
    <div class="authorization-section">
      <div class="auth-block">
        <div class="auth-value">${authorizer}</div>
        <div class="auth-line"></div>
        <div class="auth-label">Authorized By</div>
      </div>
      <div class="auth-block">
        <div class="auth-value font-mono">${authDate}</div>
        <div class="auth-line"></div>
        <div class="auth-label">Date</div>
      </div>
    </div>

    <div class="footer">
      <span>Jef Investment Payroll System</span>
      <span>Generated on: ${generatedDateTime}</span>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  // WhatsApp / Image share
  const handleSharePayslipImage = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Generating payslip image...');
    try {
      const el = document.getElementById('payslip-print-sheet');
      if (!el) throw new Error('Payslip element not found');

      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Could not generate payslip image', { id: toastId });
          setIsExporting(false);
          return;
        }

        const fileName = `Payslip_${emp.firstName}_${emp.lastName}_${payPeriod.replace(/\s+/g, '_')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Payslip — ${emp.firstName} ${emp.lastName}`,
              text: `Payslip for ${emp.firstName} ${emp.lastName} (${payPeriod}) from ${companyName}`,
            });
            toast.success('Payslip shared!', { id: toastId });
          } catch (err: any) {
            if (err.name !== 'AbortError') toast.error('Sharing failed', { id: toastId });
            else toast.dismiss(toastId);
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Payslip image downloaded!', { id: toastId });
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export payslip: ' + err.message, { id: toastId });
      setIsExporting(false);
    }
  };

  return (
    <div className="p-1.5 sm:p-3 md:p-8 bg-slate-100 min-h-full pb-24 space-y-6 w-full">
      {/* Top Navigation & Controls Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/employees')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-card border rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-muted transition cursor-pointer shadow-xs"
          >
            <ArrowLeft size={16} />
            <span>Staff Directory</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/employees/${emp.id}`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-card border rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-muted transition cursor-pointer shadow-xs"
          >
            <span>View Profile</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/employees/${emp.id}/history`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-card border rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-muted transition cursor-pointer shadow-xs"
          >
            <History size={16} />
            <span>Payroll History</span>
          </button>
        </div>

        {/* Action Buttons: Print, WhatsApp */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSharePayslipImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
            title="Share payslip image or attach to WhatsApp"
          >
            <Share2 size={16} />
            <span>{isExporting ? 'Preparing...' : 'WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPayslip}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
            title="Print payslip or save as PDF"
          >
            <Printer size={16} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar: Employee Switcher, Pay Period & Authorizer */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">Monthly Payslip Document</h2>
            <p className="text-xs text-muted-foreground">
              Official compensation &amp; deduction breakdown for {emp.firstName} {emp.lastName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full lg:w-auto">
          {/* Employee Selector Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Employee
            </label>
            <select
              value={emp.id}
              onChange={e => navigate(`/employees/${e.target.value}/payslip`)}
              className="w-full px-3 py-1.5 text-xs bg-muted/40 border rounded-xl font-medium focus:ring-1 focus:ring-primary outline-none"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.role})
                </option>
              ))}
            </select>
          </div>

          {/* Pay Period Selector Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Payment Record
            </label>
            <select
              value={selectedPeriodKey}
              onChange={e => {
                const val = e.target.value;
                setSelectedPeriodKey(val);
                setCustomPayPeriod(''); // reset custom override when selecting a record
                if (val !== 'CURRENT') setSearchParams({ record: val });
                else setSearchParams({});
              }}
              className="w-full px-3 py-1.5 text-xs bg-muted/40 border rounded-xl font-medium focus:ring-1 focus:ring-primary outline-none"
            >
              {sortedSalaryHistory.map(rec => (
                <option key={rec.id} value={rec.id}>
                  {formatPayPeriod(rec.date, rec.notes)} — Paid {cur} {rec.netPaid.toLocaleString()} ({rec.date})
                </option>
              ))}
              <option value="CURRENT">
                Current Period (Pending / Unsettled)
              </option>
            </select>
          </div>

          {/* Pay Period Title Customizer */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Pay Period Name
            </label>
            <input
              type="text"
              value={payPeriod}
              onChange={e => setCustomPayPeriod(e.target.value)}
              placeholder="e.g. September 2026"
              className="w-full px-3 py-1.5 text-xs bg-muted/40 border rounded-xl font-semibold text-blue-900 focus:ring-1 focus:ring-primary outline-none"
              title="Click to edit or adjust the Pay Period text displayed on the payslip"
            />
          </div>

          {/* Authorizer Customizer */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Authorized By
            </label>
            <input
              type="text"
              value={authorizer}
              onChange={e => setCustomAuthorizer(e.target.value)}
              placeholder="e.g. Administrator"
              className="w-full px-3 py-1.5 text-xs bg-muted/40 border rounded-xl font-semibold text-gray-900 focus:ring-1 focus:ring-primary outline-none"
              title="Click to edit or adjust the Authorizer name displayed on the payslip"
            />
          </div>
        </div>
      </div>

      {/* Pristine A4 Document Viewport */}
      <div className="py-2 sm:py-6 flex justify-center">
        <div
          id="payslip-print-sheet"
          className="bg-white rounded-2xl border-2 border-slate-800 p-6 sm:p-10 w-full max-w-[760px] shadow-lg text-slate-800 font-sans"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            {settings.companyLogo && (
              <img
                src={settings.companyLogo}
                alt="Logo"
                className="max-h-14 max-w-[150px] mx-auto object-contain mb-2.5"
              />
            )}
            <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase text-slate-900 leading-tight">
              {companyName}
            </h1>
            <h2 className="text-sm sm:text-base font-bold tracking-widest text-blue-900 uppercase mt-0.5">
              PAYSLIP
            </h2>
            <div className="inline-block mt-3 px-4 py-1 bg-slate-100 border border-slate-300 rounded-full text-xs font-bold text-slate-900">
              PAY PERIOD: <span className="font-black">{payPeriod.toUpperCase()}</span>
            </div>
          </div>

          {/* Employee Information */}
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Employee Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Employee Name:</span>
                <strong className="text-slate-900">{emp.firstName} {emp.lastName}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Employee ID:</span>
                <strong className="font-mono text-slate-900">{emp.id}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Position:</span>
                <strong className="text-slate-900">{emp.role}</strong>
              </div>
              {emp.department && (
                <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <strong className="text-slate-900">{emp.department}</strong>
                </div>
              )}
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Payment Date:</span>
                <strong className="text-slate-900">{paymentDate}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Payment Status:</span>
                <strong className={paymentStatus === 'Paid' ? 'text-green-700' : 'text-amber-700'}>
                  {paymentStatus}
                </strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Payroll Reference:</span>
                <strong className="font-mono text-slate-900">{payrollRef}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                <span className="text-slate-500 font-medium">Payment Method:</span>
                <strong className="text-slate-900">{paymentMethod}</strong>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {/* Earnings */}
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-900 text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex justify-between">
                <span>Earnings</span>
                <span>Amount ({cur})</span>
              </div>
              <div className="p-3.5 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Basic / Monthly Salary</span>
                  <span className="font-mono font-semibold">{cur} {basicSalary.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-slate-100 border-t border-slate-300 px-3.5 py-2.5 flex justify-between font-bold text-xs sm:text-sm">
                <span>GROSS SALARY</span>
                <span className="font-mono">{cur} {grossSalary.toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-700 text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex justify-between">
                <span>Deductions</span>
                <span>Amount ({cur})</span>
              </div>
              <div className="p-3.5 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-amber-900">
                  <span className="text-slate-600">Advance Deduction</span>
                  <span className="font-mono font-semibold">-{cur} {advanceDeduction.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-slate-100 border-t border-slate-300 px-3.5 py-2.5 flex justify-between font-bold text-xs sm:text-sm text-amber-900">
                <span>TOTAL DEDUCTIONS</span>
                <span className="font-mono">{cur} {totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Prominent Net Pay Banner */}
          <div className="bg-emerald-50 border-2 border-emerald-600 rounded-xl p-4 sm:p-5 flex items-center justify-between mb-6 shadow-xs">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-800">NET PAY</div>
              <div className="text-xs text-emerald-700 font-medium">Net salary settled to employee</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">
              {cur} {netPay.toLocaleString()}
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
              <strong>NOTES:</strong> {notes}
            </div>
          )}

          {/* Autofilled Authorization Section (Employee Signature and Prepared By removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-200 mt-8">
            <div>
              <div className="text-sm font-bold text-slate-900 pb-1 min-h-[22px]">
                {authorizer}
              </div>
              <div className="border-b-2 border-slate-900 mb-1.5"></div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Authorized By
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 font-mono pb-1 min-h-[22px]">
                {authDate}
              </div>
              <div className="border-b-2 border-slate-900 mb-1.5"></div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Date
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between text-[10px] text-slate-400 gap-1">
            <span>Jef Investment Payroll System</span>
            <span>Generated on: ${generatedDateTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
