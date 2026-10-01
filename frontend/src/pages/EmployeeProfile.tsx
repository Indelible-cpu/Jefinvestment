import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Phone, Mail, MapPin, Calendar, HeartHandshake,
  ShieldCheck, ZoomIn, AlertCircle, History, ArrowRight, X, User
} from 'lucide-react';
import { useEmployeeStore } from '../store/dataStore';
import { useSettingsStore } from '../store/settingsStore';

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employees, isLoading, loadEmployees } = useEmployeeStore();
  const settings = useSettingsStore();

  const [zoomedIdImageUrl, setZoomedIdImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (employees.length === 0) {
      loadEmployees();
    }
  }, [employees.length, loadEmployees]);

  const emp = employees.find(e => e.id === id);

  if (isLoading && !emp) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">Loading employee profile...</span>
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
        <p className="text-sm text-gray-500 mb-6">The employee record you are looking for does not exist or has been removed.</p>
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

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 pb-24">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-card border rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-muted transition cursor-pointer shadow-xs"
        >
          <ArrowLeft size={16} />
          <span>Back to Staff Directory</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/employees/${emp.id}/history`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-xs"
          >
            <History size={16} />
            <span>Payroll &amp; Pay History</span>
          </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {emp.photoUrl ? (
              <img
                src={emp.photoUrl}
                alt={emp.firstName}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/20 border-4 border-white/20 flex items-center justify-center text-3xl font-black">
                {emp.firstName?.[0]}{emp.lastName?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold">{emp.firstName} {emp.lastName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                  {emp.status}
                </span>
              </div>
              <p className="text-blue-100 font-medium text-base mt-1">{emp.role}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-blue-200 font-mono flex-wrap">
                <span>System ID: <strong className="text-white">{emp.id}</strong></span>
                {emp.idNumber && <span>&bull; National ID: <strong className="text-white">{emp.idNumber}</strong></span>}
              </div>
            </div>
          </div>

          {/* Compensation Overview Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Monthly Salary</span>
              <span className="font-bold font-mono text-lg text-white">{settings.currency} {emp.salary.toLocaleString()}</span>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xs">
              <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Advance Balance</span>
              <span className={`font-bold font-mono text-lg ${(emp.advancePay || 0) > 0 ? 'text-amber-300' : 'text-white'}`}>
                {settings.currency} {(emp.advancePay || 0).toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/employees/${emp.id}/history`)}
              className="bg-white/20 hover:bg-white/30 rounded-xl px-4 py-3 flex items-center justify-between transition cursor-pointer text-left border border-white/20"
              title="Open full payment & advance history"
            >
              <div>
                <span className="text-blue-200 text-[11px] font-semibold uppercase tracking-wider block">Pay History</span>
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                  View Full Records <ArrowRight size={14} />
                </span>
              </div>
              <History size={20} className="text-amber-300" />
            </button>
          </div>
        </div>

        {/* Profile Details Sections */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Contact & Personal Details */}
          <div className="bg-muted/30 border rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Users size={16} className="text-primary" /> Contact &amp; Particulars
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-gray-400 shrink-0" />
                <span className="text-gray-500">Phone:</span>
                {emp.phone ? (
                  <a href={`tel:${emp.phone}`} className="font-semibold text-primary hover:underline">
                    {emp.phone}
                  </a>
                ) : (
                  <span className="text-gray-400 italic">Not set</span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <span className="text-gray-500">Email:</span>
                {emp.email ? (
                  <a href={`mailto:${emp.email}`} className="font-semibold text-primary hover:underline">
                    {emp.email}
                  </a>
                ) : (
                  <span className="text-gray-400 italic">Not set</span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-gray-400 shrink-0" />
                <span className="text-gray-500">Address:</span>
                <span className="font-medium text-gray-900">{emp.address || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span className="text-gray-500">Date Joined:</span>
                <span className="font-medium text-gray-900">{emp.dateJoined || 'Not set'}</span>
              </div>
            </div>
          </div>

          {/* Next of Kin */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2">
              <HeartHandshake size={16} className="text-rose-600" /> Next of Kin (Emergency Contact)
            </h3>
            {emp.nextOfKinName ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">Contact Name</span>
                  <span className="font-bold text-gray-900 text-base">{emp.nextOfKinName}</span>
                  <span className="text-xs text-rose-700 font-semibold ml-2">({emp.nextOfKinRelationship || 'Kin'})</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">Emergency Phone</span>
                  {emp.nextOfKinPhone ? (
                    <a href={`tel:${emp.nextOfKinPhone}`} className="inline-flex items-center gap-1.5 font-bold text-rose-700 hover:underline">
                      <Phone size={14} /> {emp.nextOfKinPhone}
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">None</span>
                  )}
                </div>
                {emp.nextOfKinAddress && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 text-xs block mb-0.5">Location / Notes</span>
                    <span className="text-gray-800">{emp.nextOfKinAddress}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No Next of Kin details recorded yet.</p>
            )}
          </div>

          {/* National ID Scan */}
          <div className="bg-card border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" /> National ID Document
              </h3>
              {emp.idCardUrl && (
                <button
                  type="button"
                  onClick={() => setZoomedIdImageUrl(emp.idCardUrl || null)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ZoomIn size={14} /> Enlarge Scan
                </button>
              )}
            </div>
            {emp.idCardUrl ? (
              <div
                onClick={() => setZoomedIdImageUrl(emp.idCardUrl || null)}
                className="cursor-pointer group relative w-full h-64 bg-muted rounded-xl border overflow-hidden flex items-center justify-center hover:opacity-95 transition"
              >
                <img src={emp.idCardUrl} alt="ID Scan" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                  <ZoomIn size={18} /> Click to View Full Resolution
                </div>
              </div>
            ) : (
              <div className="text-center p-8 bg-muted/20 border border-dashed rounded-xl text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-1.5 opacity-50" />
                <p className="text-xs">No physical ID card scan attached to this profile.</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-1 flex items-center gap-1 text-sm font-semibold cursor-pointer"
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
    </div>
  );
}
