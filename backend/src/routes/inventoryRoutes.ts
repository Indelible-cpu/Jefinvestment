import { Router } from 'express';
import { getProducts, createProduct } from '../controllers/inventoryController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/products', getProducts);
router.post('/products', requireRole(['Super Admin', 'Admin']), createProduct);

export default router;
