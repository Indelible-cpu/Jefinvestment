import { Router } from 'express';
import authRoutes from './authRoutes';
import inventoryRoutes from './inventoryRoutes';
import branchRoutes from './branchRoutes';
import userRoutes from './userRoutes';
import serviceRoutes from './serviceRoutes';
import expenseRoutes from './expenseRoutes';
import saleRoutes from './saleRoutes';
import accountRoutes from './accountRoutes';
import reportRoutes from './reportRoutes';
import employeeRoutes from './employeeRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/branches', branchRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);
router.use('/expenses', expenseRoutes);
router.use('/sales', saleRoutes);
router.use('/accounts', accountRoutes);
router.use('/reports', reportRoutes);
router.use('/employees', employeeRoutes);

export default router;
