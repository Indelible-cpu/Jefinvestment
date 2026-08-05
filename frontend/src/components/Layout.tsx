import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Users, CreditCard, Package, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ClipboardList, Menu, Bell, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSaleStore, useCreditStore, useExpenseStore, useEmployeeStore } from '../store/dataStore';
import { useProductStore } from '../store/cartStore';

export default function Layout() {
  const { user, logout, loadProfile } = useAuthStore();
  const { companyName, companyLogo, loadSettings } = useSettingsStore();
  const { products, loadProducts } = useProductStore();
  const { syncPendingSales, sales, loadSales } = useSaleStore();
  const { credits, loadCredits } = useCreditStore();
  const { loadExpenses } = useExpenseStore();
  const { loadEmployees } = useEmployeeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    // Initial data load on mount — always fetched fresh from the server
    loadSettings();
    loadSales();
    loadProducts();
    loadExpenses();
    loadCredits();
    loadEmployees();
    loadProfile();
    syncPendingSales();

    // Auto-refresh ALL data every 30 seconds so every device stays in sync
    const interval = setInterval(() => {
      loadSales();
      loadProducts();
      loadExpenses();
      loadCredits();
      loadEmployees();
      syncPendingSales();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const lowStockCount = products.filter(p => !p.isService && p.stock <= p.reorderLevel).length;
  const overdueCreditCount = credits?.filter(c => c.status === 'OVERDUE').length || 0;
  const pendingSyncCount = sales?.filter(s => s.syncStatus === 'pending').length || 0;
  const notificationCount = lowStockCount + overdueCreditCount + pendingSyncCount;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAdmin = user?.role === 'ADMIN';

  const navRef = useRef<HTMLElement>(null);

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const links = Array.from(navRef.current?.querySelectorAll('a') || []);
      const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
      
      if (currentIndex !== -1) {
        e.preventDefault();
        let nextIndex = currentIndex;
        
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % links.length;
        } else if (e.key === 'ArrowUp') {
          nextIndex = (currentIndex - 1 + links.length) % links.length;
        }
        
        links[nextIndex].focus();
      } else if (links.length > 0) {
        e.preventDefault();
        links[0].focus();
      }
    }
  };

  const navLinkClass = (path: string) => `flex items-center gap-3 p-3 rounded-lg transition font-medium ${
    location.pathname === path ? 'bg-blue-700 text-white' : 'hover:bg-blue-800 text-blue-100 hover:text-white'
  }`;

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-24 bg-[#004bb4] text-white flex items-start justify-between px-4 pt-4 z-20">
        <div className="flex items-start gap-4">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 -ml-1">
            <Menu size={28} />
          </button>
          <div className="flex flex-col mt-0.5">
            <h1 className="font-bold text-xl leading-tight truncate max-w-[200px]">Jef Investment</h1>
            <p className="text-sm text-blue-100 mt-0.5">{greeting}, {user?.name?.split(' ')[0] || 'Jef'} 👋</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-1">
           <div className="relative">
             <button onClick={() => setShowNotifications(!showNotifications)} className="relative cursor-pointer p-1">
               <Bell size={24} />
               {notificationCount > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-[#004bb4]">{notificationCount}</span>
               )}
             </button>
             {showNotifications && (
               <div className="absolute top-10 right-0 w-64 bg-white text-black shadow-xl rounded-lg border p-2 z-[100] text-sm">
                 <h3 className="font-bold border-b pb-2 mb-2 px-2">Notifications</h3>
                 {lowStockCount > 0 && (
                   <div className="p-2 hover:bg-gray-50 rounded cursor-pointer text-red-600" onClick={() => { navigate('/inventory'); setShowNotifications(false); }}>
                     {lowStockCount} items low on stock
                   </div>
                 )}
                 {overdueCreditCount > 0 && (
                   <div className="p-2 hover:bg-gray-50 rounded cursor-pointer text-amber-600" onClick={() => { navigate('/credits'); setShowNotifications(false); }}>
                     {overdueCreditCount} overdue credits
                   </div>
                 )}
                 {notificationCount === 0 && (
                   <div className="p-2 text-gray-400 text-center">No new notifications</div>
                 )}
               </div>
             )}
           </div>
           <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-[#004bb4] overflow-hidden shadow-sm">
             {user?.profilePic ? (
               <img src={user.profilePic} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User size={22} />
             )}
           </div>
        </div>
      </div>

      {/* Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-primary text-primary-foreground flex flex-col shadow-xl z-50 fixed md:relative h-full transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Branding Area */}
        <div className="p-5 border-b border-blue-700/50 flex flex-col items-center pt-8 md:pt-5 relative">
          <div className="hidden md:block absolute top-4 right-4">
            <button onClick={() => setShowNotifications(!showNotifications)} className="text-blue-200 hover:text-white transition relative">
              <Bell size={20} />
              {notificationCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-primary">{notificationCount}</span>
              )}
            </button>
            {showNotifications && (
               <div className="absolute top-8 right-0 w-64 bg-white text-black shadow-xl rounded-lg border p-2 z-[100] text-sm text-left">
                 <h3 className="font-bold border-b pb-2 mb-2 px-2">Notifications</h3>
                 {lowStockCount > 0 && (
                   <div className="p-2 hover:bg-gray-50 rounded cursor-pointer text-red-600" onClick={() => { navigate('/inventory'); setShowNotifications(false); }}>
                     {lowStockCount} items low on stock
                   </div>
                 )}
                 {overdueCreditCount > 0 && (
                   <div className="p-2 hover:bg-gray-50 rounded cursor-pointer text-amber-600" onClick={() => { navigate('/credits'); setShowNotifications(false); }}>
                     {overdueCreditCount} overdue credits
                   </div>
                 )}
                 {notificationCount === 0 && (
                   <div className="p-2 text-gray-400 text-center">No new notifications</div>
                 )}
               </div>
            )}
          </div>
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-16 w-16 object-cover rounded-full overflow-hidden mb-3 shadow-md" />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 shadow-md">
              <span className="text-2xl font-bold">{companyName.charAt(0)}</span>
            </div>
          )}
          <h2 className="text-xl font-bold text-center leading-tight">{companyName}</h2>
        </div>

        {/* Navigation */}
        <nav 
          ref={navRef}
          onKeyDown={handleNavKeyDown}
          className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar"
        >
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
        <div className="p-4 border-t border-blue-700/50 bg-blue-900/30 pb-safe md:pb-4 mt-auto">
          <Link to="/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-800 text-blue-100 transition font-medium mb-4">
            <SettingsIcon size={20} /> <span>Settings</span>
          </Link>
          <div className="flex items-center justify-between p-3 bg-blue-950/50 rounded-lg mb-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="hidden md:flex w-8 h-8 bg-white rounded-full items-center justify-center text-[#004bb4] overflow-hidden shadow-sm shrink-0">
                {user?.profilePic ? (
                  <img src={user.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-sm truncate">{user?.name}</span>
                <span className="text-xs text-blue-300 capitalize">{user?.role.toLowerCase()}</span>
              </div>
            </div>
            <button onClick={logout} className="text-blue-300 hover:text-white p-2 hover:bg-red-500/20 rounded transition" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
          <div className="text-[9px] text-center text-blue-400 opacity-60 font-medium tracking-wide pb-4 md:pb-0 mt-2">
            JIMS ERP. Powered By Indelible Technologies
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto bg-gray-50 pt-24 md:pt-0 pb-16 md:pb-0 h-full w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center pb-safe z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {isAdmin && (
          <Link to="/" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/' ? 'text-primary' : 'text-gray-500'}`}>
            <LayoutDashboard size={20} className="mb-1" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </Link>
        )}
        
        <Link to="/sales" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/sales' ? 'text-primary' : 'text-gray-500'}`}>
          <ClipboardList size={22} className="mb-1" />
          <span className="text-[10px] font-medium mt-0.5">Sales</span>
        </Link>
        
        <Link to="/pos" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/pos' ? 'text-primary' : 'text-gray-500'}`}>
          <ShoppingCart size={22} className="mb-1" />
          <span className="text-[10px] font-medium mt-0.5">POS</span>
        </Link>
        
        <Link to="/inventory" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/inventory' ? 'text-primary' : 'text-gray-500'}`}>
          <Package size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Inventory</span>
        </Link>
        
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`flex flex-col items-center py-2 px-3 text-gray-500`}>
          <Menu size={20} className="mb-1" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </div>
  )
}
