import { Router } from 'express';
import { getAccounts, createJournalEntry, getLedger } from '../controllers/accountController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole(['Super Admin', 'Admin', 'Accounts Officer']));

router.get('/', getAccounts);
router.get('/ledger', getLedger);
router.post('/journal', createJournalEntry);

export default router;
