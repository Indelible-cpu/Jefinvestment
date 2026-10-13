import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#004bb4] text-white p-4 flex items-center gap-3 shadow">
        <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1.5 rounded-lg transition" aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Terms of Service</h1>
          <p className="text-blue-200 text-xs">MsikaFlo — Indelible Technologies</p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 flex-1 w-full">
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-[#004bb4]" size={28} />
            <div>
              <h2 className="font-bold text-gray-900 text-base">Terms of Service & Usage Agreement</h2>
              <p className="text-gray-400 text-xs">Last updated: 13 October 2026 • Jurisdiction: Republic of Malawi</p>
            </div>
          </div>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">1. Acceptance of Terms</h3>
            <p>
              By accessing, installing, or using the MsikaFlo Enterprise Resource Planning (ERP) and Point of Sale (POS) system, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use or access this platform.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">2. Authorized Business Use & Role-Based Access</h3>
            <p>
              MsikaFlo is provided exclusively for authorized business operations, including point-of-sale management, inventory control, stationery services, expense auditing, and employee administration. Access is granted through distinct role levels (Admin, Manager, Cashier). You agree to keep your credentials confidential and accept responsibility for all transactions executed under your authenticated session.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">3. Offline-First Operations & Data Synchronization</h3>
            <p>
              MsikaFlo operates using an offline-first architecture. Transactions created while disconnected from the internet are stored locally on the terminal and queued for synchronization. Users agree not to intentionally clear local browser data or cache while offline queues are pending, as this may result in unreconciled transaction records.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">4. Data Ownership & Intellectual Property</h3>
            <p>
              All proprietary business data recorded within MsikaFlo—including sales logs, customer ledgers, pricing matrices, and inventory audits—remains the exclusive property of the subscribing business organization. Indelible Technologies operates as a technical service provider and software author, retaining all intellectual property rights over the MsikaFlo platform, underlying software code, branding, and user interface.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">5. System Availability & Service Levels</h3>
            <p>
              While reasonable efforts are maintained to ensure high uptime and cloud reliability via Google Cloud infrastructure, Indelible Technologies is not liable for operational interruptions resulting from local telecommunications failures, power outages, unauthorized hardware alterations, or third-party network downtime.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">6. Modifications to Terms</h3>
            <p>
              Indelible Technologies reserves the right to revise these Terms of Service as new modules, legal compliance mandates, or system capabilities are introduced. Continued use of the MsikaFlo platform following publication of changes signifies complete acceptance of updated terms.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">7. Inquiries & Technical Support</h3>
            <p>
              For legal inquiries, terms clarification, or technical assistance regarding MsikaFlo, contact Indelible Technologies via email at{' '}
              <a href="mailto:indelibletechnologiesmw@gmail.com" className="text-[#004bb4] font-semibold hover:underline">
                indelibletechnologiesmw@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 py-4">MsikaFlo · Powered by Indelible Technologies</div>
    </div>
  );
}
