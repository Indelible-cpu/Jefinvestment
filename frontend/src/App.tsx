import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Route-level code splitting — each page is only loaded when visited
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Sales = lazy(() => import('./pages/Sales'));
const CreditManagement = lazy(() => import('./pages/CreditManagement'));
const Employees = lazy(() => import('./pages/Employees'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const StationeryServices = lazy(() => import('./pages/StationeryServices'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen w-full bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500 font-medium">Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Admin only routes */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route index element={<Dashboard />} />
                <Route path="credits" element={<CreditManagement />} />
                <Route path="employees" element={<Employees />} />
                <Route path="stationery-services" element={<StationeryServices />} />
                <Route path="reports" element={<Reports />} />
              </Route>

              {/* Shared routes (Admin + Cashier) */}
              <Route path="pos" element={<POS />} />
              <Route path="sales" element={<Sales />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
