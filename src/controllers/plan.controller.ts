import { Request, Response } from 'express';
import { z } from 'zod';
import Plan from '../models/Plan';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── Get All Plans ────────────────────────────────────────────────────────────
export const getAllPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ priceUSD: 1 });
    res.json({ success: true, data: { plans } });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching plans' });
  }
};

// ─── Get Plan By ID ───────────────────────────────────────────────────────────
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan || !plan.isActive) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }
    res.json({ success: true, data: { plan } });
  } catch (err) {
    console.error('Get plan error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching plan' });
  }
};

// ─── Admin: Get All Plans (including inactive) ────────────────────────────────
export const adminGetAllPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find().sort({ priceUSD: 1 });
    res.json({ success: true, data: { plans } });
  } catch (err) {
    console.error('Admin get plans error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Create Plan Schema ───────────────────────────────────────────────────────
export const createPlanSchema = z.object({
  name: z.string().min(1),
  priceUSD: z.number().positive(),           // in cents
  minInvestmentUSD: z.number().positive(),   // in cents
  annualReturnPercent: z.number().positive(),
  durationDays: z.number().positive().default(30),
  features: z.array(z.string()),
  isRecommended: z.boolean().default(false),
  color: z.string().min(1),
});

// ─── Admin: Create Plan ───────────────────────────────────────────────────────
export const createPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as z.infer<typeof createPlanSchema>;
    const plan = await Plan.create({ ...data, isActive: true });
    res.status(201).json({ success: true, data: { plan } });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ success: false, error: 'Server error creating plan' });
  }
};

// ─── Admin: Update Plan ───────────────────────────────────────────────────────
export const updatePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }
    res.json({ success: true, data: { plan } });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ success: false, error: 'Server error updating plan' });
  }
};

// ─── Admin: Delete Plan (soft) ────────────────────────────────────────────────
export const deletePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }
    res.json({ success: true, data: { message: 'Plan deactivated' } });
  } catch (err) {
    console.error('Delete plan error:', err);
    res.status(500).json({ success: false, error: 'Server error deleting plan' });
  }
};
