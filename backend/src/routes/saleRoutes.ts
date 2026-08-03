import { Router } from 'express';
import { getSales, getCreditSales, createSale, recordCreditPayment } from '../controllers/saleController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getSales);
router.get('/credit', getCreditSales);
router.post('/', createSale);
router.post('/:id/repay', recordCreditPayment);

export default router;
