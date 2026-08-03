import { Router } from 'express';
import { getUsers, createUser } from '../controllers/userController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['Super Admin', 'Admin']), getUsers);
router.post('/', requireRole(['Super Admin']), createUser);

export default router;
