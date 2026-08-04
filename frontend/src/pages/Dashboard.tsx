import { ShoppingCart, TrendingUp, Package, CreditCard, Users, AlertTriangle, Printer, Wrench, Search, Download, Grip } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSaleStore } from '../store/dataStore';
import { useCreditStore } from '../store/dataStore';
import { useProductStore } from '../store/cartStore';
import { useSettingsStore } from '../store/settingsStore';
import { useState } from 'react';

const ALL_ACTIONS = [
  { id: 'new-sale', label: 'New Sale (POS)', icon: ShoppingCart, link: '/pos', color: 'text-blue-500' },
  { id: 'add-item', label: 'Add Item (Stock)', icon: Package, link: '/inventory', color: 'text-green-500' },
  { id: 'new-expense', label: 'New Expense', icon: CreditCard, link: '/expenses', color: 'text-orange-500' },
  { id: 'print-service', label: 'Print Service', icon: Printer, link: '/pos?category=Services&search=Photocopy', color: 'text-purple-500' },
  { id: 'tech-service', label: 'Tech Service', icon: Wrench, link: '/pos?category=Services&search=Software', color: 'text-teal-500' },
  { id: 'find-receipt', label: 'Find Receipt', icon: Search, link: '/sales', color: 'text-red-500' },
  { id: 'stock-in', label: 'Stock In', icon: Download, link: '/inventory', color: 'text-blue-600' },
];

