import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Donation from '../models/Donation';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── Create Donation Schema ──────────────────────────────────────────────────
export const createDonationSchema = z.object({
  donorName: z.string().min(1, 'Donor name is required'),
  donorEmail: z.string().email('Valid donor email is required'),
  amountCents: z.number().int().positive('Amount must be positive in cents'),
  transactionId: z.string().min(1, 'Transaction ID/Reference is required'),
});

// ─── Submit a Donation ────────────────────────────────────────────────────────
export const submitDonation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { donorName, donorEmail, amountCents, transactionId } = req.body as z.infer<
      typeof createDonationSchema
    >;
    const userId = req.user?.userId;

    // Check if transaction ID is already registered to avoid duplicates
    const duplicate = await Donation.findOne({ transactionId: transactionId.trim() });
    if (duplicate) {
      res.status(409).json({
        success: false,
        error: 'This Transaction ID has already been submitted',
      });
      return;
    }

    const donation = await Donation.create({
      user: userId,
      donorName: donorName.trim(),
      donorEmail: donorEmail.trim().toLowerCase(),
      amountCents,
      transactionId: transactionId.trim(),
      status: 'pending',
    });

    res.status(201).json({ success: true, data: { donation } });
  } catch (err) {
    console.error('Submit donation error:', err);
    res.status(500).json({ success: false, error: 'Server error submitting donation' });
  }
};

// ─── Get My Donations ─────────────────────────────────────────────────────────
export const getMyDonations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const donations = await Donation.find({ user: userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: { donations } });
  } catch (err) {
    console.error('Get my donations error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching donations' });
  }
};

// ─── Admin: Get All Donations ──────────────────────────────────────────────────
export const adminGetAllDonations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const donations = await Donation.find(filter)
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { donations } });
  } catch (err) {
    console.error('Admin get donations error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching all donations' });
  }
};

// ─── Admin: Approve Donation ───────────────────────────────────────────────────
export const approveDonation = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    const donation = await Donation.findById(id).session(session);
    if (!donation) {
      await session.abortTransaction();
      res.status(404).json({ success: false, error: 'Donation record not found' });
      return;
    }

    if (donation.status !== 'pending') {
      await session.abortTransaction();
      res.status(400).json({ success: false, error: 'Donation has already been processed' });
      return;
    }

    // Approve the donation
    donation.status = 'approved';
    await donation.save({ session });

    // Since this is a donation, let's credit the user's wallet if specified
    // Note: The user request mentions: "payemnt hum apni saccner lageyeg euqr code kii image aur jitni payment kr ahai vo jo user krha ahi uskii utni amount aa jaaye"
    // Meaning the amount they donate or top up via scanner should credit their user wallet balance when approved!
    await User.findByIdAndUpdate(
      donation.user,
      { $inc: { walletBalance: donation.amountCents } },
      { session }
    );

    await session.commitTransaction();
    res.json({
      success: true,
      data: { message: 'Donation approved. Wallet balance updated.', donation },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Approve donation error:', err);
    res.status(500).json({ success: false, error: 'Server error approving donation' });
  } finally {
    session.endSession();
  }
};

// ─── Admin: Reject Donation ────────────────────────────────────────────────────
export const rejectDonation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const donation = await Donation.findById(id);
    if (!donation) {
      res.status(404).json({ success: false, error: 'Donation record not found' });
      return;
    }

    if (donation.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Donation has already been processed' });
      return;
    }

    donation.status = 'rejected';
    await donation.save();

    res.json({ success: true, data: { message: 'Donation rejected.', donation } });
  } catch (err) {
    console.error('Reject donation error:', err);
    res.status(500).json({ success: false, error: 'Server error rejecting donation' });
  }
};
