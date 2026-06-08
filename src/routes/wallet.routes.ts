import { Router, Response } from 'express';
import { protect, adminOnly, AuthRequest } from '../middleware/auth.middleware';
import { getWalletSummary, getWalletLedger } from '../services/wallet.service';
import { WalletType } from '../models/WalletLedger';
import WalletLedger from '../models/WalletLedger';
import mongoose from 'mongoose';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── GET /api/wallet/summary ─────────────────────────────────────────────────
router.get('/summary', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const summary = await getWalletSummary(userId);
    res.json({ success: true, data: { wallet: summary } });
  } catch (err) {
    console.error('Wallet summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch wallet summary' });
  }
});

// ─── GET /api/wallet/ledger ───────────────────────────────────────────────────
// Query params: type (walletType), page (number), limit (number)
router.get('/ledger', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { type, page, limit } = req.query;

    const walletType = type ? (type as WalletType) : undefined;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 20;

    const result = await getWalletLedger(userId, walletType, pageNum, limitNum);
    res.json({
      success: true,
      data: {
        entries: result.entries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total,
          pages: result.pages,
        },
      },
    });
  } catch (err) {
    console.error('Wallet ledger error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch wallet ledger' });
  }
});

// ─── GET /api/wallet/admin/level-income/log ───────────────────────────────────
// Admin: paginated level income ledger, optionally filtered by userId
// IMPORTANT: must be defined BEFORE /admin/:userId to avoid param collision
router.get('/admin/level-income/log', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, page, limit } = req.query;

    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 20;
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { walletType: 'level', txType: 'credit' };
    if (userId && typeof userId === 'string') {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    const [entries, total] = await Promise.all([
      WalletLedger.find(filter)
        .populate('userId', 'name phone')
        .populate('relatedUserId', 'name phone')
        .populate('planId', 'name priceUSD')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      WalletLedger.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    console.error('Admin level income log error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch level income log' });
  }
});

// ─── GET /api/wallet/admin/:userId ────────────────────────────────────────────
// Admin: view any user's wallet summary + ledger
router.get('/admin/:userId', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { type, page, limit } = req.query;

    const walletType = type ? (type as WalletType) : undefined;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 20;

    const [summary, ledger] = await Promise.all([
      getWalletSummary(userId),
      getWalletLedger(userId, walletType, pageNum, limitNum),
    ]);

    res.json({
      success: true,
      data: {
        wallet: summary,
        entries: ledger.entries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: ledger.total,
          pages: ledger.pages,
        },
      },
    });
  } catch (err) {
    console.error('Admin wallet view error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user wallet' });
  }
});

export default router;

