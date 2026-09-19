import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DailyAnalytics, AnalyticsOverview } from '../services/storefrontAnalytics';
import {
  Users,
  Eye,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StorefrontAnalyticsWidget() {
  const [dailyData, setDailyData] = useState<Record<string, DailyAnalytics>>({});
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const todayStr = useMemo(() => getTodayString(), []);
  const yesterdayStr = useMemo(() => getYesterdayString(), []);

  useEffect(() => {
    // 1. Subscribe to overview doc
    const unsubOverview = onSnapshot(
      doc(db, 'storefrontAnalytics', 'overview'),
      (snap) => {
        if (snap.exists()) {
          setOverview(snap.data() as AnalyticsOverview);
        }
      },
      (err) => console.warn('Overview analytics listener notice:', err)
    );

    // 2. Subscribe to recent daily analytics (last 14 days)
    const q = query(
      collection(db, 'storefrontAnalytics'),
      orderBy('date', 'desc'),
      limit(14)
    );

    const unsubDaily = onSnapshot(
      q,
      (snapshot) => {
        const records: Record<string, DailyAnalytics> = {};
        snapshot.docs.forEach((d) => {
          if (d.id !== 'overview') {
            records[d.id] = { id: d.id, ...d.data() } as DailyAnalytics;
          }
        });
        setDailyData(records);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Daily analytics listener notice:', err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubOverview();
      unsubDaily();
    };
  }, []);

  const todayStats = dailyData[todayStr] || {
    pageViews: 0,
    uniqueVisitors: 0,
    cartAdds: 0,
    purchasesInitiated: 0,
    revenuePotential: 0,
  };

  const yesterdayStats = dailyData[yesterdayStr] || {
    pageViews: 0,
    uniqueVisitors: 0,
    cartAdds: 0,
    purchasesInitiated: 0,
    revenuePotential: 0,
  };

  // Growth calculation vs yesterday
  const visitorGrowth = useMemo(() => {
    if (yesterdayStats.uniqueVisitors === 0) {
      return todayStats.uniqueVisitors > 0 ? 100 : 0;
    }
    return Math.round(
      ((todayStats.uniqueVisitors - yesterdayStats.uniqueVisitors) /
        yesterdayStats.uniqueVisitors) *
        100
    );
  }, [todayStats.uniqueVisitors, yesterdayStats.uniqueVisitors]);

  // Conversion rate (purchases initiated / unique visitors)
  const conversionRate = useMemo(() => {
    if (todayStats.uniqueVisitors === 0) return 0;
    const rate = (todayStats.purchasesInitiated / todayStats.uniqueVisitors) * 100;
    return Math.min(100, Math.round(rate * 10) / 10);
  }, [todayStats.purchasesInitiated, todayStats.uniqueVisitors]);

  // Last 7 days data for the mini trend chart
  const last7Days = useMemo(() => {
    const days: { dateStr: string; label: string; visitors: number; views: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;

      const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const record = dailyData[dateKey];
      days.push({
        dateStr: dateKey,
        label: i === 0 ? 'Today' : weekday,
        visitors: record?.uniqueVisitors || 0,
        views: record?.pageViews || 0,
      });
    }
    return days;
  }, [dailyData]);

  const maxVisitorsInWeek = Math.max(...last7Days.map((d) => d.visitors), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
            <Users size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Storefront Customer Traffic &amp; Growth
              </h3>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Real-Time
              </span>
            </div>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Monitor active customer visits, browsing engagement, and online purchase conversion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title={isExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Today's Unique Customers */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-900">
                <span className="text-xs font-bold uppercase tracking-wider">Unique Customers</span>
                <Users size={16} className="text-blue-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-blue-950">
                  {isLoading ? '...' : (todayStats.uniqueVisitors || 0).toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
                  {visitorGrowth >= 0 ? (
                    <span className="inline-flex items-center text-emerald-600 gap-0.5">
                      <TrendingUp size={13} />
                      +{visitorGrowth}% vs yesterday
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-rose-600 gap-0.5">
                      <TrendingDown size={13} />
                      {visitorGrowth}% vs yesterday
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Total Page Views */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-indigo-900">
                <span className="text-xs font-bold uppercase tracking-wider">Store Page Views</span>
                <Eye size={16} className="text-indigo-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-indigo-950">
                  {isLoading ? '...' : (todayStats.pageViews || 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-indigo-700 font-medium mt-1">
                  Product catalog views today
                </div>
              </div>
            </div>

            {/* WhatsApp Purchases Initiated */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-900">
                <span className="text-xs font-bold uppercase tracking-wider">Purchases Initiated</span>
                <ShoppingBag size={16} className="text-emerald-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                  {isLoading ? '...' : (todayStats.purchasesInitiated || 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">
                  Tapped &quot;Buy via WhatsApp&quot;
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-900">
                <span className="text-xs font-bold uppercase tracking-wider">Conversion Rate</span>
                <TrendingUp size={16} className="text-purple-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-purple-950">
                  {isLoading ? '...' : `${conversionRate}%`}
                </div>
                <div className="text-[11px] text-purple-700 font-medium mt-1">
                  Visitors turning into buyers
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Trend Visualization & All-Time Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
            {/* 7-Day Visual Bars */}
            <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  📈 7-Day Customer Visitor Trend
                </h4>
                <span className="text-[11px] text-slate-400">
                  Deduplicated unique daily visitors
                </span>
              </div>

              {/* Bar Chart Grid */}
              <div className="h-28 flex items-end justify-between gap-2 pt-4 px-2">
                {last7Days.map((day) => {
                  const heightPercent =
                    maxVisitorsInWeek > 0
                      ? Math.max(12, Math.round((day.visitors / maxVisitorsInWeek) * 100))
                      : 12;
                  const isToday = day.label === 'Today';

                  return (
                    <div
                      key={day.dateStr}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                        {day.visitors} customer{day.visitors === 1 ? '' : 's'} ({day.views} views)
                      </div>

                      {/* Bar */}
                      <div className="w-full max-w-[36px] bg-slate-200 rounded-t-lg overflow-hidden flex items-end h-full">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isToday
                              ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-xs'
                              : 'bg-gradient-to-t from-slate-400 to-slate-300 group-hover:from-blue-400 group-hover:to-blue-300'
                          }`}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className={`text-[10px] font-bold truncate max-w-full ${
                          isToday ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All-Time Reach & Google Analytics Chip */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  🌟 All-Time Storefront Reach
                </h4>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                    <span className="text-slate-600">Total Unique Visitors:</span>
                    <span className="font-black text-slate-900">
                      {(overview?.totalUniqueVisitors || todayStats.uniqueVisitors || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200">
                    <span className="text-slate-600">Total Catalog Views:</span>
                    <span className="font-black text-slate-900">
                      {(overview?.totalPageViews || todayStats.pageViews || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-600">Total WhatsApp Buys:</span>
                    <span className="font-black text-emerald-700">
                      {(overview?.totalPurchasesInitiated || todayStats.purchasesInitiated || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Google Analytics status notice */}
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>Google / Firebase Analytics</span>
                  <span className="text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Measurement ID: G-9J35QQ7V6C
                </p>
                <a
                  href="https://analytics.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-semibold flex items-center gap-1 pt-0.5 text-[10px]"
                >
                  <span>Open Google Analytics Console</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
