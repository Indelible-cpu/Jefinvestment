import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getExpenses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        category: true,
        user: { select: { id: true, username: true } }
      }
    });
    res.status(200).json({ status: 'success', data: expenses });
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { categoryId, amount, description, syncId } = req.body;
    const userId = req.user!.id;
    const branchId = req.user!.branchId;

    if (!branchId) {
      return res.status(400).json({ status: 'error', message: 'User must belong to a branch' });
    }

    const expense = await prisma.expense.create({
      data: {
        categoryId,
        amount,
        description,
        userId,
        branchId,
        syncId,
        status: 'PENDING'
      }
    });
    
    res.status(201).json({ status: 'success', data: expense });
  } catch (error) {
    next(error);
  }
};

export const approveExpense = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const expense = await prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED' }
    });
    res.status(200).json({ status: 'success', data: expense });
  } catch (error) {
    next(error);
  }
};
