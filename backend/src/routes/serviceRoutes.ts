import { Router } from 'express';
import { getServiceCategories, createServiceCategory, createServiceTransaction } from '../controllers/serviceController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/categories', getServiceCategories);
router.post('/categories', requireRole(['Super Admin', 'Admin']), createServiceCategory);
router.post('/transactions', createServiceTransaction);

export default router;
