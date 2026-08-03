import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getSales = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: true,
        payments: true,
        creditHistory: true,
        user: { select: { id: true, username: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: sales });
  } catch (error) {
    next(error);
  }
};

export const getCreditSales = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const creditSales = await prisma.sale.findMany({
      where: { isCredit: true },
      include: {
        items: true,
        payments: true,
        creditHistory: true,
        user: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: creditSales });
  } catch (error) {
    next(error);
  }
};

export const createSale = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { 
      invoiceNumber, 
      customerName, 
      customerPhone, 
      subtotal, 
      discount, 
      total, 
      items, 
      payments, 
      isCredit,
      creditAmount,
      dueDate,
      syncId 
    } = req.body;

    const userId = req.user!.id;
    const branchId = req.user!.branchId;

    if (!branchId) {
      return res.status(400).json({ status: 'error', message: 'User must belong to a branch' });
    }

    if (isCredit && (!customerName || !customerPhone)) {
      return res.status(400).json({ status: 'error', message: 'Customer name and phone number are required for credit sales.' });
    }

    const sale = await prisma.sale.create({
      data: {
        invoiceNumber,
        branchId,
        userId,
        customerName,
        customerPhone,
        subtotal,
        discount,
        total,
        status: isCredit ? 'CREDIT' : 'COMPLETED',
        isCredit: !!isCredit,
        creditAmount: isCredit ? (creditAmount || total) : 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        syncId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal
          }))
        },
        payments: {
          create: payments.map((payment: any) => ({
            method: payment.method,
            amount: payment.amount
          }))
        }
      },
      include: {
        items: true,
        payments: true
      }
    });

    // Update inventory
    for (const item of items) {
      const pb = await prisma.productBranch.findUnique({
        where: { productId_branchId: { productId: item.productId, branchId } }
      });
      if (pb) {
        await prisma.productBranch.update({
          where: { id: pb.id },
          data: { quantity: pb.quantity - item.quantity }
        });
      }
    }

    res.status(201).json({ status: 'success', data: sale });
  } catch (error) {
    next(error);
  }
};

export const recordCreditPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { amount, method, reference, notes } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale || !sale.isCredit) {
      return res.status(404).json({ status: 'error', message: 'Credit sale record not found' });
    }

    const payment = await prisma.creditPayment.create({
      data: {
        saleId: id,
        amount,
        method: method || 'CASH',
        reference,
        notes
      }
    });

    const newPaid = Number(sale.creditPaid) + Number(amount);
    const isFullyPaid = newPaid >= Number(sale.creditAmount);

    await prisma.sale.update({
      where: { id },
      data: {
        creditPaid: newPaid,
        status: isFullyPaid ? 'COMPLETED' : 'CREDIT'
      }
    });

    res.status(200).json({ status: 'success', data: payment });
  } catch (error) {
    next(error);
  }
};
