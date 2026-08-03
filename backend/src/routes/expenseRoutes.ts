import { Router } from 'express';
import { getExpenses, createExpense, approveExpense } from '../controllers/expenseController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getExpenses);
router.post('/', createExpense);
router.patch('/:id/approve', requireRole(['Super Admin', 'Admin']), approveExpense);

export default router;
