import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, History, Share2, Printer, Banknote, CheckCircle,
  Filter, Search, Calendar, User, Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useEmployeeStore, useExpenseStore, type Employee } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export default function EmployeeHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, isLoading, loadEmployees, loadAdvanceHistory, loadSalaryHistory } = useEmployeeStore();
  const { loadExpenses } = useExpenseStore();
  const settings = useSettingsStore();

  const [historyTab, setHistoryTab] = useState<'advances' | 'salaries'>('advances');
  const [isSharingPayroll, setIsSharingPayroll] = useState(false);
  const [historyPreset, setHistoryPreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    if (employees.length === 0) {
      loadEmployees();
    }
    loadExpenses();
  }, [employees.length, loadEmployees, loadExpenses]);

  useEffect(() => {
    if (id) {
      loadAdvanceHistory(id);
      loadSalaryHistory(id);
    }
  }, [id, loadAdvanceHistory, loadSalaryHistory]);

  const emp = employees.find(e => e.id === id);

  if (isLoading && !emp) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">Loading payroll &amp; payment history...</span>
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>
      </div>
    );
  }

  const now = new Date();
  const thisMonthName = now.toLocaleString('default', { month: 'short' });
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthName = lastMonthDate.toLocaleString('default', { month: 'short' });
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const normalizeDate = (dStr: string, createdAt?: number) => {
    if (!dStr && createdAt) {
      const cd = new Date(createdAt);
      if (!isNaN(cd.getTime())) {
        return `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
      }
    }
    if (!dStr) return '';
    const trimmed = String(dStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{1,2}[\/\-](\d{1,2})[\/\-](\d{4})/.test(trimmed)) {
      const parts = trimmed.split(/[\/\-]/);
      if (parts[2]?.length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  };

  const isMatchPeriod = (dateStr: string, createdAt?: number) => {
    if (historyPreset === 'ALL') return true;
    const norm = normalizeDate(dateStr, createdAt);
    if (!norm) return false;
    if (historyPreset === 'THIS_MONTH') return norm.startsWith(thisMonthPrefix);
    if (historyPreset === 'LAST_MONTH') return norm.startsWith(lastMonthPrefix);
    if (historyPreset === 'CUSTOM') {
      if (historyStartDate && norm < historyStartDate) return false;
      if (historyEndDate && norm > historyEndDate) return false;
      return true;
    }
    return true;
  };

  const isMatchSearch = (notes: string, loggedBy: string, amount: number) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    return (
      (notes || '').toLowerCase().includes(q) ||
      (loggedBy || '').toLowerCase().includes(q) ||
      String(amount).includes(q)
    );
  };

  const allAdv = emp.advanceHistory;
  const filteredAdv = allAdv ? [...allAdv].reverse().filter(r => isMatchPeriod(r.date, r.createdAt) && isMatchSearch(r.notes, r.loggedBy, r.amount)) : null;
  const totalAdv = filteredAdv ? filteredAdv.reduce((s, r) => s + r.amount, 0) : 0;

  const allSal = emp.salaryHistory;
  const filteredSal = allSal ? [...allSal].reverse().filter(r => isMatchPeriod(r.date, r.createdAt) && isMatchSearch(r.notes, r.loggedBy, r.netPaid)) : null;
  const totalSal = filteredSal ? filteredSal.reduce((s, r) => s + r.netPaid, 0) : 0;

  const hasActiveFilter = historyPreset !== 'ALL' || !!historyStartDate || !!historyEndDate || !!historySearch.trim();

  // WhatsApp share: capture styled payroll document as image and share or fallback to styled text
  const handleWhatsAppShare = async (targetEmp: Employee) => {
    setIsSharingPayroll(true);
    const toastId = toast.loading('Generating payroll card image...');
    try {
      const advHistory = targetEmp.advanceHistory || [];
      const salHistory = targetEmp.salaryHistory || [];
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
            <span style="display:inline-block;padding:3px 10px;background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;border-radius:12px;">${targetEmp.role}</span>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">ID: ${targetEmp.id}</div>
            ${targetEmp.idNumber ? `<div style="font-size:10px;color:#94a3b8;">NID: ${targetEmp.idNumber}</div>` : ''}
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:18px;">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px;">${targetEmp.firstName} ${targetEmp.lastName}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">MONTHLY SALARY</span>
              <strong style="font-size:14px;color:#0f172a;">${cur} ${targetEmp.salary.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">ADVANCE BALANCE</span>
              <strong style="font-size:14px;color:${(targetEmp.advancePay || 0) > 0 ? '#b45309' : '#0f172a'};">${cur} ${(targetEmp.advancePay || 0).toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">
              <span style="font-size:10px;color:#64748b;font-weight:600;display:block;">NET DUE THIS MONTH</span>
              <strong style="font-size:14px;color:#15803d;">${cur} ${(targetEmp.salary - (targetEmp.advancePay || 0)).toLocaleString()}</strong>
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

        const fileName = `Payroll_${targetEmp.firstName}_${targetEmp.lastName}_${new Date().toISOString().slice(0, 10)}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // If Web Share API supports file sharing (mobile WhatsApp or native share)
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Payroll Record — ${targetEmp.firstName} ${targetEmp.lastName}`,
              text: `Payroll & Advance Pay statement for ${targetEmp.firstName} ${targetEmp.lastName} (${settings.companyName || 'MsikaFlo'})`,
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
Employee: ${targetEmp.firstName} ${targetEmp.lastName} (${targetEmp.role})
Monthly Salary: ${cur} ${targetEmp.salary.toLocaleString()}
Advance Balance: ${cur} ${(targetEmp.advancePay || 0).toLocaleString()}
Net Due: ${cur} ${(targetEmp.salary - (targetEmp.advancePay || 0)).toLocaleString()}

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
  const handlePrintPayrollHistory = (targetEmp: Employee) => {
    const advHistory = targetEmp.advanceHistory || [];
    const salHistory = targetEmp.salaryHistory || [];
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
  <title>Payroll History — ${targetEmp.firstName} ${targetEmp.lastName}</title>
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
  <h1>Payroll History <span class="badge">${targetEmp.role}</span></h1>
  <div class="meta">
    <strong>${targetEmp.firstName} ${targetEmp.lastName}</strong> &nbsp;|&nbsp;
    ID: ${targetEmp.id} &nbsp;|&nbsp;
    Monthly Salary: ${cur} ${targetEmp.salary.toLocaleString()} &nbsp;|&nbsp;
    Current Advance Balance: ${cur} ${(targetEmp.advancePay || 0).toLocaleString()}
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

  <div class="footer">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${settings.companyName || 'MsikaFlo'} Payroll System</div>
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
    <div className="p-1.5 sm:p-3 md:p-8 bg-background min-h-full pb-24 space-y-6 w-full">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
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
        </div>

        {/* WhatsApp & Print Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleWhatsAppShare(emp)}
            disabled={isSharingPayroll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
            title="Generate and share payroll statement image"
          >
            {isSharingPayroll ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            <span>{isSharingPayroll ? 'Creating...' : 'WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrintPayrollHistory(emp)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-card hover:bg-muted text-gray-700 border rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
            title="Print full statement"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        {/* Banner with Summary */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <History size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Payroll &amp; Payment History</h1>
              <p className="text-xs sm:text-sm text-blue-200 mt-0.5">
                {emp.firstName} {emp.lastName} &bull; <span className="text-white font-medium">{emp.role}</span> &bull; ID: <span className="font-mono text-white">{emp.id}</span>
              </p>
            </div>
          </div>

          {/* Financial Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Base Salary</span>
              <span className="font-bold font-mono text-base sm:text-lg text-white">{settings.currency} {emp.salary.toLocaleString()}</span>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Current Advance</span>
              <span className={`font-bold font-mono text-base sm:text-lg ${(emp.advancePay || 0) > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                {settings.currency} {(emp.advancePay || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Net Due</span>
              <span className="font-bold font-mono text-base sm:text-lg text-emerald-300">
                {settings.currency} {Math.max(0, emp.salary - (emp.advancePay || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-tabs: Advances vs Salaries */}
        <div className="flex border-b bg-muted/30 px-5 sm:px-7 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setHistoryTab('advances')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              historyTab === 'advances'
                ? 'border-amber-600 text-amber-700 bg-card rounded-t-xl'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Banknote size={16} className={historyTab === 'advances' ? 'text-amber-600' : ''} />
            <span>Advance History</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              historyTab === 'advances' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-gray-600'
            }`}>
              {(emp.advanceHistory || []).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab('salaries')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              historyTab === 'salaries'
                ? 'border-green-600 text-green-700 bg-card rounded-t-xl'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <CheckCircle size={16} className={historyTab === 'salaries' ? 'text-green-600' : ''} />
            <span>Salary Payments</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              historyTab === 'salaries' ? 'bg-green-100 text-green-900' : 'bg-muted text-gray-600'
            }`}>
              {(emp.salaryHistory || []).length}
            </span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 sm:p-5 bg-muted/15 border-b space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 mr-1 flex items-center gap-1">
                <Filter size={13} /> Filter:
              </span>
              <button
                type="button"
                onClick={() => { setHistoryPreset('ALL'); setHistoryStartDate(''); setHistoryEndDate(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyPreset === 'ALL'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card hover:bg-muted text-gray-700 border'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPreset('THIS_MONTH'); setHistoryStartDate(''); setHistoryEndDate(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyPreset === 'THIS_MONTH'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card hover:bg-muted text-gray-700 border'
                }`}
              >
                This Month ({thisMonthName})
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPreset('LAST_MONTH'); setHistoryStartDate(''); setHistoryEndDate(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyPreset === 'LAST_MONTH'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card hover:bg-muted text-gray-700 border'
                }`}
              >
                Last Month ({lastMonthName})
              </button>
              <button
                type="button"
                onClick={() => setHistoryPreset('CUSTOM')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyPreset === 'CUSTOM'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card hover:bg-muted text-gray-700 border'
                }`}
              >
                Custom Range
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes or staff..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {historyPreset === 'CUSTOM' && (
            <div className="flex items-center gap-3 p-3 bg-muted/40 border rounded-xl flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">From:</span>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={e => setHistoryStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">To:</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={e => setHistoryEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Active Filter Summary Bar */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div>
              {historyTab === 'advances' ? (
                <span>
                  Showing <strong className="text-gray-900">{filteredAdv ? filteredAdv.length : 0}</strong> of {(allAdv || []).length} advance records
                  &bull; Filtered Total: <strong className="font-mono text-amber-700">{settings.currency} {totalAdv.toLocaleString()}</strong>
                </span>
              ) : (
                <span>
                  Showing <strong className="text-gray-900">{filteredSal ? filteredSal.length : 0}</strong> of {(allSal || []).length} salary records
                  &bull; Filtered Total: <strong className="font-mono text-green-700">{settings.currency} {totalSal.toLocaleString()}</strong>
                </span>
              )}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setHistoryPreset('ALL');
                  setHistoryStartDate('');
                  setHistoryEndDate('');
                  setHistorySearch('');
                }}
                className="text-primary hover:underline font-semibold cursor-pointer text-xs"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Records List Body */}
        <div className="p-5 sm:p-7 space-y-3">
          {/* ── ADVANCES TAB BODY ── */}
          {historyTab === 'advances' && (
            allAdv === undefined ? (
              <div className="text-center py-16 text-gray-400">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs">Loading advance records...</p>
                <button
                  type="button"
                  onClick={() => loadAdvanceHistory(emp.id)}
                  className="mt-2 text-xs text-amber-600 hover:underline cursor-pointer"
                >
                  Tap to retry
                </button>
              </div>
            ) : filteredAdv!.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                <History size={40} className="mx-auto mb-2 opacity-30 text-amber-600" />
                <p className="text-base font-semibold text-gray-700">
                  {hasActiveFilter ? 'No advance records found for this period' : 'No advance records on file'}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  {hasActiveFilter
                    ? 'Try selecting a different month, adjusting date boundaries, or clearing search keywords.'
                    : 'Advances recorded via the "Pay Advance" button will appear permanently in this history log.'}
                </p>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPreset('ALL');
                      setHistoryStartDate('');
                      setHistoryEndDate('');
                      setHistorySearch('');
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-card border text-gray-700 rounded-lg text-xs font-semibold hover:bg-muted transition cursor-pointer shadow-xs"
                  >
                    Show All Records
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAdv!.map((rec, i) => (
                  <div
                    key={rec.id}
                    className="bg-card border rounded-xl p-4 hover:border-amber-400 transition shadow-xs flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-amber-200">
                      #{filteredAdv!.length - i}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-amber-900 font-mono text-base sm:text-lg">
                          {settings.currency} {rec.amount.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{rec.date}</span>
                        </div>
                      </div>

                      {rec.notes && (
                        <p className="text-xs sm:text-sm text-gray-700 bg-muted/30 rounded-lg px-3 py-1.5 border border-dashed">
                          {rec.notes}
                        </p>
                      )}
                      <div className="text-[11px] text-gray-400">
                        Logged by: <strong className="text-gray-600">{rec.loggedBy}</strong>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Summary Banner */}
                <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 mt-4">
                  <span className="text-xs sm:text-sm font-bold text-amber-900">
                    {hasActiveFilter ? 'Filtered Total Advances' : 'All-Time Total Advances'}
                  </span>
                  <span className="font-bold font-mono text-amber-900 text-base sm:text-lg">
                    {settings.currency} {totalAdv.toLocaleString()}
                  </span>
                </div>
              </div>
            )
          )}

          {/* ── SALARIES TAB BODY ── */}
          {historyTab === 'salaries' && (
            allSal === undefined ? (
              <div className="text-center py-16 text-gray-400">
                <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs">Loading salary records...</p>
                <button
                  type="button"
                  onClick={() => loadSalaryHistory(emp.id)}
                  className="mt-2 text-xs text-green-600 hover:underline cursor-pointer"
                >
                  Tap to retry
                </button>
              </div>
            ) : filteredSal!.length === 0 ? (
              <div className="text-center py-16 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                <CheckCircle size={40} className="mx-auto mb-2 opacity-30 text-green-600" />
                <p className="text-base font-semibold text-gray-700">
                  {hasActiveFilter ? 'No salary payments found for this period' : 'No salary payments recorded yet'}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  {hasActiveFilter
                    ? 'Try selecting a different month, adjusting date boundaries, or clearing search keywords.'
                    : 'Salary settlements recorded via "Pay Salary" will appear permanently in this history log.'}
                </p>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPreset('ALL');
                      setHistoryStartDate('');
                      setHistoryEndDate('');
                      setHistorySearch('');
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-card border text-gray-700 rounded-lg text-xs font-semibold hover:bg-muted transition cursor-pointer shadow-xs"
                  >
                    Show All Records
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSal!.map((rec, i) => (
                  <div
                    key={rec.id}
                    className="bg-card border rounded-xl p-4 hover:border-green-400 transition shadow-xs flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-xl bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-green-200">
                      #{filteredSal!.length - i}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-green-900 font-mono text-base sm:text-lg">
                            {settings.currency} {rec.netPaid.toLocaleString()}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 bg-green-100 text-green-800 rounded-full border border-green-200">
                            Net Paid
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{rec.date}</span>
                        </div>
                      </div>

                      {/* Pay Breakdown Pill */}
                      <div className="flex items-center gap-3 text-xs bg-muted/40 rounded-lg px-3 py-1.5 text-gray-600 flex-wrap">
                        <span>Base: <strong className="font-mono text-gray-800">{settings.currency} {rec.grossSalary.toLocaleString()}</strong></span>
                        <span>&bull;</span>
                        <span>Advance Deducted: <strong className="font-mono text-amber-700">-{settings.currency} {rec.advanceDeducted.toLocaleString()}</strong></span>
                        <span>&bull;</span>
                        <span>Net Paid: <strong className="font-mono text-green-700">{settings.currency} {rec.netPaid.toLocaleString()}</strong></span>
                      </div>

                      {rec.notes && (
                        <p className="text-xs sm:text-sm text-gray-700 bg-muted/30 rounded-lg px-3 py-1.5 border border-dashed">
                          {rec.notes}
                        </p>
                      )}
                      <div className="text-[11px] text-gray-400">
                        Logged by: <strong className="text-gray-600">{rec.loggedBy}</strong>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Summary Banner */}
                <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-xl px-5 py-3.5 mt-4">
                  <span className="text-xs sm:text-sm font-bold text-green-900">
                    {hasActiveFilter ? 'Filtered Total Net Paid' : 'All-Time Net Salaries Paid'}
                  </span>
                  <span className="font-bold font-mono text-green-900 text-base sm:text-lg">
                    {settings.currency} {totalSal.toLocaleString()}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
