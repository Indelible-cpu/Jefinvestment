import { useState, useEffect } from 'react';
import { Users, UserPlus, CheckCircle, Clock, Banknote, RotateCcw, PlusCircle, Trash2, Edit } from 'lucide-react';
import { useEmployeeStore, type Employee } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from 'sonner';

export default function Employees() {
  const { employees, isLoading, loadEmployees, addEmployee, updateEmployee, updateStatus, recordAdvancePay, recordSalaryPay, clearAdvancePay, deleteEmployee, getTotalAdvancePay } = useEmployeeStore();
  const settings = useSettingsStore();

  useEffect(() => {
    loadEmployees();
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('Cashier');
  const [newSalary, setNewSalary] = useState('');

  // Advance Pay Modal state
  const [selectedEmpForAdvance, setSelectedEmpForAdvance] = useState<Employee | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);

  // Salary Pay Modal state
  const [selectedEmpForSalary, setSelectedEmpForSalary] = useState<Employee | null>(null);
  const [salaryNotes, setSalaryNotes] = useState('');
  const [isSubmittingSalary, setIsSubmittingSalary] = useState(false);

  const openAddModal = () => {
    setEditingEmpId(null);
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewRole('Cashier');
    setNewSalary('');
    setShowAddModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setNewFirstName(emp.firstName);
    setNewLastName(emp.lastName);
    setNewPhone(emp.phone);
    setNewRole(emp.role);
    setNewSalary(emp.salary.toString());
    setShowAddModal(true);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return;

    setIsSubmitting(true);
    try {
      if (editingEmpId) {
        await updateEmployee(editingEmpId, {
          firstName: newFirstName,
          lastName: newLastName,
          phone: newPhone,
          role: newRole,
          salary: Number(newSalary)
        });
        toast.success(`Employee updated successfully.`);
      } else {
        await addEmployee({ firstName: newFirstName, lastName: newLastName, phone: newPhone, role: newRole, salary: Number(newSalary), status: 'PRESENT' });
        toast.success(`Employee ${newFirstName} ${newLastName} added successfully.`);
      }
      setShowAddModal(false);
      setEditingEmpId(null);
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewSalary('');
    } catch (err: any) {
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
    <div className="p-4 md:p-8 bg-background min-h-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Employee &amp; HR Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff records, roles, salary, attendance, and advance payments.</p>
        </div>
        <button onClick={openAddModal} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition shadow-md self-start">
          <UserPlus size={20} /> Add Employee
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-card p-4 md:p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-primary rounded-full">
            <Users size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Total Staff</span>
            <h3 className="text-2xl font-bold">{employees.length}</h3>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-full">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Present Today</span>
            <h3 className="text-2xl font-bold">{employees.filter(e => e.status === 'PRESENT').length}</h3>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">On Leave / Absent</span>
            <h3 className="text-2xl font-bold">{employees.filter(e => e.status !== 'PRESENT').length}</h3>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-full">
            <Banknote size={24} />
          </div>
          <div>
            <span className="text-gray-500 text-sm">Total Advances Paid</span>
            <h3 className="text-2xl font-bold font-mono">{settings.currency} {getTotalAdvancePay().toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Employee Cards - mobile-first */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-card rounded-lg border p-12 text-center text-gray-500">
            <div className="flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-600">Loading employees...</p>
            </div>
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center text-gray-500">
            No employees added yet. Click "Add Employee" to create one.
          </div>
        ) : (
          employees.map(emp => (
            <div key={emp.id} className="bg-card rounded-xl border shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Name & Role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{emp.firstName} {emp.lastName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      emp.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                      emp.status === 'ABSENT' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{emp.status}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{emp.role} {emp.phone ? `· ${emp.phone}` : ''}</div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
                    <span className="font-mono font-medium text-gray-700">Salary: {settings.currency} {emp.salary.toLocaleString()}</span>
                    {(emp.advancePay || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold">
                        <Banknote size={11} /> Advance: {settings.currency} {emp.advancePay?.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No advance</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedEmpForSalary(emp)}
                    className="flex items-center gap-1 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg font-semibold transition shadow-sm"
                    title="Pay Full Salary"
                  >
                    <Banknote size={13} /> Pay Salary
                  </button>
                  <button
                    onClick={() => setSelectedEmpForAdvance(emp)}
                    className="flex items-center gap-1 text-xs bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-lg font-semibold transition shadow-sm"
                    title="Record Advance Pay"
                  >
                    <PlusCircle size={13} /> Pay Advance
                  </button>
                  {(emp.advancePay || 0) > 0 && (
                    <button
                      onClick={() => handleClearAdvance(emp)}
                      className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 border hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium transition"
                      title="Clear Advance Balance"
                    >
                      <RotateCcw size={13} /> Clear
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleStatus(emp.id, emp.status)}
                    className="text-xs bg-gray-100 border hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium transition"
                  >
                    Toggle
                  </button>
                  <button
                    onClick={() => openEditModal(emp)}
                    className="text-xs text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition"
                    title="Edit Employee"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    className="text-xs text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                    title="Delete Employee"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{editingEmpId ? 'Edit Employee' : 'Add New Employee'}</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">First Name *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-2 border rounded"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Last Name *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-2 border rounded"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Phone Number</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Role</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                >
                  <option value="Cashier">Cashier</option>
                  <option value="Technician">Technician</option>
                  <option value="Print Shop Operator">Print Shop Operator</option>
                  <option value="Manager">Manager</option>
                  <option value="Security Guard">Security Guard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Salary ({settings.currency})</label>
                <input 
                  type="number" 
                  className="w-full p-2 border rounded"
                  value={newSalary}
                  onChange={e => setNewSalary(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingEmpId ? 'Save Changes' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Advance Pay Modal */}
      {selectedEmpForAdvance && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEmpForAdvance(null)}>
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border p-6" onClick={e => e.stopPropagation()}>
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
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono text-base bg-white"
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
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                  value={advanceNotes}
                  onChange={e => setAdvanceNotes(e.target.value)}
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                💡 <strong>Note:</strong> Saving this will update the employee's advance balance and automatically record a <strong>Cash Expense</strong> under <em>Salary / Advance Pay</em> for accounting.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedEmpForAdvance(null)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingAdvance}
                  className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-medium shadow-sm transition disabled:opacity-50"
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
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-green-700">
              <Banknote size={24} />
              <h2 className="text-xl font-bold text-foreground">Record Salary Payment</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Recording final salary payment for <strong className="text-gray-900">{selectedEmpForSalary.firstName} {selectedEmpForSalary.lastName}</strong>.
            </p>

            <form onSubmit={handleRecordSalary} className="space-y-4">
              <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-2">
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
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                  value={salaryNotes}
                  onChange={e => setSalaryNotes(e.target.value)}
                />
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 leading-relaxed">
                💡 <strong>Note:</strong> Saving this will record a cash expense for the net payout and clear any pending advance balance for this employee.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedEmpForSalary(null)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingSalary}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm transition disabled:opacity-50"
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
