import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getServiceCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.serviceCategory.findMany();
    res.status(200).json({ status: 'success', data: categories });
  } catch (error) {
    next(error);
  }
};

export const createServiceCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const category = await prisma.serviceCategory.create({ data: { name } });
    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    next(error);
  }
};

export const createServiceTransaction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { categoryId, serviceName, quantity, unitPrice, total, notes, syncId } = req.body;
    const operatorId = req.user!.id;
    
    const transaction = await prisma.serviceTransaction.create({
      data: {
        categoryId,
        serviceName,
        quantity,
        unitPrice,
        total,
        operatorId,
        notes,
        syncId
      }
    });
    
    res.status(201).json({ status: 'success', data: transaction });
  } catch (error) {
    next(error);
  }
};
