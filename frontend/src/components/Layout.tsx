import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Users, CreditCard, Package, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSaleStore } from '../store/dataStore';
import { useEffect } from 'react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { companyName, companyLogo, loadSettings } = useSettingsStore();
  const { loadSales } = useSaleStore();
  const location = useLocation();

  useEffect(() => {
    // Initial data load on login/mount
    loadSettings();
    loadSales();
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  const navLinkClass = (path: string) => `flex items-center gap-3 p-3 rounded-lg transition font-medium ${
    location.pathname === path ? 'bg-blue-700 text-white' : 'hover:bg-blue-800 text-blue-100 hover:text-white'
  }`;

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-primary text-primary-foreground flex flex-col shadow-xl z-10">
        {/* Branding Area */}
        <div className="p-5 border-b border-blue-700/50 flex flex-col items-center">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-16 w-16 object-cover bg-white rounded-full p-1 mb-3 shadow-md" />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 shadow-md">
              <span className="text-2xl font-bold">{companyName.charAt(0)}</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-center leading-tight">{companyName}</h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {isAdmin && (
            <Link to="/" className={navLinkClass('/')}>
              <LayoutDashboard size={20} /> <span>Dashboard</span>
            </Link>
          )}
          
          <Link to="/pos" className={navLinkClass('/pos')}>
            <ShoppingCart size={20} /> <span>POS Terminal</span>
          </Link>
          
          <Link to="/sales" className={navLinkClass('/sales')}>
            <ClipboardList size={20} /> <span>Sales</span>
          </Link>
          
          <Link to="/inventory" className={navLinkClass('/inventory')}>
            <Package size={20} /> <span>Inventory</span>
          </Link>
          
          <Link to="/expenses" className={navLinkClass('/expenses')}>
            <Receipt size={20} /> <span>Expenses</span>
          </Link>

          {isAdmin && (
            <>
              <Link to="/credits" className={navLinkClass('/credits')}>
                <CreditCard size={20} /> <span>Credit Sales</span>
              </Link>
              <Link to="/employees" className={navLinkClass('/employees')}>
                <Users size={20} /> <span>Employees & HR</span>
              </Link>
              <Link to="/reports" className={navLinkClass('/reports')}>
                <BarChart3 size={20} /> <span>Reports</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Profile & Footer Actions */}
        <div className="p-4 border-t border-blue-700/50 bg-blue-900/30">
          <Link to="/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 text-blue-100 transition font-medium mb-2">
            <SettingsIcon size={20} /> <span>Settings</span>
          </Link>
          <div className="flex items-center justify-between p-3 bg-blue-950/50 rounded-lg">
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sm truncate">{user?.name}</span>
              <span className="text-xs text-blue-300 capitalize">{user?.role.toLowerCase()}</span>
            </div>
            <button onClick={logout} className="text-blue-300 hover:text-white p-2 hover:bg-red-500/20 rounded transition" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}
