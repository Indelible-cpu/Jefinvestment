import { useEffect, useState } from 'react';
import { useAuditStore } from '../store/auditStore';
import { ShieldAlert, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditLogs() {
  const { logs, loadLogs } = useAuditStore();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
      <div className="bg-gray-50 p-4 border-b font-bold text-gray-700 flex items-center gap-2">
        <ShieldAlert size={18} className="text-red-500" /> System Audit Logs
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">No audit logs found.</td>
              </tr>
            ) : (
              paginated.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 flex items-center gap-1.5">
                    <Clock size={12} /> {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">{log.user}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-red-100 text-red-700 font-semibold rounded-md text-xs">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {logs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-xs text-gray-500">
              Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, logs.length)} of {logs.length} logs
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border bg-white rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 border bg-white rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
