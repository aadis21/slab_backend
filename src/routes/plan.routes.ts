import { Router } from 'express';
import {
  getAllPlans,
  getPlanById,
  adminGetAllPlans,
  createPlan,
  createPlanSchema,
  updatePlan,
  deletePlan,
} from '../controllers/plan.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// Public/User endpoints
router.get('/', getAllPlans);
router.get('/:id', getPlanById);

// Admin endpoints (require auth & admin role)
router.get('/admin/all', protect, adminOnly, adminGetAllPlans);
router.post('/admin/create', protect, adminOnly, validate(createPlanSchema), createPlan);
router.patch('/admin/update/:id', protect, adminOnly, updatePlan);
router.delete('/admin/delete/:id', protect, adminOnly, deletePlan);

export default router;
