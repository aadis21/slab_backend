import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import PlanRequest from '../models/PlanRequest';
import User from '../models/User';
import Plan from '../models/Plan';
import Referral from '../models/Referral';
import { AuthRequest } from '../middleware/auth.middleware';
import { creditWallet } from '../services/wallet.service';
import { distributeLevelIncome } from '../services/levelIncome.service';

// ─── Request a Plan ───────────────────────────────────────────────────────────
export const requestPlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID required'),
});

export const requestPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.body as z.infer<typeof requestPlanSchema>;
    const userId = req.user?.userId;

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    // Check if user already has a pending request for this plan
    const existing = await PlanRequest.findOne({ user: userId, plan: planId, status: 'pending' });
    if (existing) {
      res.status(409).json({ success: false, error: 'You already have a pending request for this plan' });
      return;
    }

    const planRequest = await PlanRequest.create({ user: userId, plan: planId });
    res.status(201).json({ success: true, data: { planRequest } });
  } catch (err) {
    console.error('Request plan error:', err);
    res.status(500).json({ success: false, error: 'Server error requesting plan' });
  }
};

// ─── Get My Plan Requests ─────────────────────────────────────────────────────
export const getMyPlanRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await PlanRequest.find({ user: req.user?.userId })
      .populate('plan', 'name priceUSD annualReturnPercent color durationDays')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { requests } });
  } catch (err) {
    console.error('Get my plan requests error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Get All Plan Requests ─────────────────────────────────────────────
export const adminGetAllPlanRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, string> = {};
    if (status && typeof status === 'string') filter.status = status;

    const requests = await PlanRequest.find(filter)
      .populate('user', 'name phone email referralCode')
      .populate('plan', 'name priceUSD annualReturnPercent color')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { requests } });
  } catch (err) {
    console.error('Admin get plan requests error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Approve Plan Request ──────────────────────────────────────────────
export const approvePlanRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const adminId = req.user?.userId;

    const planReq = await PlanRequest.findById(id).populate('plan').session(session);
    if (!planReq) {
      await session.abortTransaction();
      res.status(404).json({ success: false, error: 'Plan request not found' });
      return;
    }
    if (planReq.status !== 'pending') {
      await session.abortTransaction();
      res.status(400).json({ success: false, error: 'Plan request is already processed' });
      return;
    }

    // Update the plan request status
    planReq.status = 'approved';
    planReq.reviewedAt = new Date();
    planReq.reviewedBy = new mongoose.Types.ObjectId(adminId);
    await planReq.save({ session });

    // Set user's active plan
    await User.findByIdAndUpdate(
      planReq.user,
      { activePlan: planReq.plan, planActivatedAt: new Date() },
      { session }
    );

    // Award direct referral bonus to referrer if not yet awarded
    const referral = await Referral.findOne({
      referee: planReq.user,
      bonusAwarded: false,
    }).session(session);

    let referrerId: string | null = null;
    let bonusAmount = 0;

    if (referral) {
      referrerId = referral.referrer.toString();
      bonusAmount = referral.bonusAmount;

      referral.bonusAwarded = true;
      await referral.save({ session });
    }

    // Commit the main transaction first
    await session.commitTransaction();

    // ─── Post-commit: Fire non-blocking side effects ──────────────────────────
    // 1. Credit direct referral bonus to referrer's 'direct' wallet
    if (referrerId && bonusAmount > 0) {
      creditWallet(
        referrerId,
        'direct',
        bonusAmount,
        `Direct referral bonus from plan approval`,
        planReq.user.toString(),
        planReq.plan.toString()
      ).catch((err: unknown) =>
        console.error('Failed to credit direct referral bonus:', err)
      );
    }

    // 2. Distribute level income up to 9 levels (fire-and-forget)
    const planDoc = planReq.plan as unknown as { _id: mongoose.Types.ObjectId; priceUSD: number };
    const planAmount = planDoc?.priceUSD ?? 0;
    const planId = planDoc?._id?.toString() ?? '';

    if (planAmount > 0 && planId) {
      distributeLevelIncome(planReq.user.toString(), planAmount, planId).catch((err: unknown) =>
        console.error('Level income distribution error:', err)
      );
    }

    res.json({ success: true, data: { message: 'Plan request approved. Subscription activated.' } });
  } catch (err) {
    await session.abortTransaction();
    console.error('Approve plan request error:', err);
    res.status(500).json({ success: false, error: 'Server error approving plan request' });
  } finally {
    session.endSession();
  }
};

// ─── Admin: Reject Plan Request ───────────────────────────────────────────────
export const rejectPlanRequestSchema = z.object({
  adminNote: z.string().optional(),
});

export const rejectPlanRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body as z.infer<typeof rejectPlanRequestSchema>;
    const adminId = req.user?.userId;

    const planReq = await PlanRequest.findById(id);
    if (!planReq) {
      res.status(404).json({ success: false, error: 'Plan request not found' });
      return;
    }
    if (planReq.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Plan request is already processed' });
      return;
    }

    planReq.status = 'rejected';
    planReq.reviewedAt = new Date();
    planReq.reviewedBy = new mongoose.Types.ObjectId(adminId);
    if (adminNote) planReq.adminNote = adminNote;
    await planReq.save();

    res.json({ success: true, data: { message: 'Plan request rejected.' } });
  } catch (err) {
    console.error('Reject plan request error:', err);
    res.status(500).json({ success: false, error: 'Server error rejecting plan request' });
  }
};
