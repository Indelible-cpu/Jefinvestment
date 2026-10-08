import type { SaleRecord, Expense } from '../store/dataStore';

/**
 * Computes accrual gross profit from a sale (revenue - item costs - discounts).
 */
export function calcSaleProfit(sale: {
  items?: Array<{ quantity: number; unitPrice: number; costPrice?: number; isService?: boolean }>;
  profit?: number;
  discount?: number;
}): number {
  if ((sale as any).profit !== undefined && (sale as any).profit !== null) {
    return Number((sale as any).profit) || 0;
  }
  if (!sale.items || sale.items.length === 0) return 0;

  const gross = sale.items.reduce((sum, item) => {
    const rev = (item.quantity || 0) * (item.unitPrice || 0);
    const cost = (item.costPrice || 0) * (item.quantity || 0);
    return sum + (rev - cost);
  }, 0);

  return gross - (sale.discount || 0);
}

export interface DailyRealizedFinancials {
  date: string;
  // Collections & Revenue
  cashRevenue: number;
  transferRevenue: number;
  totalRealizedRevenue: number;
  newCreditIssued: number; // Uncollected credit debt issued today
  // Costs & Profit
  realizedGrossProfit: number;
  totalExpenses: number;
  realizedNetProfit: number;
  // Daily Savings / Reserve
  savingsPercentage: number;
  dailySavingsTarget: number;
  netRetainedProfit: number; // Net profit remaining after savings allocation
  // Counts
  completedSalesCount: number;
  repaymentsCount: number;
}

/**
 * Calculates daily financial metrics strictly based on REALIZED profit.
 * Excludes uncollected credit sales from profit calculations.
 */
export function calcDailyRealizedProfit(
  reportDate: string,
  sales: SaleRecord[],
  expenses: Expense[],
  savingsPercentage = 10,
  savingsEnabled = true
): DailyRealizedFinancials {
  const completedSales = sales.filter(s => (s.status ?? 'completed') === 'completed');
  const daySales = completedSales.filter(s => s.date === reportDate);
  const dayExpenses = expenses.filter(e => e.date === reportDate);

  let directCashSales = 0;
  let directTransferSales = 0;
  let creditInitialPayments = 0;
  let directRealizedGrossProfit = 0;
  let newCreditIssued = 0;

  daySales.forEach(s => {
    const saleProfit = calcSaleProfit(s);
    const profitMargin = s.total > 0 ? Math.max(0, saleProfit / s.total) : 0;
    const isCreditSale = s.paymentMethod === 'CREDIT' || !!s.isCredit;

    if (isCreditSale) {
      const initialPaid = Math.min(s.total, s.amountPaid || 0);
      creditInitialPayments += initialPaid;
      directRealizedGrossProfit += initialPaid * profitMargin;
      newCreditIssued += Math.max(0, s.total - initialPaid);
    } else {
      const isCash = s.paymentMethod === 'CASH';
      if (isCash) {
        directCashSales += s.total;
      } else {
        directTransferSales += s.total;
      }
      directRealizedGrossProfit += saleProfit;
    }
  });

  // Credit repayments collected today (from any credit sale from any date)
  let repaymentCash = 0;
  let repaymentTransfer = 0;
  let repaymentRealizedGrossProfit = 0;
  let repaymentsCount = 0;

  completedSales.forEach(s => {
    const isCreditSale = s.paymentMethod === 'CREDIT' || !!s.isCredit;
    if (isCreditSale && Array.isArray((s as any).repayments)) {
      const saleProfit = calcSaleProfit(s);
      const profitMargin = s.total > 0 ? Math.max(0, saleProfit / s.total) : 0;

      (s as any).repayments.forEach((rep: any) => {
        if (rep.date && rep.date.startsWith(reportDate)) {
          repaymentsCount++;
          const amount = Number(rep.amount) || 0;
          const method = String(rep.method || 'CASH').toUpperCase();

          if (method === 'CASH') {
            repaymentCash += amount;
          } else {
            repaymentTransfer += amount;
          }
          repaymentRealizedGrossProfit += amount * profitMargin;
        }
      });
    }
  });

  const cashRevenue = directCashSales + creditInitialPayments + repaymentCash;
  const transferRevenue = directTransferSales + repaymentTransfer;
  const totalRealizedRevenue = cashRevenue + transferRevenue;

  const realizedGrossProfit = directRealizedGrossProfit + repaymentRealizedGrossProfit;
  const totalExpenses = dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const realizedNetProfit = realizedGrossProfit - totalExpenses;

  // Savings Target: only from positive realized net profit
  const pct = Math.max(0, Math.min(100, savingsPercentage));
  const dailySavingsTarget = (savingsEnabled && realizedNetProfit > 0)
    ? Math.round(realizedNetProfit * (pct / 100))
    : 0;

  const netRetainedProfit = Math.max(0, realizedNetProfit - dailySavingsTarget);

  return {
    date: reportDate,
    cashRevenue,
    transferRevenue,
    totalRealizedRevenue,
    newCreditIssued,
    realizedGrossProfit: Math.round(realizedGrossProfit),
    totalExpenses,
    realizedNetProfit: Math.round(realizedNetProfit),
    savingsPercentage: pct,
    dailySavingsTarget,
    netRetainedProfit: Math.round(netRetainedProfit),
    completedSalesCount: daySales.length,
    repaymentsCount,
  };
}

