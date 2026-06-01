import { Response } from 'express';
import User from '../models/User';
import Referral from '../models/Referral';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── Build Referral Tree (recursive) ─────────────────────────────────────────
interface TreeNode {
  id: string;
  name: string;
  phone: string;
  joinedAt: Date;
  children: TreeNode[];
}

async function buildTree(userId: string, depth = 0, maxDepth = 10): Promise<TreeNode[]> {
  if (depth >= maxDepth) return [];

  // Find all direct referrals by this user
  const referrals = await Referral.find({ referrer: userId })
    .populate('referee', 'name phone createdAt')
    .sort({ createdAt: -1 });

  const nodes: TreeNode[] = [];
  for (const ref of referrals) {
    const referee = ref.referee as unknown as { _id: string; name: string; phone: string; createdAt: Date };
    const children = await buildTree(referee._id.toString(), depth + 1, maxDepth);
    nodes.push({
      id: referee._id.toString(),
      name: referee.name,
      phone: referee.phone,
      joinedAt: referee.createdAt,
      children,
    });
  }
  return nodes;
}

// ─── Get Referral Stats ───────────────────────────────────────────────────────
export const getReferralStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const user = await User.findById(userId).select('referralCode name');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Direct referrals only
    const referrals = await Referral.find({ referrer: userId })
      .populate('referee', 'name phone createdAt')
      .sort({ createdAt: -1 });

    // Total bonus earned (awarded)
    const bonusEarned = referrals
      .filter((r) => r.bonusAwarded)
      .reduce((sum, r) => sum + r.bonusAmount, 0);

    // Masked referred users
    const referredUsers = referrals.map((r) => {
      const referee = r.referee as unknown as { name: string; phone: string; createdAt: Date };
      const nameParts = referee.name.split(' ');
      const maskedName =
        nameParts[0].charAt(0) +
        '*'.repeat(Math.max(nameParts[0].length - 1, 1)) +
        (nameParts[1] ? ' ' + nameParts[1].charAt(0) + '*'.repeat(Math.max(nameParts[1].length - 1, 1)) : '');
      return {
        id: r._id,
        maskedName,
        joinedAt: referee.createdAt,
        bonusAwarded: r.bonusAwarded,
        bonusAmount: r.bonusAmount, // cents
      };
    });

    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${user.referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        totalReferrals: referrals.length,
        totalBonusEarned: bonusEarned, // cents
        referredUsers,
      },
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching referral stats' });
  }
};

// ─── Get Full Referral Tree ───────────────────────────────────────────────────
export const getReferralTree = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('name phone createdAt');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const children = await buildTree(userId!);

    res.json({
      success: true,
      data: {
        tree: {
          id: userId,
          name: user.name,
          phone: user.phone,
          joinedAt: (user as unknown as { createdAt: Date }).createdAt,
          children,
        },
      },
    });
  } catch (err) {
    console.error('Referral tree error:', err);
    res.status(500).json({ success: false, error: 'Server error building referral tree' });
  }
};

// ─── Admin: Get Any User's Referral Tree ──────────────────────────────────────
export const adminGetReferralTree = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('name phone createdAt');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const children = await buildTree(userId);

    res.json({
      success: true,
      data: {
        tree: {
          id: userId,
          name: user.name,
          phone: user.phone,
          joinedAt: (user as unknown as { createdAt: Date }).createdAt,
          children,
        },
      },
    });
  } catch (err) {
    console.error('Admin referral tree error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// ─── Admin: Get All Referrals List ────────────────────────────────────────────
export const adminGetAllReferrals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const referrals = await Referral.find()
      .populate('referrer', 'name phone')
      .populate('referee', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { referrals } });
  } catch (err) {
    console.error('Admin get referrals error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
