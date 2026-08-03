import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getBranches = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        users: { select: { id: true, username: true, role: true } }
      }
    });
    res.status(200).json({ status: 'success', data: branches });
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, phone } = req.body;
    const branch = await prisma.branch.create({
      data: { name, address, phone }
    });
    res.status(201).json({ status: 'success', data: branch });
  } catch (error) {
    next(error);
  }
};
