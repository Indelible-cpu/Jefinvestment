import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.account.findMany();
    res.status(200).json({ status: 'success', data: accounts });
  } catch (error) {
    next(error);
  }
};

export const createJournalEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { accountId, description, debit, credit, reference } = req.body;
    
    const entry = await prisma.journalEntry.create({
      data: {
        accountId,
        description,
        debit: debit || 0,
        credit: credit || 0,
        reference
      }
    });
    
    res.status(201).json({ status: 'success', data: entry });
  } catch (error) {
    next(error);
  }
};

export const getLedger = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: { account: true },
      orderBy: { date: 'desc' }
    });
    res.status(200).json({ status: 'success', data: entries });
  } catch (error) {
    next(error);
  }
};
