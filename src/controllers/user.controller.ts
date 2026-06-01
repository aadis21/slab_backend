import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import User from '../models/User';
import PlanRequest from '../models/PlanRequest';
import Referral from '../models/Referral';
import WithdrawalRequest from '../models/WithdrawalRequest';
import Donation from '../models/Donation';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const user = await User.findById(userId)
      .select('-password -otp -otpExpiry')
      .populate('activePlan', 'name priceUSD annualReturnPercent color durationDays');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Referral bonus earned
    const referralAgg = await Referral.aggregate([
      {
        $match: {
          referrer: new mongoose.Types.ObjectId(userId),
          bonusAwarded: true,
        },
      },
      { $group: { _id: null, totalBonus: { $sum: '$bonusAmount' } } },
    ]);
    const referralBonusCents = referralAgg[0]?.totalBonus || 0;

    // Referral count
    const referralCount = await Referral.countDocuments({ referrer: userId });

    // Active plan request
    const activePlanRequest = await PlanRequest.findOne({ user: userId, status: 'pending' })
      .populate('plan', 'name priceUSD annualReturnPercent');

    // Recent plan requests
    const recentRequests = await PlanRequest.find({ user: userId })
      .populate('plan', 'name priceUSD annualReturnPercent color')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          walletBalance: user.walletBalance, // cents
          activePlan: user.activePlan
            ? (user.activePlan as unknown as { name: string }).name
            : 'None',
          referralCount,
          referralBonusCents,
        },
        activePlanRequest: activePlanRequest || null,
        recentRequests,
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching dashboard stats' });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body as z.infer<typeof updateProfileSchema>;
    const user = await User.findByIdAndUpdate(
      req.user?.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user } });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Server error updating profile' });
  }
};

// ─── Admin: Get All Users ─────────────────────────────────────────────────────
export const adminGetAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password -otp -otpExpiry')
      .populate('activePlan', 'name priceUSD color')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { users } });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Get Single User Detail ────────────────────────────────────────────
export const adminGetUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry')
      .populate('activePlan', 'name priceUSD annualReturnPercent color')
      .populate('referredBy', 'name phone');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const planRequests = await PlanRequest.find({ user: user._id })
      .populate('plan', 'name priceUSD annualReturnPercent')
      .sort({ createdAt: -1 });

    const withdrawals = await WithdrawalRequest.find({ user: user._id }).sort({ createdAt: -1 });

    const referrals = await Referral.find({ referrer: user._id })
      .populate('referee', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { user, planRequests, withdrawals, referrals } });
  } catch (err) {
    console.error('Admin get user error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Add Wallet Balance ────────────────────────────────────────────────
export const adminAddWalletSchema = z.object({
  amountCents: z.number().int().positive('Amount must be a positive integer (cents)'),
  note: z.string().optional(),
});

export const adminAddWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amountCents } = req.body as z.infer<typeof adminAddWalletSchema>;
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $inc: { walletBalance: amountCents } },
      { new: true }
    ).select('-password -otp -otpExpiry');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: { message: `Added $${(amountCents / 100).toFixed(2)} to wallet`, walletBalance: user.walletBalance },
    });
  } catch (err) {
    console.error('Admin add wallet error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Toggle User Active Status ────────────────────────────────────────
export const adminToggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, data: { message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive } });
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Dashboard Stats ───────────────────────────────────────────────────
export const adminGetStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalPlans,
      pendingPlanRequests,
      pendingWithdrawals,
      walletAgg,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isActive: true }),
      (await import('../models/Plan')).default.countDocuments({ isActive: true }),
      PlanRequest.countDocuments({ status: 'pending' }),
      WithdrawalRequest.countDocuments({ status: 'pending' }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$walletBalance' } } }]),
    ]);

    const totalWalletBalanceCents = walletAgg[0]?.total || 0;

    const recentPlanRequests = await PlanRequest.find()
      .populate('user', 'name phone')
      .populate('plan', 'name priceUSD color')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentWithdrawals = await WithdrawalRequest.find()
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalPlans,
        pendingPlanRequests,
        pendingWithdrawals,
        totalWalletBalanceCents,
        recentPlanRequests,
        recentWithdrawals,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching admin stats' });
  }
};

