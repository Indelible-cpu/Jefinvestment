import { Router } from 'express';
import { getEmployees, createEmployee, recordAttendance } from '../controllers/employeeController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole(['Super Admin', 'Admin']));

router.get('/', getEmployees);
router.post('/', createEmployee);
router.post('/attendance', recordAttendance);

export default router;
