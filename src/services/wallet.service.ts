import mongoose from 'mongoose';
import User from '../models/User';
import WalletLedger, { WalletType } from '../models/WalletLedger';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WalletSummary {
  direct: number;
  level: number;
  reward: number;
  topup: number;
  total: number;
}

export interface LedgerEntry {
  _id: string;
  walletType: WalletType;
  txType: 'credit' | 'debit';
  amount: number;
  description: string;
  relatedUserId?: string;
  planId?: string;
  level?: number;
  balanceAfter: number;
  createdAt: Date;
}

// ─── creditWallet ─────────────────────────────────────────────────────────────
/**
 * Atomically credit a specific wallet bucket and insert a ledger entry.
 */
export async function creditWallet(
  userId: string,
  walletType: WalletType,
  amount: number,
  description: string,
  relatedUserId?: string,
  planId?: string,
  level?: number
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const field = `wallet.${walletType}`;

    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { [field]: amount } },
      { new: true, session }
    );

    if (!updated) {
      await session.abortTransaction();
      throw new Error(`creditWallet: User ${userId} not found`);
    }

    const balanceAfter = updated.wallet[walletType] ?? 0;

    await WalletLedger.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          walletType,
          txType: 'credit',
          amount,
          description,
          relatedUserId: relatedUserId ? new mongoose.Types.ObjectId(relatedUserId) : undefined,
          planId: planId ? new mongoose.Types.ObjectId(planId) : undefined,
          level,
          balanceAfter,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─── debitWallet ─────────────────────────────────────────────────────────────
/**
 * Atomically debit a specific wallet bucket and insert a ledger entry.
 * Throws if insufficient balance.
 */
export async function debitWallet(
  userId: string,
  walletType: WalletType,
  amount: number,
  description: string
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      throw new Error(`debitWallet: User ${userId} not found`);
    }

    const currentBalance = user.wallet[walletType] ?? 0;
    if (currentBalance < amount) {
      await session.abortTransaction();
      throw new Error(
        `debitWallet: Insufficient balance in ${walletType} wallet. Has ${currentBalance}, needs ${amount}`
      );
    }

    const field = `wallet.${walletType}`;
    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { [field]: -amount } },
      { new: true, session }
    );

    const balanceAfter = (updated?.wallet[walletType] ?? 0);

    await WalletLedger.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          walletType,
          txType: 'debit',
          amount,
          description,
          balanceAfter,
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─── debitTotalWallet ─────────────────────────────────────────────────────────
/**
 * Debit a total amount by draining wallets in priority order:
 *   level → direct → reward → topup
 * Creates one ledger entry per wallet bucket touched.
 * Throws if totalWallet < totalAmount.
 */
export async function debitTotalWallet(
  userId: string,
  totalAmount: number,
  description: string
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new Error(`debitTotalWallet: User ${userId} not found`);

  const total = user.totalWallet;
  if (total < totalAmount) {
    throw new Error(
      `debitTotalWallet: Insufficient total wallet balance. Has ${total}, needs ${totalAmount}`
    );
  }

  // Drain order: level → direct → reward → topup
  const drainOrder: WalletType[] = ['level', 'direct', 'reward', 'topup'];
  let remaining = totalAmount;

  for (const wType of drainOrder) {
    if (remaining <= 0) break;
    const available = user.wallet[wType] ?? 0;
    if (available <= 0) continue;

    const toDebit = Math.min(available, remaining);
    remaining -= toDebit;

    // Each bucket debit is its own atomic operation
    await debitWallet(userId, wType, toDebit, description);
  }
}

// ─── getWalletSummary ─────────────────────────────────────────────────────────
/**
 * Return a structured summary of all wallet buckets + total for a user.
 */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const user = await User.findById(userId).select('wallet');
  if (!user) throw new Error(`getWalletSummary: User ${userId} not found`);

  const { direct = 0, level = 0, reward = 0, topup = 0 } = user.wallet;
  return {
    direct,
    level,
    reward,
    topup,
    total: direct + level + reward + topup,
  };
}

// ─── getWalletLedger ─────────────────────────────────────────────────────────
/**
 * Return paginated ledger entries for a user, optionally filtered by walletType.
 */
export async function getWalletLedger(
  userId: string,
  walletType?: WalletType,
  page = 1,
  limit = 20
): Promise<{ entries: LedgerEntry[]; total: number; pages: number }> {
  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (walletType) filter.walletType = walletType;

  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    WalletLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<LedgerEntry[]>(),
    WalletLedger.countDocuments(filter),
  ]);

  return {
    entries,
    total,
    pages: Math.ceil(total / limit),
  };
}
