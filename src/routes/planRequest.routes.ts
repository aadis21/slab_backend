import { Router } from 'express';
import {
  requestPlan,
  requestPlanSchema,
  getMyPlanRequests,
  adminGetAllPlanRequests,
  approvePlanRequest,
  rejectPlanRequest,
  rejectPlanRequestSchema,
} from '../controllers/planRequest.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.use(protect);

// User endpoints
router.post('/request', validate(requestPlanSchema), requestPlan);
router.get('/mine', getMyPlanRequests);

// Admin endpoints
router.get('/admin/list', adminOnly, adminGetAllPlanRequests);
router.patch('/admin/approve/:id', adminOnly, approvePlanRequest);
router.patch('/admin/reject/:id', adminOnly, validate(rejectPlanRequestSchema), rejectPlanRequest);

export default router;
