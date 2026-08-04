import { ShoppingCart, TrendingUp, Package, CreditCard, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSaleStore } from '../store/dataStore';
import { useCreditStore } from '../store/dataStore';
import { useProductStore } from '../store/cartStore';

const quickActions = [
  { label: 'Open POS', icon: ShoppingCart, link: '/pos', color: 'bg-primary hover:bg-blue-700', text: 'text-white' },
  { label: 'Manage Inventory', icon: Package, link: '/inventory', color: 'bg-white hover:bg-gray-50', text: 'text-gray-700' },
  { label: 'View Reports', icon: TrendingUp, link: '/reports', color: 'bg-white hover:bg-gray-50', text: 'text-gray-700' },
  { label: 'Credit Sales', icon: CreditCard, link: '/credits', color: 'bg-white hover:bg-gray-50', text: 'text-gray-700' },
];

export default function Dashboard() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const { getTodayTotal, sales } = useSaleStore();
  const { getTotalOutstanding } = useCreditStore();
  const { products } = useProductStore();

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
    <div className="p-4 md:p-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{greeting}, Jef Investment! 👋</h1>
        <p className="text-gray-500 mt-1 text-sm">{dateStr}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => (
          <Link to={stat.link} key={stat.label} className={`${stat.bg} ${stat.border} border rounded-xl p-5 hover:shadow-md transition group`}>
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={stat.color} size={24} />
              <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
            </div>
            <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map(action => (
              <Link key={action.label} to={action.link} className={`${action.color} ${action.text} border flex items-center gap-3 p-3 rounded-lg font-medium transition`}>
                <action.icon size={20} />
                <span>{action.label}</span>
                <ArrowRight size={16} className="ml-auto opacity-50" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl border shadow-sm p-5 col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-700">Recent Sales</h2>
            <Link to="/reports" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
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
    </div>
  );
}
