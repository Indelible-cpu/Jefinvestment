import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#004bb4] text-white p-4 flex items-center gap-3 shadow">
        <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1.5 rounded-lg transition" aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Privacy Policy</h1>
          <p className="text-blue-200 text-xs">MsikaFlo — Indelible Technologies</p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 flex-1 w-full">
        <div className="bg-white rounded-2xl shadow-sm border p-8 space-y-6 text-gray-700 text-sm leading-relaxed">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-[#004bb4]" size={28} />
            <div>
              <h2 className="font-bold text-gray-900 text-base">Privacy & Data Protection Policy</h2>
              <p className="text-gray-400 text-xs">Last updated: 13 October 2026 • Jurisdiction: Republic of Malawi</p>
            </div>
          </div>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">1. Scope & Commitment</h3>
            <p>
              Indelible Technologies is committed to safeguarding the privacy and integrity of all operational records managed through the MsikaFlo platform. This Privacy Policy details the capture, retention, processing, and protection of business and personal data within the system.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">2. Information We Collect & Process</h3>
            <p>MsikaFlo collects only data strictly necessary for enterprise resource planning and point-of-sale functionality:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
              <li><strong>User Identity & Credentials:</strong> Email addresses, display names, assigned roles, branch identifiers, and cryptographic password hashes.</li>
              <li><strong>Commercial Records:</strong> Sales receipts, credit sales, payment channels (Cash, Airtel Money, Mpamba, NBS, NBM), line items, discounts, and customer billing references.</li>
              <li><strong>Inventory & Pricing Data:</strong> Product SKUs, categories, supplier costs, retail pricing, stock quantities, and audit adjustments.</li>
              <li><strong>Human Resource Records:</strong> Employee contact information, national identity references, compensation metrics, emergency contacts, and attendance statuses.</li>
              <li><strong>Device & Offline Caches:</strong> Local terminal cache keys, offline transaction queues, and Firebase Cloud Messaging (FCM) push tokens for system alerts.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">3. Storage, Encryption & Security Architecture</h3>
            <p>
              All remote data is housed within Google Cloud Firestore and Firebase Storage using industry-standard TLS encryption in transit and AES-256 encryption at rest. Offline credentials stored locally on terminals are protected with salted SHA-256 cryptographic hashing. Authentication sessions utilize strict token validation protocols.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">4. Third-Party Sharing & Commercial Disclosure</h3>
            <p>
              Indelible Technologies does not trade, rent, monetize, or disclose your enterprise data to third-party advertisers or external data brokers. Data processing is restricted strictly to cloud infrastructure providers (Firebase / Google Cloud) necessary to deliver core platform services.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">5. Data Retention & Administrative Control</h3>
            <p>
              Subscribers maintain administrative sovereignty over their enterprise records. Authorized Administrators may update product catalogues, archive employee files, reconcile credit accounts, or export comprehensive CSV data summaries at any time through the administration dashboards.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">6. Contact & Data Protection Officer</h3>
            <p>
              If you have inquiries, audit requests, or concerns regarding the processing of data within MsikaFlo, contact our team at{' '}
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
