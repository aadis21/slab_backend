import { Response } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import WithdrawalRequest from '../models/WithdrawalRequest';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── Create Withdrawal Request ────────────────────────────────────────────────
export const createWithdrawalSchema = z.object({
  amountCents: z.number().int().positive('Amount must be a positive integer (cents)'),
  walletAddress: z.string().min(1, 'Wallet address is required'),
});

export const createWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amountCents, walletAddress } = req.body as z.infer<typeof createWithdrawalSchema>;
    const userId = req.user?.userId;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (amountCents > user.walletBalance) {
      res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
      return;
    }

    // Check no pending withdrawal exists
    const pendingExists = await WithdrawalRequest.findOne({ user: userId, status: 'pending' });
    if (pendingExists) {
      res.status(409).json({ success: false, error: 'You already have a pending withdrawal request' });
      return;
    }

    const withdrawal = await WithdrawalRequest.create({ user: userId, amountCents, walletAddress });
    res.status(201).json({ success: true, data: { withdrawal } });
  } catch (err) {
    console.error('Create withdrawal error:', err);
    res.status(500).json({ success: false, error: 'Server error creating withdrawal' });
  }
};

// ─── Get My Withdrawals ───────────────────────────────────────────────────────
export const getMyWithdrawals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const withdrawals = await WithdrawalRequest.find({ user: req.user?.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: { withdrawals } });
  } catch (err) {
    console.error('Get my withdrawals error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Get All Withdrawals ───────────────────────────────────────────────
export const adminGetAllWithdrawals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, string> = {};
    if (status && typeof status === 'string') filter.status = status;

    const withdrawals = await WithdrawalRequest.find(filter)
      .populate('user', 'name phone email walletBalance')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { withdrawals } });
  } catch (err) {
    console.error('Admin get withdrawals error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Approve Withdrawal ────────────────────────────────────────────────
export const approveWithdrawalSchema = z.object({
  adminNote: z.string().optional(),
});

export const approveWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body as z.infer<typeof approveWithdrawalSchema>;
    const adminId = req.user?.userId;

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      res.status(404).json({ success: false, error: 'Withdrawal request not found' });
      return;
    }
    if (withdrawal.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Withdrawal request is already processed' });
      return;
    }

    const user = await User.findById(withdrawal.user);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (withdrawal.amountCents > user.walletBalance) {
      res.status(400).json({ success: false, error: 'User has insufficient balance' });
      return;
    }

    // Deduct from wallet
    user.walletBalance -= withdrawal.amountCents;
    await user.save();

    // Generate unique payout wallet ID
    const payoutWalletId = 'WLT-' + nanoid(12).toUpperCase();

    withdrawal.status = 'approved';
    withdrawal.payoutWalletId = payoutWalletId;
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewedBy = new (require('mongoose').Types.ObjectId)(adminId);
    if (adminNote) withdrawal.adminNote = adminNote;
    await withdrawal.save();

    res.json({
      success: true,
      data: { message: 'Withdrawal approved.', payoutWalletId },
    });
  } catch (err) {
    console.error('Approve withdrawal error:', err);
    res.status(500).json({ success: false, error: 'Server error approving withdrawal' });
  }
};

// ─── Admin: Reject Withdrawal ─────────────────────────────────────────────────
export const rejectWithdrawalSchema = z.object({
  adminNote: z.string().optional(),
});

export const rejectWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body as z.infer<typeof rejectWithdrawalSchema>;
    const adminId = req.user?.userId;

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      res.status(404).json({ success: false, error: 'Withdrawal request not found' });
      return;
    }
    if (withdrawal.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Withdrawal request is already processed' });
      return;
    }

    withdrawal.status = 'rejected';
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewedBy = new (require('mongoose').Types.ObjectId)(adminId);
    if (adminNote) withdrawal.adminNote = adminNote;
    await withdrawal.save();

    res.json({ success: true, data: { message: 'Withdrawal rejected.' } });
  } catch (err) {
    console.error('Reject withdrawal error:', err);
    res.status(500).json({ success: false, error: 'Server error rejecting withdrawal' });
  }
};