// ─── Admin: Create User ────────────────────────────────────────────────────────
export const adminCreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['user', 'admin']).default('user'),
  walletBalance: z.number().int().min(0).default(0), // in cents
  isActive: z.boolean().default(true),
});

export const adminCreateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = req.body as z.infer<typeof adminCreateUserSchema>;
    const emailVal = data.email && data.email !== '' ? data.email.trim().toLowerCase() : undefined;

    // Check if phone already registered
    const existingPhone = await User.findOne({ phone: data.phone.trim() });
    if (existingPhone) {
      res.status(409).json({ success: false, error: 'Phone number already registered' });
      return;
    }

    // Check if email already registered (if provided)
    if (emailVal) {
      const existingEmail = await User.findOne({ email: emailVal });
      if (existingEmail) {
        res.status(409).json({ success: false, error: 'Email already registered' });
        return;
      }
    }

    const newUser = await User.create({
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: emailVal,
      password: data.password, // hashed automatically by UserSchema's pre-save middleware
      role: data.role,
      walletBalance: data.walletBalance,
      isActive: data.isActive,
      isVerified: true, // Admin-created users are pre-verified
    });

    const userResponse = newUser.toObject();
    delete (userResponse as any).password;
    delete (userResponse as any).otp;
    delete (userResponse as any).otpExpiry;

    res.status(201).json({ success: true, data: { user: userResponse } });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ success: false, error: 'Server error creating user' });
  }
};

// ─── Admin: Update User ────────────────────────────────────────────────────────
export const adminUpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['user', 'admin']).optional(),
  walletBalance: z.number().int().min(0).optional(), // in cents
  isActive: z.boolean().optional(),
});

export const adminUpdateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body as z.infer<typeof adminUpdateUserSchema>;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check phone uniqueness if updated
    if (data.phone && data.phone !== user.phone) {
      const existingPhone = await User.findOne({ phone: data.phone.trim() });
      if (existingPhone) {
        res.status(409).json({ success: false, error: 'Phone number already registered' });
        return;
      }
      user.phone = data.phone.trim();
    }

    // Check email uniqueness if updated
    if (data.email !== undefined) {
      const emailVal = data.email && data.email !== '' ? data.email.trim().toLowerCase() : undefined;
      if (emailVal && emailVal !== user.email) {
        const existingEmail = await User.findOne({ email: emailVal });
        if (existingEmail) {
          res.status(409).json({ success: false, error: 'Email already registered' });
          return;
        }
      }
      user.email = emailVal;
    }

    if (data.name) user.name = data.name.trim();
    if (data.role) user.role = data.role;
    if (data.walletBalance !== undefined) user.walletBalance = data.walletBalance;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    await user.save();

    const userResponse = user.toObject();
    delete (userResponse as any).password;
    delete (userResponse as any).otp;
    delete (userResponse as any).otpExpiry;

    res.json({ success: true, data: { user: userResponse } });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ success: false, error: 'Server error updating user' });
  }
};

// ─── Admin: Delete User ────────────────────────────────────────────────────────
export const adminDeleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Clean up referrals and other user data as needed (optional but good practice)
    await Promise.all([
      PlanRequest.deleteMany({ user: id }),
      WithdrawalRequest.deleteMany({ user: id }),
      Referral.deleteMany({ $or: [{ referrer: id }, { referee: id }] }),
      Donation.deleteMany({ user: id }),
    ]);

    res.json({ success: true, data: { message: 'User and all related records deleted successfully' } });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ success: false, error: 'Server error deleting user' });
  }
};

