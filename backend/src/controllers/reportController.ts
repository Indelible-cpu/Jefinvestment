import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getDashboardSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesToday = await prisma.sale.aggregate({
      where: {
        createdAt: { gte: today },
        status: 'COMPLETED'
      },
      _sum: { total: true },
      _count: true
    });

    const expensesToday = await prisma.expense.aggregate({
      where: {
        createdAt: { gte: today },
        status: 'APPROVED'
      },
      _sum: { amount: true }
    });

    const pendingSyncCount = await prisma.syncQueue.count({
      where: { status: 'PENDING' }
    });

    res.status(200).json({
      status: 'success',
      data: {
        todaySales: salesToday._sum.total || 0,
        todaySalesCount: salesToday._count,
        todayExpenses: expensesToday._sum.amount || 0,
        pendingSyncCount
      }
    });
  } catch (error) {
    next(error);
  }
};
