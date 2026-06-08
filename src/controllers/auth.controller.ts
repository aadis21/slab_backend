import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import Referral from '../models/Referral';
import { signToken } from '../utils/jwt';
import { sendOtp, verifyOtp } from '../utils/otp';
import { AuthRequest } from '../middleware/auth.middleware';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ─── Register ────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  referralCode: z.string().optional(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, password, referralCode } = req.body as z.infer<typeof registerSchema>;

    const existing = await User.findOne({ phone });
    if (existing) {
      res.status(409).json({ success: false, error: 'Phone number already registered' });
      return;
    }

    // Resolve referral
    let referredBy;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const user = await User.create({ name, phone, password, referredBy, isVerified: true });

    // Create referral record if referred
    if (referredBy) {
      await Referral.create({ referrer: referredBy, referee: user._id });
    }

    const token = signToken(user._id.toString(), user.role);

    res.cookie('token', token, cookieOptions);
    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          wallet: user.wallet,
        },
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(1, 'Password required'),
});

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body as z.infer<typeof loginSchema>;

    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid phone or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, error: 'Account is deactivated. Contact support.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid phone or password' });
      return;
    }

    const token = signToken(user._id.toString(), user.role);

    res.cookie('token', token, cookieOptions);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          wallet: user.wallet,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
};

// ─── Send OTP ─────────────────────────────────────────────────────────────────
export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
});

export const sendOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body as z.infer<typeof sendOtpSchema>;
    const result = await sendOtp(phone);
    if (!result.success) {
      res.status(404).json({ success: false, error: result.message });
      return;
    }
    res.json({ success: true, data: { message: result.message } });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, error: 'Server error sending OTP' });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const verifyOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body as z.infer<typeof verifyOtpSchema>;
    const result = await verifyOtp(phone, otp);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.message });
      return;
    }

    const user = await User.findOne({ phone });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const token = signToken(user._id.toString(), user.role);
    res.cookie('token', token, cookieOptions);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          wallet: user.wallet,
        },
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, error: 'Server error verifying OTP' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({ success: true, data: { message: 'Logged out successfully' } });
};

// ─── Get Me ───────────────────────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId)
      .select('-password -otp -otpExpiry')
      .populate('activePlan', 'name priceUSD annualReturnPercent color');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user } });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
