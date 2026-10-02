import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, History, Share2, Printer, Banknote, CheckCircle,
  Filter, Search, User, Loader2, FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useEmployeeStore, useExpenseStore, type Employee, type SalaryPayRecord, type AdvancePayRecord } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export default function EmployeeHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, isLoading, loadEmployees, loadAdvanceHistory, loadSalaryHistory } = useEmployeeStore();
  const { loadExpenses } = useExpenseStore();
  const settings = useSettingsStore();

  const [historyTab, setHistoryTab] = useState<'advances' | 'salaries' | 'statement'>('advances');
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

  const cur = settings.currency || 'MWK';
  const companyName = settings.companyName || 'JEF INVESTMENT';

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

  // ── Calculation helpers to guarantee clear, non-confusing calculations ──
  const getSalaryDeduction = (r: SalaryPayRecord) => {
    if (typeof r.advanceDeducted === 'number' && r.advanceDeducted > 0) {
      return r.advanceDeducted;
    }
    const gross = r.grossSalary || emp.salary;
    return gross > r.netPaid ? gross - r.netPaid : 0;
  };

  const getSalaryGross = (r: SalaryPayRecord) => {
    const deduction = getSalaryDeduction(r);
    return r.grossSalary || (r.netPaid + deduction) || emp.salary;
  };

  // Advance records
  const allAdv: AdvancePayRecord[] = emp.advanceHistory || [];
  const filteredAdv = allAdv.length > 0
    ? [...allAdv].reverse().filter(r => isMatchPeriod(r.date, r.createdAt) && isMatchSearch(r.notes || '', r.loggedBy, r.amount))
    : [];
  const totalAdvances = allAdv.reduce((s, r) => s + r.amount, 0);
  const filteredAdvTotal = filteredAdv.reduce((s, r) => s + r.amount, 0);

  // Salary records
  const allSal: SalaryPayRecord[] = emp.salaryHistory || [];
  const sortedSalDesc = [...allSal].sort((a, b) => b.createdAt - a.createdAt);
  const filteredSal = allSal.length > 0
    ? [...allSal].reverse().filter(r => isMatchPeriod(r.date, r.createdAt) && isMatchSearch(r.notes || '', r.loggedBy, r.netPaid))
    : [];
  const totalSalariesPaid = allSal.reduce((s, r) => s + r.netPaid, 0);
  const filteredSalTotal = filteredSal.reduce((s, r) => s + r.netPaid, 0);

  // Overall summary metrics
  const totalAdvancesRecovered = allSal.reduce((sum, r) => sum + getSalaryDeduction(r), 0);
  const currentAdvanceBalance = emp.advancePay || 0;
  const salaryBalance = Math.max(0, emp.salary - currentAdvanceBalance);
  const latestNetSalaryPaid = sortedSalDesc.length > 0 ? sortedSalDesc[0].netPaid : 0;

  const hasActiveFilter = historyPreset !== 'ALL' || !!historyStartDate || !!historyEndDate || !!historySearch.trim();

  // Print Full Payroll History (optimized for 1-page A4 printing)
  const handlePrintPayrollHistory = (targetEmp: Employee) => {
    const advList = targetEmp.advanceHistory || [];
    const salList = targetEmp.salaryHistory || [];

    const advTotal = advList.reduce((s, r) => s + r.amount, 0);
    const salTotal = salList.reduce((s, r) => s + r.netPaid, 0);
    const advRecovered = salList.reduce((s, r) => s + getSalaryDeduction(r), 0);
    const latestNet = salList.length > 0 ? [...salList].sort((a, b) => b.createdAt - a.createdAt)[0].netPaid : 0;
    const salBal = Math.max(0, targetEmp.salary - (targetEmp.advancePay || 0));

    const advRowsHtml = advList.length
      ? advList.map((r, i) => `
        <tr>
          <td style="padding:4px 6px;text-align:center;font-size:11px;">#${i + 1}</td>
          <td style="padding:4px 6px;font-size:11px;font-weight:600;">${r.date}</td>
          <td style="padding:4px 6px;font-size:11px;font-weight:700;color:#b45309;text-align:right;font-family:monospace;">${cur} ${r.amount.toLocaleString()}</td>
          <td style="padding:4px 6px;font-size:11px;color:#334155;">${r.notes || '—'}</td>
          <td style="padding:4px 6px;font-size:10px;color:#64748b;">${r.loggedBy}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="padding:8px;text-align:center;color:#94a3b8;font-size:11px;">No advance records on file.</td></tr>';

    const salRowsHtml = salList.length
      ? salList.map((r, i) => {
          const gross = getSalaryGross(r);
          const deduction = getSalaryDeduction(r);
          return `
          <tr>
            <td style="padding:4px 6px;text-align:center;font-size:11px;">#${i + 1}</td>
            <td style="padding:4px 6px;font-size:11px;font-weight:600;">${r.date}</td>
            <td style="padding:4px 6px;font-size:11px;text-align:right;font-family:monospace;">${cur} ${gross.toLocaleString()}</td>
            <td style="padding:4px 6px;font-size:11px;color:#b45309;text-align:right;font-family:monospace;">-${cur} ${deduction.toLocaleString()}</td>
            <td style="padding:4px 6px;font-size:11px;font-weight:700;color:#166534;text-align:right;font-family:monospace;">${cur} ${r.netPaid.toLocaleString()}</td>
            <td style="padding:4px 6px;font-size:11px;color:#334155;">${r.notes || '—'}</td>
            <td style="padding:4px 6px;font-size:10px;color:#64748b;">${r.loggedBy}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="padding:8px;text-align:center;color:#94a3b8;font-size:11px;">No salary payment records on file.</td></tr>';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payroll History — ${targetEmp.firstName} ${targetEmp.lastName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 11px;
      color: #0f172a;
      line-height: 1.35;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      padding: 16px 20px;
      border-radius: 6px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
      color: #0f172a;
    }
    .doc-subtitle {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 1px;
      margin-top: 1px;
    }
    .emp-info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .info-cell {
      display: flex;
      flex-direction: column;
    }
    .info-lbl {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 10px 0 4px 0;
      padding-bottom: 2px;
      border-bottom: 1.5px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 4px 6px;
      font-size: 10.5px;
      vertical-align: middle;
    }
    .total-row {
      background: #f8fafc;
      font-weight: 700;
      border-top: 1.5px solid #0f172a;
    }
    .summary-card {
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .summary-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      text-align: center;
    }
    .summary-item {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px 6px;
    }
    .summary-item-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      display: block;
    }
    .summary-item-value {
      font-size: 11.5px;
      font-weight: 800;
      font-family: monospace;
      color: #0f172a;
      margin-top: 1px;
    }
    .summary-item-highlight {
      background: #f0fdf4;
      border-color: #16a34a;
    }
    .summary-item-highlight .summary-item-value {
      color: #15803d;
      font-size: 12px;
    }
    .signatures-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
    }
    .sig-line {
      border-bottom: 1px solid #94a3b8;
      height: 28px;
      margin-bottom: 2px;
    }
    .sig-label {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .footer {
      margin-top: 10px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header-bar">
      <div style="display:flex;align-items:center;gap:12px;">
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-height:46px;max-width:130px;object-fit:contain;background:#fff;padding:2px;border-radius:4px;" />` : ''}
        <div>
          <h1 class="company-title">${companyName}</h1>
          <div class="doc-subtitle">EMPLOYEE PAYROLL HISTORY</div>
        </div>
      </div>
      <div style="text-align:right;">
        <span style="display:inline-block;padding:3px 10px;background:#e0e7ff;color:#1e3a8a;font-weight:700;font-size:10px;border-radius:10px;">OFFICIAL STATEMENT</span>
        <div style="font-size:9.5px;color:#64748b;margin-top:2px;">Employee: ${targetEmp.firstName} ${targetEmp.lastName}</div>
      </div>
    </div>

    <!-- Section 1: Improved Employee Payroll History Header -->
    <div class="emp-info-grid">
      <div class="info-cell">
        <span class="info-lbl">Employee Name</span>
        <span class="info-val">${targetEmp.firstName} ${targetEmp.lastName}</span>
      </div>
      <div class="info-cell">
        <span class="info-lbl">Employee ID</span>
        <span class="info-val font-mono">${targetEmp.id}</span>
      </div>
      <div class="info-cell">
        <span class="info-lbl">Position</span>
        <span class="info-val">${targetEmp.role}</span>
      </div>
      ${targetEmp.department ? `
      <div class="info-cell">
        <span class="info-lbl">Department</span>
        <span class="info-val">${targetEmp.department}</span>
      </div>` : `
      <div class="info-cell">
        <span class="info-lbl">Monthly Salary</span>
        <span class="info-val font-mono">${cur} ${targetEmp.salary.toLocaleString()}</span>
      </div>`}
      ${targetEmp.department ? `
      <div class="info-cell">
        <span class="info-lbl">Monthly Salary</span>
        <span class="info-val font-mono">${cur} ${targetEmp.salary.toLocaleString()}</span>
      </div>` : ''}
      <div class="info-cell">
        <span class="info-lbl">Total Advances</span>
        <span class="info-val font-mono" style="color:#b45309;">${cur} ${advTotal.toLocaleString()}</span>
      </div>
      <div class="info-cell">
        <span class="info-lbl">Current Advance Balance</span>
        <span class="info-val font-mono" style="color:${(targetEmp.advancePay || 0) > 0 ? '#b45309' : '#0f172a'};">${cur} ${(targetEmp.advancePay || 0).toLocaleString()}</span>
      </div>
      <div class="info-cell">
        <span class="info-lbl">Latest Net Salary Paid</span>
        <span class="info-val font-mono" style="color:#15803d;">${cur} ${latestNet.toLocaleString()}</span>
      </div>
    </div>

    <!-- Section 2: Advance Pay Records -->
    <div class="section-title">
      <span>Advance Pay Records (${advList.length})</span>
      <span style="font-weight:700;color:#b45309;">Total: ${cur} ${advTotal.toLocaleString()}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;text-align:center;">#</th>
          <th style="width:90px;">Date</th>
          <th style="width:110px;text-align:right;">Amount</th>
          <th>Reason / Notes</th>
          <th style="width:110px;">Logged By</th>
        </tr>
      </thead>
      <tbody>${advRowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="2" style="text-align:right;text-transform:uppercase;font-size:10px;">Total Advances</td>
          <td style="text-align:right;color:#b45309;font-weight:700;font-family:monospace;">${cur} ${advTotal.toLocaleString()}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    <!-- Section 3 & 4: Salary Pay Records with Clear Calculation Display -->
    <div class="section-title">
      <span>Salary Pay Records (${salList.length})</span>
      <span style="font-weight:700;color:#166534;">Total Net Paid: ${cur} ${salTotal.toLocaleString()}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:30px;text-align:center;">#</th>
          <th style="width:90px;">Date</th>
          <th style="width:105px;text-align:right;">Gross Salary</th>
          <th style="width:115px;text-align:right;">Advances Deducted</th>
          <th style="width:110px;text-align:right;">Net Paid</th>
          <th>Notes</th>
          <th style="width:90px;">Logged By</th>
        </tr>
      </thead>
      <tbody>${salRowsHtml}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align:right;text-transform:uppercase;font-size:10px;">Total Net Salaries Paid</td>
          <td style="text-align:right;color:#166534;font-weight:700;font-family:monospace;">${cur} ${salTotal.toLocaleString()}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>

    <!-- Section 5: Payroll Summary Box -->
    <div class="summary-card">
      <div class="summary-title">Payroll Summary</div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-item-label">Monthly Salary</span>
          <div class="summary-item-value">${cur} ${targetEmp.salary.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Total Advances</span>
          <div class="summary-item-value" style="color:#b45309;">${cur} ${advTotal.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Advances Recovered</span>
          <div class="summary-item-value" style="color:#b45309;">${cur} ${advRecovered.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">Salary Balance</span>
          <div class="summary-item-value">${cur} ${salBal.toLocaleString()}</div>
        </div>
        <div class="summary-item summary-item-highlight">
          <span class="summary-item-label" style="color:#166534;">NET SALARY PAID</span>
          <div class="summary-item-value">${cur} ${salTotal.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <!-- Section 7: Signatures Area -->
    <div class="signatures-row">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Prepared By</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Employee Signature</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Authorized By</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved. Powered by MsikaFlo . Indelible Technologies</span>
      <span>Generated on: ${new Date().toLocaleString()}</span>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  // WhatsApp share: capture styled payroll document as image and share or fallback to download
  const handleWhatsAppShare = async (targetEmp: Employee) => {
    setIsSharingPayroll(true);
    const toastId = toast.loading('Generating payroll statement card...');
    try {
      const advList = targetEmp.advanceHistory || [];
      const salList = targetEmp.salaryHistory || [];
      const advTotal = advList.reduce((s, r) => s + r.amount, 0);
      const salTotal = salList.reduce((s, r) => s + r.netPaid, 0);
      const advRecovered = salList.reduce((s, r) => s + getSalaryDeduction(r), 0);
      const latestNet = salList.length > 0 ? [...salList].sort((a, b) => b.createdAt - a.createdAt)[0].netPaid : 0;
      const salBal = Math.max(0, targetEmp.salary - (targetEmp.advancePay || 0));

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '700px';
      container.style.background = '#ffffff';
      container.style.color = '#0f172a';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.padding = '24px';
      container.style.borderRadius = '14px';
      container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';

      const advRowsHtml = advList.length
        ? advList.map((r, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:6px;color:#64748b;font-size:11px;">#${i + 1}</td>
            <td style="padding:6px;font-size:11px;font-weight:600;">${r.date}</td>
            <td style="padding:6px;font-size:11px;color:#b45309;font-weight:700;text-align:right;">${cur} ${r.amount.toLocaleString()}</td>
            <td style="padding:6px;font-size:11px;color:#475569;">${r.notes || '—'}</td>
            <td style="padding:6px;font-size:10px;color:#94a3b8;">${r.loggedBy}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" style="padding:10px;text-align:center;color:#94a3b8;font-size:11px;">No advance payments recorded.</td></tr>';

      const salRowsHtml = salList.length
        ? salList.map((r, i) => {
            const gross = getSalaryGross(r);
            const deduction = getSalaryDeduction(r);
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:6px;color:#64748b;font-size:11px;">#${i + 1}</td>
              <td style="padding:6px;font-size:11px;font-weight:600;">${r.date}</td>
              <td style="padding:6px;font-size:11px;text-align:right;">${cur} ${gross.toLocaleString()}</td>
              <td style="padding:6px;font-size:11px;color:#b45309;text-align:right;">-${cur} ${deduction.toLocaleString()}</td>
              <td style="padding:6px;font-size:11px;font-weight:700;color:#15803d;text-align:right;">${cur} ${r.netPaid.toLocaleString()}</td>
              <td style="padding:6px;font-size:11px;color:#475569;">${r.notes || '—'}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="6" style="padding:10px;text-align:center;color:#94a3b8;font-size:11px;">No salary payments recorded.</td></tr>';

      container.innerHTML = `
        <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${settings.companyLogo ? `<img src="${settings.companyLogo}" style="max-height:42px;max-width:110px;object-fit:contain;background:#fff;padding:2px;border-radius:4px;" />` : ''}
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:800;color:#0f172a;">${companyName}</h2>
              <div style="font-size:12px;font-weight:700;color:#1e3a8a;margin-top:2px;">EMPLOYEE PAYROLL HISTORY</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;border-radius:10px;">${targetEmp.role}</span>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">ID: ${targetEmp.id}</div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:8px;">${targetEmp.firstName} ${targetEmp.lastName}</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;font-size:11px;">
            <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0;">
              <span style="font-size:9px;color:#64748b;font-weight:600;display:block;">MONTHLY SALARY</span>
              <strong style="color:#0f172a;">${cur} ${targetEmp.salary.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0;">
              <span style="font-size:9px;color:#64748b;font-weight:600;display:block;">TOTAL ADVANCES</span>
              <strong style="color:#b45309;">${cur} ${advTotal.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0;">
              <span style="font-size:9px;color:#64748b;font-weight:600;display:block;">ADVANCE BALANCE</span>
              <strong style="color:${(targetEmp.advancePay || 0) > 0 ? '#b45309' : '#0f172a'};">${cur} ${(targetEmp.advancePay || 0).toLocaleString()}</strong>
            </div>
            <div style="background:#fff;padding:6px 8px;border-radius:6px;border:1px solid #e2e8f0;">
              <span style="font-size:9px;color:#64748b;font-weight:600;display:block;">LATEST NET PAID</span>
              <strong style="color:#15803d;">${cur} ${latestNet.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:800;color:#92400e;margin-bottom:4px;display:flex;justify-content:space-between;">
            <span>Advance Pay Records (${advList.length})</span>
            <span>Total: ${cur} ${advTotal.toLocaleString()}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead>
              <tr style="background:#fef3c7;color:#92400e;font-size:9.5px;text-transform:uppercase;">
                <th style="padding:5px;">#</th>
                <th style="padding:5px;">Date</th>
                <th style="padding:5px;text-align:right;">Amount</th>
                <th style="padding:5px;">Notes</th>
                <th style="padding:5px;">Logged By</th>
              </tr>
            </thead>
            <tbody>${advRowsHtml}</tbody>
          </table>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:800;color:#166534;margin-bottom:4px;display:flex;justify-content:space-between;">
            <span>Salary Pay Records (${salList.length})</span>
            <span>Total Net Paid: ${cur} ${salTotal.toLocaleString()}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead>
              <tr style="background:#dcfce7;color:#166534;font-size:9.5px;text-transform:uppercase;">
                <th style="padding:5px;">#</th>
                <th style="padding:5px;">Date</th>
                <th style="padding:5px;text-align:right;">Gross</th>
                <th style="padding:5px;text-align:right;">Deduction</th>
                <th style="padding:5px;text-align:right;">Net Paid</th>
                <th style="padding:5px;">Notes</th>
              </tr>
            </thead>
            <tbody>${salRowsHtml}</tbody>
          </table>
        </div>

        <!-- Payroll Summary Box -->
        <div style="background:#f8fafc;border:1.5px solid #0f172a;border-radius:8px;padding:10px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;color:#0f172a;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Payroll Summary</div>
          <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;text-align:center;font-size:10px;">
            <div style="background:#fff;border:1px solid #cbd5e1;padding:4px;border-radius:4px;">
              <span style="color:#64748b;font-weight:600;display:block;">MONTHLY SALARY</span>
              <strong style="font-size:11px;color:#0f172a;">${cur} ${targetEmp.salary.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;border:1px solid #cbd5e1;padding:4px;border-radius:4px;">
              <span style="color:#64748b;font-weight:600;display:block;">TOTAL ADVANCES</span>
              <strong style="font-size:11px;color:#b45309;">${cur} ${advTotal.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;border:1px solid #cbd5e1;padding:4px;border-radius:4px;">
              <span style="color:#64748b;font-weight:600;display:block;">ADVANCES RECOVERED</span>
              <strong style="font-size:11px;color:#b45309;">${cur} ${advRecovered.toLocaleString()}</strong>
            </div>
            <div style="background:#fff;border:1px solid #cbd5e1;padding:4px;border-radius:4px;">
              <span style="color:#64748b;font-weight:600;display:block;">SALARY BALANCE</span>
              <strong style="font-size:11px;color:#0f172a;">${cur} ${salBal.toLocaleString()}</strong>
            </div>
            <div style="background:#f0fdf4;border:1px solid #16a34a;padding:4px;border-radius:4px;">
              <span style="color:#166534;font-weight:700;display:block;">NET SALARY PAID</span>
              <strong style="font-size:12px;color:#15803d;">${cur} ${salTotal.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;">
          <span>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved. Powered by MsikaFlo . Indelible Technologies</span>
          <span>Generated on ${new Date().toLocaleString()}</span>
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

        const fileName = `Payroll_History_${targetEmp.firstName}_${targetEmp.lastName}_${new Date().toISOString().slice(0, 10)}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Payroll History — ${targetEmp.firstName} ${targetEmp.lastName}`,
              text: `Payroll History statement for ${targetEmp.firstName} ${targetEmp.lastName} (${companyName})`,
            });
            toast.success('Shared successfully!', { id: toastId });
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
          toast.success('Payroll History image downloaded!', { id: toastId });
        }
        setIsSharingPayroll(false);
      }, 'image/png');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate statement image: ' + err.message, { id: toastId });
      setIsSharingPayroll(false);
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

        {/* Action Buttons: Generate Payslip, WhatsApp & Print */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/employees/${emp.id}/payslip`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
            title="View Monthly Payslip document"
          >
            <FileText size={16} />
            <span>Generate Payslip</span>
          </button>
          <button
            type="button"
            onClick={() => handleWhatsAppShare(emp)}
            disabled={isSharingPayroll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
            title="Share full statement image"
          >
            {isSharingPayroll ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            <span>{isSharingPayroll ? 'Creating...' : 'WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrintPayrollHistory(emp)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-card hover:bg-muted text-gray-700 border rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
            title="Print full statement or save as PDF"
          >
            <Printer size={16} />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        {/* Section 1: Improved Employee Payroll History Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {settings.companyLogo ? (
                <img
                  src={settings.companyLogo}
                  alt={companyName}
                  className="h-12 w-auto max-w-[120px] object-contain rounded-xl bg-white p-1 shadow-sm shrink-0"
                />
              ) : (
                <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <History size={22} />
                </span>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
                    EMPLOYEE PAYROLL HISTORY
                  </span>
                  <span className="text-white/40 text-xs">&bull;</span>
                  <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                    {companyName}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight text-white mt-0.5">
                  {emp.firstName} {emp.lastName}
                </h1>
                <p className="text-xs text-blue-200 mt-0.5">
                  Position: <strong className="text-white font-medium">{emp.role}</strong> &bull; ID: <strong className="font-mono text-white">{emp.id}</strong>
                  {emp.department ? <> &bull; Dept: <strong className="text-white font-medium">{emp.department}</strong></> : null}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-blue-200 block">Monthly Base Salary</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {cur} {emp.salary.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Dynamic Header Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider block">Monthly Salary</span>
              <span className="font-bold font-mono text-sm sm:text-base text-white">{cur} {emp.salary.toLocaleString()}</span>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider block">Total Advances</span>
              <span className="font-bold font-mono text-sm sm:text-base text-amber-300">
                {cur} {totalAdvances.toLocaleString()}
              </span>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider block">Current Advance Balance</span>
              <span className={`font-bold font-mono text-sm sm:text-base ${currentAdvanceBalance > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                {cur} {currentAdvanceBalance.toLocaleString()}
              </span>
            </div>
            <div className="bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider block">Latest Net Salary Paid</span>
              <span className="font-bold font-mono text-sm sm:text-base text-emerald-300">
                {cur} {latestNetSalaryPaid.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-tabs: Advances vs Salaries vs Complete Statement */}
        <div className="flex border-b bg-muted/30 px-5 sm:px-7 gap-2 pt-2 flex-wrap">
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
            <span>Advance Pay Records</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              historyTab === 'advances' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-gray-600'
            }`}>
              {allAdv.length}
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
            <span>Salary Pay Records</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              historyTab === 'salaries' ? 'bg-green-100 text-green-900' : 'bg-muted text-gray-600'
            }`}>
              {allSal.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryTab('statement')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              historyTab === 'statement'
                ? 'border-blue-600 text-blue-700 bg-card rounded-t-xl'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <History size={16} className={historyTab === 'statement' ? 'text-blue-600' : ''} />
            <span>Full History &amp; Summary</span>
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
              {historyTab === 'advances' && (
                <span>
                  Showing <strong className="text-gray-900">{filteredAdv.length}</strong> of {allAdv.length} advance records
                  &bull; Filtered Total: <strong className="font-mono text-amber-700">{cur} {filteredAdvTotal.toLocaleString()}</strong>
                </span>
              )}
              {historyTab === 'salaries' && (
                <span>
                  Showing <strong className="text-gray-900">{filteredSal.length}</strong> of {allSal.length} salary records
                  &bull; Filtered Total: <strong className="font-mono text-green-700">{cur} {filteredSalTotal.toLocaleString()}</strong>
                </span>
              )}
              {historyTab === 'statement' && (
                <span>
                  All-Time Advances: <strong className="font-mono text-amber-700">{cur} {totalAdvances.toLocaleString()}</strong>
                  &nbsp;&bull;&nbsp;
                  All-Time Salaries Paid: <strong className="font-mono text-green-700">{cur} {totalSalariesPaid.toLocaleString()}</strong>
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
        <div className="p-5 sm:p-7 space-y-6">
          {/* ── ADVANCES TAB BODY (Section 2: Clean Table) ── */}
          {(historyTab === 'advances' || historyTab === 'statement') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <Banknote size={16} className="text-amber-700" />
                  <span>Advance Pay Records ({filteredAdv.length})</span>
                </h3>
                <span className="text-xs font-mono font-bold text-amber-800">
                  Total: {cur} {filteredAdvTotal.toLocaleString()}
                </span>
              </div>

              {filteredAdv.length === 0 ? (
                <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                  <History size={36} className="mx-auto mb-2 opacity-30 text-amber-600" />
                  <p className="text-sm font-semibold text-gray-700">No genuine advance records for this selection</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Only authentic employee advances appear here. Normal salary payments are never mixed into this section.
                  </p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-50/80 text-amber-950 font-bold uppercase tracking-wider border-b border-amber-200">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 w-28">Date</th>
                          <th className="py-2.5 px-3 w-32 text-right">Amount</th>
                          <th className="py-2.5 px-3">Reason / Notes</th>
                          <th className="py-2.5 px-3 w-32">Logged By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAdv.map((rec, i) => (
                          <tr key={rec.id} className="hover:bg-amber-50/40 transition">
                            <td className="py-2.5 px-3 text-center font-bold text-gray-400">
                              #{filteredAdv.length - i}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800 font-mono">
                              {rec.date}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                              {cur} {rec.amount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {rec.notes || <span className="text-gray-400 italic">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                              {rec.loggedBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-amber-50 border-t-2 border-amber-300 font-bold text-amber-950">
                          <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-[11px]">
                            Total Advances:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-amber-900">
                            {cur} {filteredAdvTotal.toLocaleString()}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SALARIES TAB BODY (Section 3 & 4: Clear Calculation Display) ── */}
          {(historyTab === 'salaries' || historyTab === 'statement') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-green-900 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-700" />
                  <span>Salary Pay Records ({filteredSal.length})</span>
                </h3>
                <span className="text-xs font-mono font-bold text-green-800">
                  Total Net Paid: {cur} {filteredSalTotal.toLocaleString()}
                </span>
              </div>

              {filteredSal.length === 0 ? (
                <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl bg-muted/20">
                  <CheckCircle size={36} className="mx-auto mb-2 opacity-30 text-green-600" />
                  <p className="text-sm font-semibold text-gray-700">No salary payment records for this selection</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Settled salaries recorded via &ldquo;Pay Salary&rdquo; appear here with full gross, advance deductions, and net payouts.
                  </p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-green-50/80 text-green-950 font-bold uppercase tracking-wider border-b border-green-200">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 w-28">Date</th>
                          <th className="py-2.5 px-3 w-32 text-right">Gross Salary</th>
                          <th className="py-2.5 px-3 w-36 text-right">Advances Deducted</th>
                          <th className="py-2.5 px-3 w-32 text-right">Net Paid</th>
                          <th className="py-2.5 px-3">Notes</th>
                          <th className="py-2.5 px-3 w-28">Logged By</th>
                          <th className="py-2.5 px-3 w-24 text-center">Payslip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredSal.map((rec, i) => {
                          const gross = getSalaryGross(rec);
                          const deduction = getSalaryDeduction(rec);
                          return (
                            <tr key={rec.id} className="hover:bg-green-50/40 transition">
                              <td className="py-2.5 px-3 text-center font-bold text-gray-400">
                                #{filteredSal.length - i}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800 font-mono">
                                {rec.date}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-700">
                                {cur} {gross.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                                -{cur} {deduction.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-green-800 text-sm">
                                {cur} {rec.netPaid.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">
                                {rec.notes || <span className="text-gray-400 italic">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                                {rec.loggedBy}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/employees/${emp.id}/payslip?record=${rec.id}`)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                  title="View Monthly Payslip document for this salary payment"
                                >
                                  <FileText size={12} />
                                  <span>Payslip</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-50 border-t-2 border-green-300 font-bold text-green-950">
                          <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px]">
                            Total Net Salaries Paid:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-green-900">
                            {cur} {filteredSalTotal.toLocaleString()}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Section 5: PAYROLL SUMMARY BOX ── */}
          <div className="bg-card border-2 border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Banknote size={16} />
                </span>
                <h3 className="font-extrabold uppercase tracking-wider text-slate-900 text-sm">
                  PAYROLL SUMMARY
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Dynamic calculations from payroll records
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-muted/30 border rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Monthly Salary
                </span>
                <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
                  {cur} {emp.salary.toLocaleString()}
                </div>
              </div>

              <div className="bg-muted/30 border rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Total Advances
                </span>
                <div className="text-base font-extrabold font-mono text-amber-800 mt-1">
                  {cur} {totalAdvances.toLocaleString()}
                </div>
              </div>

              <div className="bg-muted/30 border rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Advances Recovered
                </span>
                <div className="text-base font-extrabold font-mono text-amber-800 mt-1">
                  {cur} {totalAdvancesRecovered.toLocaleString()}
                </div>
              </div>

              <div className="bg-muted/30 border rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Salary Balance
                </span>
                <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
                  {cur} {salaryBalance.toLocaleString()}
                </div>
              </div>

              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                  NET SALARY PAID
                </span>
                <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1">
                  {cur} {totalSalariesPaid.toLocaleString()}
                </div>
              </div>
            </div>

            {/* System Footer matching system standards */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">
                &copy; {new Date().getFullYear()} {companyName}. All rights reserved. Powered by MsikaFlo . Indelible Technologies
              </p>
              <p className="text-[10px] text-slate-400">
                Generated on {new Date().toLocaleString()} &bull; Official Employee Payroll History Record
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
