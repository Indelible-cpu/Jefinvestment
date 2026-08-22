import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Users, CreditCard, Package, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ClipboardList, Menu, Bell, User, CloudOff, CloudUpload, Cloud, Printer, Lock, Search, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSaleStore, useCreditStore, useExpenseStore } from '../store/dataStore';
import { useProductStore, useCartStore } from '../store/cartStore';
import { useSyncQueueStore } from '../store/syncQueueStore';
import { toast } from 'sonner';

export default function Layout() {

  const { user, logout, loadProfile, unlockTemporarily, passwordRequests, loadPasswordRequests } = useAuthStore();
  const { companyName, companyLogo, loadSettings, autoLockEnabled, workTimeStart, workTimeEnd, idleLockMinutes } = useSettingsStore();

  // Use fine-grained selectors — subscribes only to what Layout needs,
  // so a sale or stock change doesn't re-render the entire sidebar
  const products = useProductStore(s => s.products);
  const loadProducts = useProductStore(s => s.loadProducts);
  const { loadHeldCarts } = useCartStore();
  const { loadSales } = useSaleStore();
  const credits = useCreditStore(s => s.credits);
  const loadCredits = useCreditStore(s => s.loadCredits);
  const { loadExpenses } = useExpenseStore();
  const { queue, isSyncing, syncAll } = useSyncQueueStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const location = useLocation();
  const navigate = useNavigate();

  // References for the notifications dropdown to detect outside clicks
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  const desktopNotifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedMobile = mobileNotifRef.current?.contains(target);
      const clickedDesktop = desktopNotifRef.current?.contains(target);
      
      if (!clickedMobile && !clickedDesktop) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Swipe detection state
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = currentTouch - touchStart;
    // Open if starting from the left edge (< 40px) and swiping right (> 50px)
    if (diff > 50 && touchStart < 40) {
      setMobileMenuOpen(true);
      setTouchStart(null);
    }
    // Close if swiping left (> 50px) while open
    if (diff < -50 && mobileMenuOpen) {
      setMobileMenuOpen(false);
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  const handleLogout = async () => {
    const name = useAuthStore.getState().user?.name || 'User';
    await logout();
    toast.success(`Goodbye, ${name}!`, { description: 'You have been signed out successfully.' });
    navigate('/login', { replace: true });
  };

  // Computed once per render cycle — stable reference
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  useEffect(() => {
    // Critical data — loads on mount
    loadSettings();
    loadProducts();
    loadSales();
    loadProfile();

    // Secondary data — staggered so startup feels instant
    const t1 = setTimeout(() => { loadExpenses(); loadCredits(); }, 400);
    const t2 = setTimeout(() => syncAll(), 1000);
    // Employees and StationeryServices are loaded lazily by their own pages

    if (user?.id) {
      const t3 = setTimeout(() => loadHeldCarts(user.id), 300);
      if (user.role === 'ADMIN') {
        const t4 = setTimeout(() => loadPasswordRequests(), 600);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
      }
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [user?.id, user?.role]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncAll();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // System Lock Logic
  useEffect(() => {
    const checkLockStatus = () => {
      if (!autoLockEnabled) {
        setIsSystemLocked(false);
        return;
      }
      
      const now = new Date();
      const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      let isOutsideWorkingHours = false;
      const start = workTimeStart || '08:00';
      const end = workTimeEnd || '20:00';
      
      if (start <= end) {
        isOutsideWorkingHours = currentTimeStr < start || currentTimeStr >= end;
      } else {
        isOutsideWorkingHours = currentTimeStr < start && currentTimeStr >= end;
      }

      const { isTemporarilyUnlocked, lastActiveTime, lockSystem } = useAuthStore.getState();

      if (isOutsideWorkingHours) {
        if (isTemporarilyUnlocked) {
          const idleMinutes = (Date.now() - lastActiveTime) / (1000 * 60);
          if (idleMinutes >= (idleLockMinutes || 10)) {
            lockSystem();
            setIsSystemLocked(true);
          } else {
            setIsSystemLocked(false);
          }
        } else {
          setIsSystemLocked(true);
        }
      } else {
        setIsSystemLocked(false);
        if (isTemporarilyUnlocked) lockSystem();
      }
    };

    checkLockStatus(); // Check immediately
    const interval = setInterval(checkLockStatus, 60000); // Check every minute

    // Activity listeners
    const handleActivity = () => {
      useAuthStore.getState().updateActivity();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [autoLockEnabled, workTimeStart, workTimeEnd, idleLockMinutes]);

  const lowStockItems = useMemo(() => products.filter(p => !p.isService && !p.isEquipment && p.stock <= p.reorderLevel), [products]);
  const lowStockCount = lowStockItems.length;
  const overdueCreditCount = useMemo(() => credits?.filter(c => c.status === 'OVERDUE').length || 0, [credits]);
  const pendingPasswordRequests = useMemo(() => (passwordRequests || []).filter(r => r.status === 'PENDING'), [passwordRequests]);
  const passwordRequestCount = user?.role === 'ADMIN' ? pendingPasswordRequests.length : 0;
  const notificationCount = lowStockCount + overdueCreditCount + passwordRequestCount;

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

  const navLinkClass = (path: string, hideOnMobile = false) => `${hideOnMobile ? 'hidden md:flex' : 'flex'} items-center gap-3 p-3 rounded-lg transition font-medium ${
    location.pathname === path ? 'bg-blue-700 text-white' : 'hover:bg-blue-800 text-blue-100 hover:text-white'
  }`;

  if (isSystemLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-t-8 border-primary relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-32 bg-primary/10 -mt-16 rounded-[100%] scale-150 pointer-events-none"></div>
          
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
            <Lock size={40} className="text-primary" />
          </div>
          
          <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">System Locked</h1>
          <p className="text-gray-500 mb-8 font-medium">
            Operating hours are from <span className="font-bold text-gray-800">{workTimeStart}</span> to <span className="font-bold text-gray-800">{workTimeEnd}</span>. Access is currently restricted.
          </p>

          {isAdmin ? (
            <div className="space-y-3">
              <button
                onClick={() => {
                  unlockTemporarily();
                  setIsSystemLocked(false);
                  toast.success('System unlocked temporarily.');
                }}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 active:scale-95 transition"
              >
                Unlock Temporarily
              </button>
              <p className="text-xs text-gray-400">
                System will auto-lock again after {idleLockMinutes} minutes of inactivity.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border rounded-xl text-sm text-gray-600 font-medium">
              Only Administrators can bypass this lock. Please contact an admin if you require immediate access.
            </div>
          )}
          
          <div className="mt-8 pt-6 border-t flex justify-center">
             <button onClick={handleLogout} className="text-sm font-semibold text-gray-500 hover:text-red-500 transition flex items-center gap-1.5">
               <LogOut size={16} /> Sign out completely
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex h-screen bg-background overflow-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="md:hidden absolute top-0 left-0 right-0 h-24 bg-[#004bb4] text-white flex items-start justify-between px-4 pt-4 z-20">
        <div className="flex items-start">
          <div className="flex flex-col mt-0.5">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl leading-tight truncate max-w-[200px]">MsikaFlo</h1>
              {isOnline ? (
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_0_2px_rgba(74,222,128,0.2)] animate-pulse mt-1" title="Online"></div>
              ) : (
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full mt-1" title="Offline"></div>
              )}
            </div>
            <div className="animate-float-lr mt-0.5">
              <p className="text-sm text-blue-100">{greeting}, {user?.name?.split(' ').at(-1) || 'Jef'} 👋</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {/* Sync Status Badge */}
           <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-black/20 rounded-full text-sm font-medium backdrop-blur-sm">
             {queue.length > 0 ? (
               <>
                 {isSyncing ? <CloudUpload size={16} className="animate-pulse text-yellow-300" /> : <CloudOff size={16} className="text-red-300" />}
                 <span className="text-yellow-100">{queue.length} Pending</span>
               </>
             ) : (
               <>
                 <Cloud size={16} className="text-green-300" />
                 <span className="text-green-50">Online</span>
               </>
             )}
           </div>

           <div className="relative" ref={mobileNotifRef}>
             <button onClick={() => setShowNotifications(!showNotifications)} className="relative cursor-pointer p-1">
               <Bell size={24} />
               {notificationCount > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-[#004bb4]">{notificationCount}</span>
               )}
             </button>
             {showNotifications && (
               <div className="absolute top-10 -right-12 sm:right-0 w-[90vw] max-w-[288px] sm:max-w-none sm:w-72 bg-white text-black shadow-xl rounded-lg border p-2 z-[100] text-sm max-h-80 overflow-y-auto">
                 <h3 className="font-bold border-b pb-2 mb-2 px-2">Notifications</h3>
                 {lowStockItems.length > 0 && (
                   <>
                     <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Low Stock — tap to locate</div>
                     {lowStockItems.map(p => (
                       <div
                         key={p.id}
                         className="px-2 py-2 hover:bg-red-50 rounded cursor-pointer flex items-center justify-between gap-2 group"
                         onClick={() => { navigate(`/inventory?highlight=${p.id}`); setShowNotifications(false); }}
                       >
                         <div className="flex items-center gap-2 min-w-0">
                           <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                           <span className="text-red-700 font-medium truncate">{p.name}</span>
                         </div>
                         <span className="text-xs text-red-400 shrink-0 font-semibold">{p.stock} {p.unit || ''} left</span>
                       </div>
                     ))}
                   </>
                 )}
                 {overdueCreditCount > 0 && (
                   <div className="p-2 hover:bg-amber-50 rounded cursor-pointer text-amber-600 flex items-center gap-2" onClick={() => { navigate('/credits'); setShowNotifications(false); }}>
                     <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                     {overdueCreditCount} overdue credit{overdueCreditCount > 1 ? 's' : ''} — tap to review
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
          <div className="hidden md:block absolute top-4 right-4" ref={desktopNotifRef}>
            <button onClick={() => setShowNotifications(!showNotifications)} className="text-blue-200 hover:text-white transition relative">
              <Bell size={20} />
              {notificationCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-primary">{notificationCount}</span>
              )}
            </button>
            {showNotifications && (
               <div className="absolute top-8 left-0 w-72 bg-white text-black shadow-xl rounded-lg border p-2 z-[100] text-sm text-left max-h-80 overflow-y-auto">
                 <h3 className="font-bold border-b pb-2 mb-2 px-2">Notifications</h3>
                 {lowStockItems.length > 0 && (
                   <>
                     <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Low Stock — click to locate</div>
                     {lowStockItems.map(p => (
                       <div
                         key={p.id}
                         className="px-2 py-2 hover:bg-red-50 rounded cursor-pointer flex items-center justify-between gap-2"
                         onClick={() => { navigate(`/inventory?highlight=${p.id}`); setShowNotifications(false); }}
                       >
                         <div className="flex items-center gap-2 min-w-0">
                           <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                           <span className="text-red-700 font-medium truncate">{p.name}</span>
                         </div>
                         <span className="text-xs text-red-400 shrink-0 font-semibold">{p.stock} {p.unit || ''} left</span>
                       </div>
                     ))}
                   </>
                 )}
                 {overdueCreditCount > 0 && (
                   <div className="p-2 hover:bg-amber-50 rounded cursor-pointer text-amber-600 flex items-center gap-2" onClick={() => { navigate('/credits'); setShowNotifications(false); }}>
                     <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                     {overdueCreditCount} overdue credit{overdueCreditCount > 1 ? 's' : ''} — click to review
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
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-center leading-tight">{companyName}</h2>
            {isOnline ? (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" title="Online"></div>
            ) : (
              <div className="w-2 h-2 bg-red-400 rounded-full shrink-0" title="Offline"></div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav 
          ref={navRef}
          onKeyDown={handleNavKeyDown}
          className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar"
        >
          <Link to="/" className={navLinkClass('/', true)}>
            <LayoutDashboard size={20} /> <span>Dashboard</span>
          </Link>
          
          <Link to="/pos" className={navLinkClass('/pos', true)}>
            <ShoppingCart size={20} /> <span>POS Terminal</span>
          </Link>

          <Link to="/product-finder" className={navLinkClass('/product-finder', true)}>
            <Search size={20} /> <span>Find Product</span>
          </Link>
          
          <Link to="/sales" className={navLinkClass('/sales')}>
            <ClipboardList size={20} /> <span>Sales</span>
          </Link>
          
          {isAdmin && (
            <Link to="/inventory" className={navLinkClass('/inventory', true)}>
              <Package size={20} /> <span>Inventory</span>
            </Link>
          )}
          
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
              <Link to="/stationery-services" className={navLinkClass('/stationery-services')}>
                <Printer size={20} /> <span>Stationery Services</span>
              </Link>
              <Link to="/reports" className={navLinkClass('/reports')}>
                <BarChart3 size={20} /> <span>Reports</span>
              </Link>
              <Link to="/order" className={navLinkClass('/order')}>
                <TrendingUp size={20} /> <span>Smart Order List</span>
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
            <button onClick={handleLogout} className="text-blue-300 hover:text-white p-2 hover:bg-red-500/20 rounded transition" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
          <div className="text-[10px] text-center text-white font-normal tracking-wide pb-4 md:pb-0 mt-2">
            MsikaFlo • Powered by Indelible Technologies
          </div>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto bg-gray-50 pt-24 md:pt-0 pb-16 md:pb-0 h-full w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center pb-safe z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <Link to="/" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/' ? 'text-primary' : 'text-gray-500'}`}>
          <LayoutDashboard size={20} className="mb-1" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </Link>
        
        <Link to="/product-finder" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/product-finder' ? 'text-primary' : 'text-gray-500'}`}>
          <Search size={22} className="mb-1" />
          <span className="text-[10px] font-medium mt-0.5">Find</span>
        </Link>
        
        <Link to="/pos" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/pos' ? 'text-primary' : 'text-gray-500'}`}>
          <ShoppingCart size={22} className="mb-1" />
          <span className="text-[10px] font-medium mt-0.5">POS</span>
        </Link>
        
        {isAdmin && (
          <Link to="/inventory" className={`flex flex-col items-center py-2 px-3 ${location.pathname === '/inventory' ? 'text-primary' : 'text-gray-500'}`}>
            <Package size={20} className="mb-1" />
            <span className="text-[10px] font-medium">Inventory</span>
          </Link>
        )}
        
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`flex flex-col items-center py-2 px-3 text-gray-500`}>
          <Menu size={20} className="mb-1" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </div>
  )
}
