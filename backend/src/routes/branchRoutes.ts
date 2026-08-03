import { Router } from 'express';
import { getBranches, createBranch } from '../controllers/branchController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getBranches);
router.post('/', requireRole(['Super Admin']), createBranch);

export default router;