export interface RemittanceAppreciation {
  tier: 'LEGENDARY' | 'HIGH' | 'SOLID' | 'GOOD';
  badge: string;
  headline: string;
  message: string;
  shortAppreciation: string;
}

/**
 * Generates personalized, tiered congratulatory appreciation for the cashier
 * based on the magnitude of the savings remittance target reached.
 */
export function getRemittanceAppreciation(
  targetAmount: number,
  cashierName?: string,
  currency = 'MWK'
): RemittanceAppreciation {
  const name = cashierName?.trim() ? cashierName.trim().split(' ')[0] : 'Team';
  const isMajor = ['USD', 'EUR', 'GBP'].includes(currency.toUpperCase());

  // Thresholds: adapted for MWK and major currencies
  const tHigh = isMajor ? 500 : 100000;
  const tMed = isMajor ? 200 : 50000;
  const tLow = isMajor ? 75 : 15000;

  if (targetAmount >= tHigh) {
    return {
      tier: 'LEGENDARY',
      badge: '🏆 Top Performer',
      headline: `Outstanding Work, ${name}! 🚀🔥`,
      message: `Incredible performance today! You reached a huge milestone with this target. Your dedication and hard work make a massive difference to the whole business!`,
      shortAppreciation: `Outstanding work, ${name}! You crushed the target today with an exceptional performance. Your dedication makes a massive difference! 🚀🔥`,
    };
  }

  if (targetAmount >= tMed) {
    return {
      tier: 'HIGH',
      badge: '🌟 Star Performer',
      headline: `Impressive Achievement, ${name}! 🌟💪`,
      message: `Fantastic result today! You reached a remarkable target through your strong effort and focus. Your hard work is truly recognized and appreciated!`,
      shortAppreciation: `Impressive achievement, ${name}! Fantastic job reaching such a great milestone today. Your effort is truly appreciated! 🌟💪`,
    };
  }

  if (targetAmount >= tLow) {
    return {
      tier: 'SOLID',
      badge: '🎉 Great Job',
      headline: `Great Work Today, ${name}! 🎉✨`,
      message: `Solid numbers and great consistency on shift today. Thank you for your energy and great dedication!`,
      shortAppreciation: `Great work today, ${name}! Solid numbers and great dedication on shift. Thank you! 🎉✨`,
    };
  }

  return {
    tier: 'GOOD',
    badge: '👏 Good Effort',
    headline: `Well Done, ${name}! 👏✨`,
    message: `Thank you for your steady effort and commitment today. Keep up the positive energy and momentum!`,
    shortAppreciation: `Well done, ${name}! Thank you for your steady effort and commitment today. Keep it up! 👏✨`,
  };
}

