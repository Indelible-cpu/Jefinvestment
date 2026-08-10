import { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useSaleStore } from '../store/dataStore';
import { useAuditStore } from '../store/auditStore';
import { AlertTriangle, ShieldAlert, Trash2, Clock, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const THRESHOLD_OPTIONS = [
  { label: '30 days (1 month)', days: 30 },
  { label: '60 days (2 months)', days: 60 },
  { label: '90 days (3 months) — Recommended', days: 90 },
  { label: '180 days (6 months)', days: 180 },
];

// How often (in days) the system should check if a clear is overdue
const CHECK_INTERVAL_DAYS = 30;

export default function AutoClearPrompt() {
  const { user } = useAuthStore();
  const settings = useSettingsStore();
  const { clearOldSales } = useSaleStore();
  const { clearOldLogs, addLog } = useAuditStore();

  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState(90);
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) return;
    const lastClear = settings.lastDataClearDate ?? 0;
    const daysSinceClear = (Date.now() - lastClear) / (1000 * 60 * 60 * 24);
    if (daysSinceClear >= CHECK_INTERVAL_DAYS) {
      setShowBanner(true);
    }
  }, [isAdmin, settings.lastDataClearDate]);

  if (!isAdmin || !showBanner) return null;

  const getCutoffDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  const handleConfirmClear = async () => {
    setClearing(true);
    try {
      const cutoff = getCutoffDate(selectedDays);
      const cutoffDateStr = cutoff.toISOString().slice(0, 10);
      const cutoffTimestamp = cutoff.getTime();

      await Promise.all([
        clearOldSales(cutoffDateStr),
        clearOldLogs(cutoffTimestamp),
      ]);

      await settings.updateSettings({ lastDataClearDate: Date.now() });
      await addLog(
        'SYSTEM_MAINTENANCE',
        `Admin cleared sales & audit logs older than ${selectedDays} days (before ${cutoffDateStr}).`
      );

      setDone(true);
      setTimeout(() => {
        setShowModal(false);
        setShowBanner(false);
        setDone(false);
      }, 2500);

      toast.success('Old data cleared successfully!', {
        description: `Sales & audit logs older than ${selectedDays} days have been permanently removed.`,
      });
    } catch (err: any) {
      toast.error('Failed to clear data', { description: err.message });
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {/* Dismissible Banner */}
      <div className="relative flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 shadow-sm">
        <Clock size={20} className="text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Monthly Maintenance Due</p>
          <p className="text-xs text-amber-700 mt-0.5">
            It's been over {CHECK_INTERVAL_DAYS} days since the last data cleanup. Review and clear old sales &amp; audit logs to keep the system running smoothly.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition"
          >
            Review &amp; Clear
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="text-amber-400 hover:text-amber-600 transition"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b">
              <div className="bg-red-100 p-2 rounded-full">
                <ShieldAlert size={22} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-base">Confirm Data Cleanup</h2>
                <p className="text-xs text-gray-500">This action is permanent and cannot be undone</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="ml-auto text-gray-400 hover:text-gray-600 transition"
                disabled={clearing}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle size={48} className="text-green-500" />
                  <p className="font-bold text-gray-700">Cleanup Complete!</p>
                  <p className="text-sm text-gray-500">Old records have been permanently deleted.</p>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 space-y-1">
                      <p className="font-semibold">What will be deleted:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-red-600">
                        <li>All <strong>sales records</strong> older than the selected period</li>
                        <li>All <strong>audit logs</strong> older than the selected period</li>
                      </ul>
                      <p className="mt-2 text-xs">Current data (this month) will <strong>NOT</strong> be affected.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delete records older than:
                    </label>
                    <div className="space-y-2">
                      {THRESHOLD_OPTIONS.map(opt => (
                        <label
                          key={opt.days}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            selectedDays === opt.days
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="clearPeriod"
                            value={opt.days}
                            checked={selectedDays === opt.days}
                            onChange={() => setSelectedDays(opt.days)}
                            className="accent-blue-600"
                          />
                          <span className={`text-sm font-medium ${selectedDays === opt.days ? 'text-blue-700' : 'text-gray-700'}`}>
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Records before <strong>{getCutoffDate(selectedDays).toLocaleDateString()}</strong> will be permanently deleted.
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            {!done && (
              <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={clearing}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition text-sm disabled:opacity-50"
                >
                  Cancel — Keep All Data
                </button>
                <button
                  onClick={handleConfirmClear}
                  disabled={clearing}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                      Clearing…
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      Yes, Delete Old Data
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
