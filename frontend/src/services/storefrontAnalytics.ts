import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, trackAnalyticsEvent } from '../lib/firebase';

export interface DailyAnalytics {
  id: string; // YYYY-MM-DD
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  cartAdds: number;
  purchasesInitiated: number;
  revenuePotential?: number;
  updatedAt?: any;
}

export interface AnalyticsOverview {
  totalPageViews: number;
  totalUniqueVisitors: number;
  totalCartAdds: number;
  totalPurchasesInitiated: number;
  totalRevenuePotential: number;
  lastVisitAt?: any;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Tracks a visit to the storefront.
 * Concurrency-safe, deduplicates visitors per day using localStorage/sessionStorage.
 */
export async function trackStorefrontVisit(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const today = getTodayString();
    const lastVisitedDate = localStorage.getItem('msika_visitor_last_date');

    // It's a unique visitor if they haven't visited today yet
    const isUniqueToday = lastVisitedDate !== today;

    // Always increment page view; only increment unique visitor if unique today
    const dailyRef = doc(db, 'storefrontAnalytics', today);
    const overviewRef = doc(db, 'storefrontAnalytics', 'overview');

    const dailyUpdate: Record<string, any> = {
      date: today,
      pageViews: increment(1),
      updatedAt: serverTimestamp(),
    };

    const overviewUpdate: Record<string, any> = {
      totalPageViews: increment(1),
      lastVisitAt: serverTimestamp(),
    };

    if (isUniqueToday) {
      dailyUpdate.uniqueVisitors = increment(1);
      overviewUpdate.totalUniqueVisitors = increment(1);
    }

    // Fire and forget Firestore increments (fails gracefully if offline)
    Promise.all([
      setDoc(dailyRef, dailyUpdate, { merge: true }),
      setDoc(overviewRef, overviewUpdate, { merge: true }),
    ]).catch((err) => {
      console.warn('Storefront analytics visit increment notice:', err);
    });

    // Mark as visited in browser storage
    localStorage.setItem('msika_visitor_last_date', today);
    sessionStorage.setItem('msika_visited_session', 'true');

    // Also send Google Analytics event
    trackAnalyticsEvent('page_view', {
      page_title: 'Storefront',
      page_location: window.location.href,
      is_unique_today: isUniqueToday,
    });
  } catch (e) {
    // Non-blocking fail-safe
  }
}

/**
 * Tracks when a customer adds an item to their cart.
 */
export function trackCartAdd(item: { id: string; name: string; sellingPrice?: number }): void {
  try {
    const today = getTodayString();
    const dailyRef = doc(db, 'storefrontAnalytics', today);
    const overviewRef = doc(db, 'storefrontAnalytics', 'overview');

    Promise.all([
      setDoc(dailyRef, { date: today, cartAdds: increment(1) }, { merge: true }),
      setDoc(overviewRef, { totalCartAdds: increment(1) }, { merge: true }),
    ]).catch(() => {});

    trackAnalyticsEvent('add_to_cart', {
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          price: item.sellingPrice || 0,
        },
      ],
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Tracks when a customer taps 'Buy via WhatsApp' and proceeds to checkout.
 */
export function trackPurchaseInitiated(payload: {
  orderId: string;
  total: number;
  itemCount: number;
}): void {
  try {
    const today = getTodayString();
    const dailyRef = doc(db, 'storefrontAnalytics', today);
    const overviewRef = doc(db, 'storefrontAnalytics', 'overview');

    Promise.all([
      setDoc(
        dailyRef,
        {
          date: today,
          purchasesInitiated: increment(1),
          revenuePotential: increment(payload.total || 0),
        },
        { merge: true }
      ),
      setDoc(
        overviewRef,
        {
          totalPurchasesInitiated: increment(1),
          totalRevenuePotential: increment(payload.total || 0),
        },
        { merge: true }
      ),
    ]).catch(() => {});

    trackAnalyticsEvent('begin_checkout', {
      transaction_id: payload.orderId,
      value: payload.total,
      currency: 'MWK',
      items_count: payload.itemCount,
    });
  } catch (e) {
    // Non-blocking
  }
}
