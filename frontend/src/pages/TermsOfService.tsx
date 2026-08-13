import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#004bb4] text-white p-4 flex items-center gap-3 shadow">
        <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1.5 rounded-lg transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Terms of Service</h1>
          <p className="text-blue-200 text-xs">StoreSight — Indelible Technologies</p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-[#004bb4]" size={28} />
            <div>
              <h2 className="font-bold text-gray-900 text-base">Terms of Service</h2>
              <p className="text-gray-400 text-xs">Last updated: August 2026</p>
            </div>
          </div>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">1. Acceptance of Terms</h3>
            <p>By accessing or using StoreSight, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use this system.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">2. Use of the System</h3>
            <p>StoreSight is provided exclusively for authorized business use by StoreSight and its employees. Unauthorized access, sharing of credentials, or misuse of business data is strictly prohibited.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">3. Data Ownership</h3>
            <p>All business data entered into StoreSight (sales, inventory, expenses, etc.) remains the property of StoreSight. Indelible Technologies acts as a processor and will never share or sell your business data to third parties.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">4. System Availability</h3>
            <p>While we strive for maximum uptime, StoreSight operates with offline-first capabilities. Indelible Technologies is not liable for temporary disruptions caused by network outages or scheduled maintenance.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">5. Changes to Terms</h3>
            <p>Indelible Technologies reserves the right to update these Terms of Service at any time. Continued use of the system after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">6. Contact</h3>
            <p>For questions regarding these terms, please contact Indelible Technologies at <span className="text-[#004bb4] font-semibold">support@indelibletechnologies.com</span>.</p>
          </section>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400 py-4">StoreSight · Powered by Indelible Technologies</div>
    </div>
  );
}
