import { Router } from 'express';
import { getDashboardSummary } from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/dashboard', getDashboardSummary);

export default router;
