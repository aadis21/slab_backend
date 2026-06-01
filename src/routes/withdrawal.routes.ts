import { Router } from 'express';
import {
  createWithdrawal,
  createWithdrawalSchema,
  getMyWithdrawals,
  adminGetAllWithdrawals,
  approveWithdrawal,
  approveWithdrawalSchema,
  rejectWithdrawal,
  rejectWithdrawalSchema,
} from '../controllers/withdrawal.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.use(protect);

// User endpoints
router.post('/request', validate(createWithdrawalSchema), createWithdrawal);
router.get('/mine', getMyWithdrawals);

// Admin endpoints
router.get('/admin/list', adminOnly, adminGetAllWithdrawals);
router.patch('/admin/approve/:id', adminOnly, validate(approveWithdrawalSchema), approveWithdrawal);
router.patch('/admin/reject/:id', adminOnly, validate(rejectWithdrawalSchema), rejectWithdrawal);

export default router;
