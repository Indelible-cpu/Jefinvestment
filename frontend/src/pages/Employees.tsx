import { useState } from 'react';
import { Users, UserPlus, CheckCircle, Clock, Banknote, RotateCcw, PlusCircle, Trash2 } from 'lucide-react';
import { useEmployeeStore, Employee } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from 'sonner';

export default function Employees() {
  const { employees, addEmployee, updateStatus, recordAdvancePay, clearAdvancePay, deleteEmployee, getTotalAdvancePay } = useEmployeeStore();
  const settings = useSettingsStore();

  const [showAddModal, setShowAddModal] = useState(false);
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

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return;

    addEmployee({ firstName: newFirstName, lastName: newLastName, phone: newPhone, role: newRole, salary: Number(newSalary), status: 'PRESENT' });
    toast.success(`Employee ${newFirstName} ${newLastName} added successfully.`);
    setShowAddModal(false);
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewSalary('');
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

  const handleClearAdvance = async (emp: Employee) => {
    if (!emp.advancePay || emp.advancePay <= 0) return;
    if (confirm(`Reset advance pay balance (${settings.currency} ${emp.advancePay.toLocaleString()}) for ${emp.firstName} ${emp.lastName}? Use this when monthly salary has been settled.`)) {
      await clearAdvancePay(emp.id);
      toast.success(`Advance pay balance cleared for ${emp.firstName}.`);
    }
  };

  const handleDelete = (emp: Employee) => {
    if (confirm(`Are you sure you want to remove employee "${emp.firstName} ${emp.lastName}"?`)) {
      deleteEmployee(emp.id);
      toast.success(`Employee "${emp.firstName} ${emp.lastName}" removed.`);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-background min-h-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Employee &amp; HR Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff records, roles, salary, attendance, and advance payments.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow self-start"
        >
          <UserPlus size={18} />
          Add Employee
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

      {/* Employee Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4">Name</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Role</th>
              <th className="p-4">Monthly Salary</th>
              <th className="p-4">Advance Pay</th>
              <th className="p-4">Attendance</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No employees added yet. Click "Add Employee" to create one.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold">{emp.firstName} {emp.lastName}</td>
                  <td className="p-4 text-gray-600">{emp.phone || '-'}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-gray-100 border text-gray-700 rounded-full text-xs font-medium">
                      {emp.role}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-medium">{settings.currency} {emp.salary.toLocaleString()}</td>
                  <td className="p-4 font-mono">
                    {(emp.advancePay || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold">
                        <Banknote size={12} />
                        {settings.currency} {emp.advancePay?.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      emp.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                      emp.status === 'ABSENT' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-1.5">
                    <button 
                      onClick={() => setSelectedEmpForAdvance(emp)}
                      className="text-xs bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 px-2.5 py-1.5 rounded font-medium transition inline-flex items-center gap-1"
                      title="Record Advance Pay"
                    >
                      <PlusCircle size={13} />
                      Pay Advance
                    </button>
                    {(emp.advancePay || 0) > 0 && (
                      <button 
                        onClick={() => handleClearAdvance(emp)}
                        className="text-xs bg-gray-100 text-gray-700 border hover:bg-gray-200 px-2 py-1.5 rounded font-medium transition inline-flex items-center gap-1"
                        title="Clear / Settle Advance Pay Balance"
                      >
                        <RotateCcw size={13} />
                        Clear
                      </button>
                    )}
                    <button 
                      onClick={() => handleToggleStatus(emp.id, emp.status)}
                      className="text-xs bg-gray-100 border hover:bg-gray-200 px-2.5 py-1.5 rounded font-medium transition"
                    >
                      Toggle
                    </button>
                    <button 
                      onClick={() => handleDelete(emp)}
                      className="text-xs text-red-600 hover:bg-red-50 p-1.5 rounded transition inline-flex items-center"
                      title="Delete Employee"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-card w-full max-w-md rounded-lg shadow-lg border p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Add New Employee</h2>
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
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700 font-medium"
                >
                  Save Employee
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
    </div>
  );
}
