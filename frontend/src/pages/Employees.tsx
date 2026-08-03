import { useState } from 'react';
import { Users, UserPlus, CheckCircle, Clock } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  salary: number;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE';
}

const mockEmployees: Employee[] = [
  { id: '1', firstName: 'Chifundo', lastName: 'Banda', phone: '+265 999 123 456', role: 'Cashier', salary: 150000, status: 'PRESENT' },
  { id: '2', firstName: 'Kondwani', lastName: 'Phiri', phone: '+265 888 654 321', role: 'Technician', salary: 200000, status: 'PRESENT' },
  { id: '3', firstName: 'Mercy', lastName: 'Mwale', phone: '+265 991 112 233', role: 'Print Shop Operator', salary: 140000, status: 'LEAVE' },
];

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('Cashier');
  const [newSalary, setNewSalary] = useState('');

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return;

    const newEmp: Employee = {
      id: Date.now().toString(),
      firstName: newFirstName,
      lastName: newLastName,
      phone: newPhone,
      role: newRole,
      salary: parseFloat(newSalary) || 0,
      status: 'PRESENT'
    };

    setEmployees([...employees, newEmp]);
    setShowAddModal(false);
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewSalary('');
  };

  const toggleAttendance = (id: string) => {
    setEmployees(employees.map(emp => {
      if (emp.id === id) {
        const nextStatus: Employee['status'] = emp.status === 'PRESENT' ? 'ABSENT' : emp.status === 'ABSENT' ? 'LEAVE' : 'PRESENT';
        return { ...emp, status: nextStatus };
      }
      return emp;
    }));
  };

  return (
    <div className="p-8 bg-background min-h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee & HR Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff records, roles, salary, and daily attendance.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow"
        >
          <UserPlus size={18} />
          Add Employee
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-lg border shadow-sm flex items-center gap-4">
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
      </div>

      {/* Employee Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600 text-sm font-semibold">
              <th className="p-4">Name</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Role</th>
              <th className="p-4">Monthly Salary (MWK)</th>
              <th className="p-4">Today's Attendance</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50 transition">
                <td className="p-4 font-semibold">{emp.firstName} {emp.lastName}</td>
                <td className="p-4 text-gray-600">{emp.phone || '-'}</td>
                <td className="p-4">
                  <span className="px-2.5 py-1 bg-gray-100 border text-gray-700 rounded-full text-xs font-medium">
                    {emp.role}
                  </span>
                </td>
                <td className="p-4 font-mono font-medium">MWK {emp.salary.toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    emp.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                    emp.status === 'ABSENT' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {emp.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => toggleAttendance(emp.id)}
                    className="text-xs bg-gray-100 border hover:bg-gray-200 px-3 py-1.5 rounded font-medium transition"
                  >
                    Toggle Status
                  </button>
                </td>
              </tr>
            ))}
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
                  <label className="block text-xs font-semibold mb-1">First Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-2 border rounded"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Last Name</label>
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
                <label className="block text-xs font-semibold mb-1">Salary (MWK)</label>
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
    </div>
  );
}
