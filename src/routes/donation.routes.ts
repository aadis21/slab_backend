import { Router } from 'express';
import {
  submitDonation,
  createDonationSchema,
  getMyDonations,
  adminGetAllDonations,
  approveDonation,
  rejectDonation,
} from '../controllers/donation.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.use(protect);

// User endpoints
router.post('/', validate(createDonationSchema), submitDonation);
router.get('/mine', getMyDonations);

// Admin endpoints
router.get('/admin/list', adminOnly, adminGetAllDonations);
router.patch('/admin/approve/:id', adminOnly, approveDonation);
router.patch('/admin/reject/:id', adminOnly, rejectDonation);

export default router;
