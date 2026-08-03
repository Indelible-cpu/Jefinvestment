import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

export const getEmployees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { attendances: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: employees });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, role, salary } = req.body;
    const employee = await prisma.employee.create({
      data: { firstName, lastName, phone, role, salary: salary || 0 }
    });
    res.status(201).json({ status: 'success', data: employee });
  } catch (error) {
    next(error);
  }
};

export const recordAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { employeeId, status } = req.body;
    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: new Date(),
        status
      }
    });
    res.status(201).json({ status: 'success', data: attendance });
  } catch (error) {
    next(error);
  }
};
