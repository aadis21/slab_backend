import { Router } from 'express';
import {
  getReferralStats,
  getReferralTree,
  adminGetReferralTree,
  adminGetAllReferrals,
} from '../controllers/referral.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// User endpoints
router.get('/', getReferralStats);
router.get('/tree', getReferralTree);

// Admin endpoints
router.get('/admin/list', adminOnly, adminGetAllReferrals);
router.get('/admin/tree/:userId', adminOnly, adminGetReferralTree);

export default router;
