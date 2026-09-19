import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, LayoutDashboard, Users, CreditCard, Package, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ClipboardList, Menu, Bell, User, CloudOff, CloudUpload, Cloud, Printer, Lock, Search, TrendingUp, GitBranch, Sun, Moon, AlertTriangle, CheckCircle2, Trash2, ShoppingBag, Store, ExternalLink } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSaleStore, useCreditStore, useExpenseStore, useEmployeeStore } from '../store/dataStore';
import { useProductStore, useCartStore } from '../store/cartStore';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useThemeStore } from '../store/themeStore';
import { toast } from 'sonner';
import { initForegroundNotificationListener, dispatchSalePushNotification } from '../utils/pushNotifications';
import { calcDailyRealizedProfit } from '../utils/profitUtils';

export default function Layout() {

  const { user, logout, loadProfile, unlockTemporarily, passwordRequests, loadPasswordRequests } = useAuthStore();
  const { companyName, companyLogo, loadSettings, autoLockEnabled, workTimeStart, workTimeEnd, idleLockMinutes, currency } = useSettingsStore();

  // Use fine-grained selectors — subscribes only to what Layout needs,
  // so a sale or stock change doesn't re-render the entire sidebar
  const products = useProductStore(s => s.products);
  const loadProducts = useProductStore(s => s.loadProducts);
  const { loadHeldCarts } = useCartStore();
  const { loadSales } = useSaleStore();
  const credits = useCreditStore(s => s.credits);
  const loadCredits = useCreditStore(s => s.loadCredits);
  const { loadExpenses } = useExpenseStore();
  const { loadEmployees } = useEmployeeStore();
  const { isOnline, isSyncing, pendingCount, syncAll } = useSyncEngine();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [pendingOnlineOrdersCount, setPendingOnlineOrdersCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  // Listen to pending online orders count in real time
  useEffect(() => {
    try {
      const q = query(collection(db, 'onlineOrders'), where('status', '==', 'PENDING'));
      const unsub = onSnapshot(q, (snap) => {
        setPendingOnlineOrdersCount(snap.docs.length);
      }, (err) => {
        console.warn('Unable to subscribe to pending online orders count', err);
      });
      return () => unsub();
    } catch (e) {
      console.warn('Error setting up online orders count', e);
    }
  }, []);

  // Real-time in-app notifications for authorized managers & admins (when Staff Portal is open)
  useEffect(() => {
    if (!user || user.role === 'CASHIER') return;

    const sessionStart = Date.now();
    const seenSaleIds = new Set<string>();
    const seenOrderIds = new Set<string>();

    // 1. Sales listener
    const salesQ = query(
      collection(db, 'sales'),
      where('createdAt', '>=', sessionStart)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (seenSaleIds.has(docId)) return;
          seenSaleIds.add(docId);

          const sale = change.doc.data();
          // Cashier self-exclusion: do not notify cashier about their own sale
          if (sale.cashier && user.name && sale.cashier.trim().toLowerCase() === user.name.trim().toLowerCase()) {
            return;
          }

          // Check user preference
          const prefs = (user as any).notificationPrefs;
          if (prefs && prefs.notifyCashierSales === false) return;

          const amountFormatted = Number(sale.total || 0).toLocaleString();
          const notifTitle = `🔔 New Sale — ${companyName || 'JEF Investment'}`;
          const notifBody = `Cashier: ${sale.cashier || 'Staff'}\nSale #: ${sale.invoiceNumber || 'INV'}\nAmount: ${currency || 'MWK'} ${amountFormatted}\nPayment: ${sale.paymentMethod || 'Cash'}`;

          // 1. In-app toast for when user is looking at the screen
          toast.success(notifTitle, {
            description: notifBody,
            duration: 8000,
            action: {
              label: 'View Sale',
              onClick: () => navigate('/sales'),
            },
          });

          // 2. Native OS / Android system notification (status bar & lock screen when app is minimized/backgrounded)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(notifTitle, {
                  body: notifBody,
                  icon: '/pwa-192x192.png',
                  badge: '/pwa-192x192.png',
                  tag: 'msikaflo-sale-' + docId,
                  vibrate: [200, 100, 200],
                  data: { url: '/sales' },
                } as any);
              }).catch(() => {});
            }
          }
        }
      });
    }, (err) => {
      console.warn('Real-time sale notification listener notice:', err);
    });

    // 2. Online orders listener
    const ordersQ = query(
      collection(db, 'onlineOrders'),
      where('createdAt', '>=', sessionStart)
    );

    const unsubOrders = onSnapshot(ordersQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const docId = change.doc.id;
          if (seenOrderIds.has(docId)) return;
          seenOrderIds.add(docId);

          const order = change.doc.data();
          const prefs = (user as any).notificationPrefs;
          if (prefs && prefs.notifyOnlineOrders === false) return;

          const amountFormatted = Number(order.total || 0).toLocaleString();
          const orderTitle = '🔔 New Online Purchase';
          const orderBody = `Purchase #: #${order.orderId || docId.slice(-5)}\nAmount: ${currency || 'MWK'} ${amountFormatted}`;

          // 1. In-app toast
          toast.info(orderTitle, {
            description: orderBody,
            duration: 8000,
            action: {
              label: 'View Purchase',
              onClick: () => navigate('/online-orders'),
            },
          });

          // 2. Native OS / Android system notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(orderTitle, {
                  body: orderBody,
                  icon: '/pwa-192x192.png',
                  badge: '/pwa-192x192.png',
                  tag: 'msikaflo-order-' + docId,
                  vibrate: [200, 100, 200],
                  data: { url: '/online-orders' },
                } as any);
              }).catch(() => {});
            }
          }
        }
      });
    }, (err) => {
      console.warn('Real-time online order notification listener notice:', err);
    });

    // 3. Foreground FCM push listener
    const unsubFCM = initForegroundNotificationListener((payload) => {
      const title = payload.notification?.title || payload.data?.title;
      const body = payload.notification?.body || payload.data?.body;
      const targetUrl = payload.data?.url || '/sales';
      if (title && body) {
        toast(title, {
          description: body,
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => navigate(targetUrl),
          },
        });
      }
    });

    return () => {
      unsubSales();
      unsubOrders();
      unsubFCM();
    };
  }, [user?.id, user?.role, user?.name, companyName, currency, navigate]);

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
    const t1 = setTimeout(() => { loadExpenses(); loadCredits(); loadEmployees(); }, 400);
    const t2 = setTimeout(() => syncAll(), 1000);
    // StationeryServices are loaded lazily by their own pages

    if (user?.id) {
      const t3 = setTimeout(() => loadHeldCarts(user.id), 300);
      if (user.role === 'ADMIN') {
        const t4 = setTimeout(() => { loadPasswordRequests(); useAuthStore.getState().loadUsers(); }, 600);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
      }
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [user?.id, user?.role]);

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

    // Automated Serving notification: configurable minutes before closing, retrieves the
    // existing automated calculation as the single source of truth and notifies cashier
    const checkServingReminder = () => {
      const end = workTimeEnd || '20:00';
      const [endH, endM] = end.split(':').map(Number);
      if (isNaN(endH) || isNaN(endM)) return;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const endMinutes = endH * 60 + endM;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Check if within configured minutes before closing (default: 10 min)
      const reminderMinutes = useSettingsStore.getState().servingReminderMinutes ?? 10;
      const isWithinReminderWindow = nowMinutes >= (endMinutes - reminderMinutes) && nowMinutes < endMinutes;
      if (!isWithinReminderWindow) return;

      const storageKey = `msikaflo_serving_alert_${todayStr}`;
      if (localStorage.getItem(storageKey)) return;

      // Single source of truth: retrieve the existing automated calculation directly
      const allSales = useSaleStore.getState().sales;
      const allExpenses = useExpenseStore.getState().expenses;
      const savingsPct = useSettingsStore.getState().dailySavingsPercentage ?? 10;
      const savingsOn = useSettingsStore.getState().dailySavingsEnabled ?? true;

      const metrics = calcDailyRealizedProfit(
        todayStr,
        allSales,
        allExpenses,
        savingsPct,
        savingsOn
      );

      const servingAmount = metrics.dailySavingsTarget;
      if (servingAmount <= 0) return;

      localStorage.setItem(storageKey, 'true');

      // Cashier receives the exact amount (unalterable)
      const currentRole = useAuthStore.getState().user?.role;
      if (currentRole === 'CASHIER') {
        const servingTitle = `🔔 Daily Serving Due — ${companyName || 'JEF Investment'}`;
        const servingBody = `Today's Serving Amount: ${currency || 'MWK'} ${servingAmount.toLocaleString()}\nClosing in ${reminderMinutes} minute${reminderMinutes === 1 ? '' : 's'}. Please serve/remit this exact calculated amount.`;

        toast.info(servingTitle, {
          description: servingBody,
          duration: 30000,
        });

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(servingTitle, {
                body: servingBody,
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag: 'msikaflo-serving-' + todayStr,
                vibrate: [200, 100, 200, 100, 200],
                data: { url: '/pos' },
              } as any);
            }).catch(() => {});
          }
        }
      }

      // Also dispatch push notification
      dispatchSalePushNotification({
        type: 'SERVING_DUE',
        amount: servingAmount,
        currency: currency || 'MWK',
      }).catch((e) => console.warn('Serving notification dispatch notice:', e));
    };

    checkLockStatus(); // Check immediately
    checkServingReminder();
    const interval = setInterval(() => {
      checkLockStatus();
      checkServingReminder();
    }, 60000); // Check every minute

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
  
  // Official Warnings logic
  const rawWarnings = useMemo(() => user?.warnings || [], [user?.warnings]);
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>(() => {
    const uid = user?.id;
    if (!uid) return [];
    try {
      return JSON.parse(localStorage.getItem(`msikaflo_dismissed_warnings_${uid}`) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user?.id) {
      setDismissedWarnings([]);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(`msikaflo_dismissed_warnings_${user.id}`) || '[]');
      setDismissedWarnings(saved);
    } catch {
      setDismissedWarnings([]);
    }
  }, [user?.id]);

  // Only display warnings that have not been removed/deleted by the user
  const warnings = useMemo(() => {
    return rawWarnings.filter(w => !dismissedWarnings.includes(w));
  }, [rawWarnings, dismissedWarnings]);

  const [unacknowledgedWarnings, setUnacknowledgedWarnings] = useState<string[]>([]);
  const [activeWarningModal, setActiveWarningModal] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !warnings.length) {
      setUnacknowledgedWarnings([]);
      setActiveWarningModal(null);
      return;
    }
    const ackKey = `msikaflo_ack_warnings_${user.id}`;
    let acknowledged: string[] = [];
    try {
      acknowledged = JSON.parse(localStorage.getItem(ackKey) || '[]');
    } catch {
      acknowledged = [];
    }
    const unacked = warnings.filter(w => !acknowledged.includes(w));
    setUnacknowledgedWarnings(unacked);
    if (unacked.length > 0) {
      setActiveWarningModal(unacked[unacked.length - 1]);
    }
  }, [user?.id, warnings]);

  const handleAcknowledgeWarning = (warnText: string) => {
    if (!user?.id) return;
    const ackKey = `msikaflo_ack_warnings_${user.id}`;
    let acknowledged: string[] = [];
    try {
      acknowledged = JSON.parse(localStorage.getItem(ackKey) || '[]');
    } catch {
      acknowledged = [];
    }
    if (!acknowledged.includes(warnText)) {
      acknowledged.push(warnText);
      localStorage.setItem(ackKey, JSON.stringify(acknowledged));
    }
    const remaining = unacknowledgedWarnings.filter(w => w !== warnText);
    setUnacknowledgedWarnings(remaining);
    setActiveWarningModal(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    toast.info('Warning acknowledged.');
  };

  const handleDeleteWarning = async (warnText: string) => {
    if (!user?.id) return;
    // 1. Immediately record in local storage so it vanishes from the UI
    const key = `msikaflo_dismissed_warnings_${user.id}`;
    const nextDismissed = Array.from(new Set([...dismissedWarnings, warnText]));
    localStorage.setItem(key, JSON.stringify(nextDismissed));
    setDismissedWarnings(nextDismissed);

    // 2. Also acknowledge so modal doesn't pop up
    const ackKey = `msikaflo_ack_warnings_${user.id}`;
    try {
      const acked = JSON.parse(localStorage.getItem(ackKey) || '[]');
      if (!acked.includes(warnText)) {
        acked.push(warnText);
        localStorage.setItem(ackKey, JSON.stringify(acked));
      }
    } catch {
      // Ignore
    }
    const remaining = unacknowledgedWarnings.filter(w => w !== warnText);
    setUnacknowledgedWarnings(remaining);
    if (activeWarningModal === warnText) {
      setActiveWarningModal(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }

    // 3. Remove from Firestore user document in the cloud
    try {
      await useAuthStore.getState().dismissWarning(user.id, warnText);
    } catch (e) {
      console.warn("Failed to remove warning from Firestore:", e);
    }

    toast.success('Warning removed from notifications');
  };

  const handleClearAllWarnings = async () => {
    if (!user?.id || warnings.length === 0) return;
    const key = `msikaflo_dismissed_warnings_${user.id}`;
    const nextDismissed = Array.from(new Set([...dismissedWarnings, ...warnings]));
    localStorage.setItem(key, JSON.stringify(nextDismissed));
    setDismissedWarnings(nextDismissed);

    setUnacknowledgedWarnings([]);
    setActiveWarningModal(null);

    // Remove all from Firestore user document
    try {
      await useAuthStore.getState().clearAllWarnings(user.id);
    } catch (e) {
      console.warn("Failed to clear all warnings from Firestore:", e);
    }

    toast.success('All warnings removed from notifications');
  };

  const notificationCount = lowStockCount + overdueCreditCount + passwordRequestCount + unacknowledgedWarnings.length + pendingOnlineOrdersCount;

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
          <div className="flex flex-col mt-0.5 max-w-[calc(100vw-120px)]">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl leading-tight truncate max-w-[200px]">MsikaFlo</h1>
              {isOnline ? (
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_0_2px_rgba(74,222,128,0.2)] animate-pulse mt-1" title="Online"></div>
              ) : (
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full mt-1" title="Offline"></div>
              )}
            </div>
            <div className="animate-float-lr mt-0.5">
              <p className="text-sm text-blue-100 whitespace-nowrap">{greeting}, {user?.name?.split(' ').at(-1) || 'Jef'} 👋</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {/* Sync Status Badge & Action */}
           <button
             onClick={() => syncAll(true)}
             disabled={isSyncing}
             className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm transition active:scale-95 cursor-pointer ${
               pendingCount > 0
                 ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 animate-pulse'
                 : isOnline
                   ? 'bg-black/20 text-green-200 border border-green-400/30'
                   : 'bg-red-500/25 text-red-200 border border-red-400/40'
             }`}
             title={pendingCount > 0 ? `${pendingCount} offline record(s) pending. Tap to sync now.` : (isOnline ? 'All synced to cloud. Tap to force sync.' : 'Offline mode')}
           >
             {isSyncing ? (
               <>
                 <CloudUpload size={14} className="animate-spin text-amber-300 shrink-0" />
                 <span className="text-amber-100 text-[11px] font-bold">Syncing...</span>
               </>
             ) : pendingCount > 0 ? (
               <>
                 <CloudUpload size={14} className="text-amber-300 shrink-0" />
                 <span className="text-amber-100 text-[11px] font-bold">{pendingCount} Pending</span>
               </>
             ) : isOnline ? (
               <>
                 <Cloud size={14} className="text-green-300 shrink-0" />
                 <span className="text-green-50 text-[11px]">Synced</span>
               </>
             ) : (
               <>
                 <CloudOff size={14} className="text-red-300 shrink-0" />
                 <span className="text-red-100 text-[11px]">Offline</span>
               </>
             )}
           </button>

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
                 {warnings.length > 0 && (
                   <div className="mb-2.5 pb-2 border-b">
                     <div className="px-2 py-1 text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center justify-between">
                       <span className="flex items-center gap-1">
                         <AlertTriangle size={12} className="text-red-600 shrink-0" /> Official Warnings ({warnings.length})
                       </span>
                       <button
                         onClick={handleClearAllWarnings}
                         className="text-[9px] text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer"
                       >
                         Clear all
                       </button>
                     </div>
                     {warnings.map((w, idx) => (
                       <div key={idx} className="p-2 my-1 bg-red-50 border border-red-200 rounded text-xs text-red-950">
                         <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                           <span className="text-red-700">Management Warning</span>
                           <div className="flex items-center gap-1.5">
                             {unacknowledgedWarnings.includes(w) ? (
                               <span className="text-[9px] bg-red-200 text-red-800 px-1 py-0.5 rounded font-bold animate-pulse">New</span>
                             ) : (
                               <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-medium">Seen</span>
                             )}
                             <button
                               onClick={(e) => { e.stopPropagation(); handleDeleteWarning(w); }}
                               className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-100 transition cursor-pointer"
                               title="Remove warning"
                             >
                               <Trash2 size={12} />
                             </button>
                           </div>
                         </div>
                         <p className="whitespace-pre-wrap text-gray-800 leading-snug">{w}</p>
                         <div className="mt-1.5 flex items-center gap-1.5">
                           {unacknowledgedWarnings.includes(w) && (
                             <button
                               onClick={() => handleAcknowledgeWarning(w)}
                               className="flex-1 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded transition active:scale-95 cursor-pointer"
                             >
                               Acknowledge Warning
                             </button>
                           )}
                           <button
                             onClick={() => handleDeleteWarning(w)}
                             className="py-1 px-2 text-[10px] text-red-700 hover:text-red-900 hover:bg-red-100 font-semibold rounded border border-red-200 transition flex items-center gap-1 cursor-pointer"
                             title="Delete warning"
                           >
                             <Trash2 size={11} /> Delete
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
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
              <button onClick={() => setShowNotifications(!showNotifications)} className="text-blue-200 hover:text-white transition relative p-1.5 rounded-lg hover:bg-white/10">
                <Bell size={18} />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-primary">{notificationCount}</span>
                )}
              </button>
              {showNotifications && (
                  <div className="absolute top-8 left-0 sm:left-4 w-96 bg-white text-black shadow-xl rounded-lg border p-2 z-[100] text-sm text-left max-h-80 overflow-y-auto">
                    <h3 className="font-bold border-b pb-2 mb-2 px-2">Notifications</h3>
                    {warnings.length > 0 && (
                      <div className="mb-2.5 pb-2 border-b">
                        <div className="px-2 py-1 text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={12} className="text-red-600 shrink-0" /> Official Warnings ({warnings.length})
                          </span>
                          <button
                            onClick={handleClearAllWarnings}
                            className="text-[9px] text-red-600 hover:text-red-800 font-semibold hover:underline cursor-pointer"
                          >
                            Clear all
                          </button>
                        </div>
                        {warnings.map((w, idx) => (
                          <div key={idx} className="p-2.5 my-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-950">
                            <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                              <span className="text-red-700">Management Warning</span>
                              <div className="flex items-center gap-1.5">
                                {unacknowledgedWarnings.includes(w) ? (
                                  <span className="text-[9px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-bold animate-pulse">Action Required</span>
                                ) : (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Seen</span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteWarning(w); }}
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-100 transition cursor-pointer"
                                  title="Remove warning"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-gray-800 leading-snug">{w}</p>
                            <div className="mt-2 flex items-center gap-2">
                              {unacknowledgedWarnings.includes(w) && (
                                <button
                                  onClick={() => handleAcknowledgeWarning(w)}
                                  className="flex-1 py-1 text-[11px] bg-red-600 hover:bg-red-700 text-white font-bold rounded transition active:scale-95 cursor-pointer"
                                >
                                  Acknowledge Warning
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteWarning(w)}
                                className="py-1 px-2.5 text-[11px] text-red-700 hover:text-red-900 hover:bg-red-100 font-semibold rounded border border-red-200 transition flex items-center gap-1 cursor-pointer"
                                title="Delete warning"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

          {/* Desktop Live Sync Status Widget */}
          <div className="mt-3 w-full px-1">
            <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs backdrop-blur-sm transition ${
              pendingCount > 0
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-sm'
                : isOnline
                  ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                {isSyncing ? (
                  <CloudUpload size={16} className="animate-spin text-amber-300 shrink-0" />
                ) : pendingCount > 0 ? (
                  <CloudUpload size={16} className="animate-bounce text-amber-400 shrink-0" />
                ) : isOnline ? (
                  <Cloud size={16} className="text-green-400 shrink-0" />
                ) : (
                  <CloudOff size={16} className="text-red-400 shrink-0" />
                )}
                <div className="flex flex-col truncate">
                  <span className="font-bold truncate text-[11px]">
                    {isSyncing ? 'Syncing with cloud...' : (pendingCount > 0 ? `${pendingCount} Pending Sync` : (isOnline ? 'Cloud Synced' : 'Offline Mode'))}
                  </span>
                  <span className="text-[9px] opacity-75 truncate">
                    {pendingCount > 0 ? 'Saved locally on device' : (isOnline ? 'Auto-sync active' : 'Will sync on reconnect')}
                  </span>
                </div>
              </div>

              {(pendingCount > 0 || !isOnline || isSyncing) && (
                <button
                  onClick={() => syncAll(true)}
                  disabled={isSyncing}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-blue-950 font-black text-[10px] rounded-lg transition disabled:opacity-50 shrink-0 shadow-xs cursor-pointer"
                  title="Force immediate synchronization with cloud"
                >
                  {isSyncing ? '...' : 'Sync'}
                </button>
              )}
            </div>
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

          <Link to="/online-orders" className={navLinkClass('/online-orders')}>
            <ShoppingBag size={20} /> 
            <span className="flex-1">Online Purchases</span>
            {pendingOnlineOrdersCount > 0 && (
              <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                {pendingOnlineOrdersCount}
              </span>
            )}
          </Link>

          <a
            href="/store"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2.5 rounded-xl bg-blue-800/40 hover:bg-blue-700/60 text-blue-100 hover:text-white transition text-xs font-bold border border-blue-500/30 my-2 shadow-xs group"
            title="Open customer-facing WhatsApp storefront in a new tab"
          >
            <span className="flex items-center gap-2">
              <Store size={16} className="text-emerald-400 group-hover:scale-110 transition" />
              <span>View Storefront</span>
            </span>
            <ExternalLink size={13} className="text-blue-300" />
          </a>

          <Link to="/product-finder" className={navLinkClass('/product-finder', true)}>
            <Search size={20} /> <span>Find Product</span>
          </Link>
          
          <Link to="/sales" className={navLinkClass('/sales')}>
            <ClipboardList size={20} /> <span>Sales</span>
          </Link>
          
          <Link to="/expenses" className={navLinkClass('/expenses')}>
            <Receipt size={20} /> <span>Expenses</span>
          </Link>

          {isAdmin && (
            <>
              <Link to="/inventory" className={navLinkClass('/inventory', true)}>
                <Package size={20} /> <span>Inventory</span>
              </Link>
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
              <Link to="/branches" className={navLinkClass('/branches')}>
                <GitBranch size={20} /> <span>Branches</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Profile & Footer Actions */}
        <div className="p-4 border-t border-blue-700/50 bg-blue-900/30 pb-safe md:pb-4 mt-auto">
          <div className="flex items-center justify-between mb-3 gap-2">
            <Link to="/settings" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-800 text-blue-100 transition font-medium flex-1">
              <SettingsIcon size={20} /> <span>Settings</span>
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2.5 text-blue-200 hover:text-white hover:bg-blue-800 rounded-lg transition shrink-0 flex items-center justify-center"
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {resolvedTheme === 'dark' ? <Sun size={20} className="text-amber-300" /> : <Moon size={20} />}
            </button>
          </div>
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
                {user?.branchName && (
                  <span className="text-[10px] text-blue-400 flex items-center gap-1 mt-0.5 truncate">
                    <GitBranch size={9} /> {user.branchName}
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleLogout} className="text-blue-300 hover:text-white p-2 hover:bg-red-500/20 rounded transition" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
          <div className="text-[10px] text-center text-white font-normal tracking-wide pb-4 md:pb-0 mt-2">
            &copy; 2026 {companyName}. All rights reserved. Powered by MsikaFlo . Indelible Technologies
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

      {/* Urgent Official Warning Modal Popup */}
      {activeWarningModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-2 border-red-500 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-red-600 text-white p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle size={36} className="text-white animate-bounce" />
              </div>
              <h2 className="text-xl font-black tracking-wide uppercase">Official Management Warning</h2>
              <p className="text-red-100 text-xs mt-1 font-medium">Issued to: <span className="underline font-bold">{user?.name}</span></p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-inner">
                <p className="text-sm text-red-950 font-semibold whitespace-pre-wrap leading-relaxed">
                  {activeWarningModal}
                </p>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border text-center">
                This warning has been officially recorded in your employee record. You must acknowledge receipt to continue.
              </div>
              <button
                onClick={() => handleAcknowledgeWarning(activeWarningModal)}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/30 transition active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <CheckCircle2 size={18} /> I Understand and Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
