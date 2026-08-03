import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        lastLogin: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } }
      }
    });
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, roleId, branchId } = req.body;
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        roleId,
        branchId
      }
    });
    
    res.status(201).json({ status: 'success', data: { id: user.id, username: user.username } });
  } catch (error) {
    next(error);
  }
};