export default function Dashboard() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const { getTodayTotal, sales } = useSaleStore();
  const { getTotalOutstanding } = useCreditStore();
  const { products } = useProductStore();
  const settings = useSettingsStore();
  const [showCustomize, setShowCustomize] = useState(false);
  const [tempActions, setTempActions] = useState<string[]>(settings.quickActions);

  const todayTotal = getTodayTotal();
  const outstandingCredit = getTotalOutstanding();
  const lowStockCount = products.filter(p => !p.isService && p.stock <= p.reorderLevel).length;

  const stats = [
    { label: "Today's Sales", value: `MWK ${todayTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', link: '/reports' },
    { label: 'Outstanding Credit', value: `MWK ${outstandingCredit.toLocaleString()}`, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', link: '/credits' },
    { label: 'Low Stock Items', value: `${lowStockCount} items`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', link: '/inventory' },
    { label: 'Active Employees', value: '4 staff', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', link: '/employees' }, // Still mocked as no employee store exists yet
  ];

  const recentSales = sales.slice(0, 5);

  return (
    <div className="p-4 md:p-6 md:pt-6 relative -mt-4 md:mt-0">
      {/* Greeting (Desktop Only) */}
      <div className="hidden md:block mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{greeting}, Jef Investment! 👋</h1>
        <p className="text-gray-500 mt-1 text-sm">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        {stats.map(stat => (
          <Link to={stat.link} key={stat.label} className={`bg-white border rounded-xl p-3 md:p-5 shadow-sm hover:shadow-md transition flex flex-col items-center text-center relative z-10`}>
            <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} mb-2`}>
              <stat.icon size={20} />
            </div>
            <div className="text-[11px] md:text-sm text-gray-500 font-medium mb-1">{stat.label}</div>
            <div className={`text-sm md:text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-[10px] md:text-xs text-gray-400 mt-1">View details &gt;</div>
          </Link>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6 flex justify-between divide-x divide-gray-100 relative z-10">
        <div className="flex flex-col items-center flex-1">
          <div className="bg-red-50 text-red-500 p-2 rounded-lg mb-1"><AlertTriangle size={18} /></div>
          <div className="font-bold text-lg leading-tight">{lowStockCount}</div>
          <div className="text-[10px] text-gray-500 text-center leading-tight">Low Stock<br/>Items</div>
        </div>
        <div className="flex flex-col items-center flex-1">
          <div className="bg-blue-50 text-blue-500 p-2 rounded-lg mb-1"><Users size={18} /></div>
          <div className="font-bold text-lg leading-tight">4</div>
          <div className="text-[10px] text-gray-500 text-center leading-tight">Active<br/>Staff</div>
        </div>
        <div className="flex flex-col items-center flex-1">
          <div className="bg-green-50 text-green-500 p-2 rounded-lg mb-1"><Printer size={18} /></div>
          <div className="font-bold text-lg leading-tight">0</div>
          <div className="text-[10px] text-gray-500 text-center leading-tight">Print Shop<br/>Income</div>
        </div>
        <div className="flex flex-col items-center flex-1">
          <div className="bg-purple-50 text-purple-500 p-2 rounded-lg mb-1"><Wrench size={18} /></div>
          <div className="font-bold text-lg leading-tight">0</div>
          <div className="text-[10px] text-gray-500 text-center leading-tight">Tech Services<br/>Income</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="col-span-1 lg:col-span-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-800">Quick Actions</h2>
            <button onClick={() => { setTempActions(settings.quickActions); setShowCustomize(true); }} className="text-xs text-blue-600 font-medium flex items-center gap-1">⚙️ Customize</button>
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {ALL_ACTIONS.filter(a => settings.quickActions.includes(a.id)).map(action => (
              <Link key={action.id} to={action.link} className="bg-white border rounded-xl p-3 md:p-5 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-center">
                <action.icon size={28} className={`${action.color} mb-2`} />
                <span className="text-[10px] md:text-sm font-medium text-gray-700 leading-tight">{action.label.split(' (')[0]}<br/><span className="text-gray-400 font-normal">{action.label.includes('(') ? `(${action.label.split('(')[1]}` : ''}</span></span>
              </Link>
            ))}
            <button onClick={() => { setTempActions(settings.quickActions); setShowCustomize(true); }} className="bg-white border rounded-xl p-3 md:p-5 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-center">
              <Grip size={28} className="text-gray-400 mb-2" />
              <span className="text-[10px] md:text-sm font-medium text-gray-500 leading-tight">More Actions</span>
            </button>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl border shadow-sm p-4 col-span-1 lg:col-span-3 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800">Recent Transactions</h2>
            <Link to="/reports" className="text-sm font-bold text-blue-600 hover:underline">View All</Link>
          </div>
          <div className="space-y-0">
            {recentSales.map(tx => (
              <div key={tx.invoiceNumber} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{tx.items.length > 0 ? tx.items[0].name + (tx.items.length > 1 ? ` +${tx.items.length - 1} more` : '') : 'Empty Sale'}</span>
                  <span className="text-xs text-gray-400">{tx.invoiceNumber} · {tx.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    tx.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                    tx.paymentMethod === 'CREDIT' ? 'bg-amber-100 text-amber-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>{tx.paymentMethod.replace('_', ' ')}</span>
                  <span className="font-bold text-gray-800">MWK {tx.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="text-center text-gray-500 py-4">No recent sales.</div>
            )}
          </div>
        </div>
      </div>

      {showCustomize && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-lg mb-4">Customize Quick Actions</h3>
            <p className="text-sm text-gray-500 mb-4">Select up to 7 actions to display on your dashboard.</p>
            <div className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto">
              {ALL_ACTIONS.map(action => (
                <label key={action.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border">
                  <input 
                    type="checkbox" 
                    checked={tempActions.includes(action.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (tempActions.length >= 7) return;
                        setTempActions([...tempActions, action.id]);
                      } else {
                        setTempActions(tempActions.filter(id => id !== action.id));
                      }
                    }}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <div className={`p-1.5 rounded-md bg-gray-100 ${action.color}`}>
                    <action.icon size={16} />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCustomize(false)} className="flex-1 py-2 border rounded-lg font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => { settings.updateSettings({ quickActions: tempActions }); setShowCustomize(false); }} className="flex-1 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
