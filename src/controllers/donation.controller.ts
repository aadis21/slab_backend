import { Response } from 'express';
import { z } from 'zod';
import Donation from '../models/Donation';
import { AuthRequest } from '../middleware/auth.middleware';
import { creditWallet } from '../services/wallet.service';

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
    const filter: Record<string, unknown> = {};
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

    // Mark donation as approved first
    donation.status = 'approved';
    await donation.save();

    // Credit the user's topup wallet atomically via wallet service
    try {
      await creditWallet(
        donation.user.toString(),
        'topup',
        donation.amountCents,
        `Manual QR top-up approved (TxID: ${donation.transactionId})`
      );
    } catch (walletErr) {
      console.error('Failed to credit topup wallet after donation approval:', walletErr);
      // Revert donation status if wallet credit fails
      donation.status = 'pending';
      await donation.save();
      res.status(500).json({ success: false, error: 'Failed to credit wallet. Please retry.' });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Donation approved. Topup wallet balance updated.', donation },
    });
  } catch (err) {
    console.error('Approve donation error:', err);
    res.status(500).json({ success: false, error: 'Server error approving donation' });
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
