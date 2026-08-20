import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#004bb4] text-white p-4 flex items-center gap-3 shadow">
        <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1.5 rounded-lg transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Privacy Policy</h1>
          <p className="text-blue-200 text-xs">MsikaFlo — Indelible Technologies</p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-[#004bb4]" size={28} />
            <div>
              <h2 className="font-bold text-gray-900 text-base">Privacy Policy</h2>
              <p className="text-gray-400 text-xs">Last updated: August 2026</p>
            </div>
          </div>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">1. Information We Collect</h3>
            <p>MsikaFlo collects only the business information you enter, including sales records, inventory data, expense logs, employee profiles, and customer credit records. No personal browsing data or device information is shared externally.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">2. How We Use Your Data</h3>
            <p>All data is used exclusively for operating the MsikaFlo system — generating reports, managing inventory, processing sales, and providing system analytics for MsikaFlo. We do not use your data for advertising or profiling.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">3. Data Storage & Security</h3>
            <p>Your data is securely stored on cloud servers with encryption at rest and in transit. Local offline copies are maintained for performance. Indelible Technologies implements industry-standard security measures to protect your business data.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">4. Data Sharing</h3>
            <p>We do not sell, trade, or rent your business data to any third party. Data may only be disclosed if required by law or to prevent fraud.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">5. Your Rights</h3>
            <p>You have the right to access, correct, or request deletion of your business data at any time. Contact Indelible Technologies to exercise these rights.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">6. Contact</h3>
            <p>For privacy concerns, contact us at <span className="text-[#004bb4] font-semibold">privacy@indelibletechnologies.com</span>.</p>
          </section>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 py-4">MsikaFlo · Powered by Indelible Technologies</div>
    </div>
  );
}
