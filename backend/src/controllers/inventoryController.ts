import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        variants: true,
        branches: {
          include: { branch: true }
        }
      }
    });
    res.status(200).json({ status: 'success', data: products });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, categoryId, sku, barcode, description, unit, costPrice, sellingPrice, reorderLevel, isService } = req.body;
    
    const product = await prisma.product.create({
      data: {
        name, categoryId, sku, barcode, description, unit, costPrice, sellingPrice, reorderLevel, isService
      }
    });
    
    res.status(201).json({ status: 'success', data: product });
  } catch (error) {
    next(error);
  }
};
