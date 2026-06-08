import User from '../models/User';
import { creditWallet } from './wallet.service';

// ─── Level Income Configuration ───────────────────────────────────────────────
// Percentages for levels L1 through L9 (index 0 = L1, index 8 = L9)
const LEVEL_PERCENTS: readonly number[] = [10, 8, 7, 6, 5, 4, 4, 3, 3];
const MAX_LEVELS = LEVEL_PERCENTS.length; // 9

// ─── distributeLevelIncome ────────────────────────────────────────────────────
/**
 * Walk UP the referral chain from newMemberId (via User.referredBy), up to MAX_LEVELS.
 * For each ancestor found at level i, credit their 'level' wallet with the
 * corresponding percentage of planAmount.
 *
 * Each individual distribution is wrapped in its own try/catch so one failure
 * does NOT abort the entire distribution loop.
 *
 * @param newMemberId  - The user whose plan was just approved
 * @param planAmount   - The plan price in cents (used as base for % calculation)
 * @param planId       - The plan ObjectId as string
 */
export async function distributeLevelIncome(
  newMemberId: string,
  planAmount: number,
  planId: string
): Promise<void> {
  let currentUserId = newMemberId;
  let levelIndex = 0; // 0-indexed; level 1 = index 0

  while (levelIndex < MAX_LEVELS) {
    // Fetch current user to get their referredBy
    const currentUser = await User.findById(currentUserId).select('referredBy name phone').lean();

    if (!currentUser || !currentUser.referredBy) {
      // No more upline — stop walking
      break;
    }

    const ancestorId = currentUser.referredBy.toString();
    const levelNumber = levelIndex + 1; // human-readable level (1–9)
    const percent = LEVEL_PERCENTS[levelIndex];
    const incomeAmount = Math.floor((planAmount * percent) / 100); // floor to avoid fractional cents

    if (incomeAmount > 0) {
      try {
        await creditWallet(
          ancestorId,
          'level',
          incomeAmount,
          `Level ${levelNumber} income from plan purchase`,
          newMemberId,
          planId,
          levelNumber
        );
        console.log(
          `✅ Level income L${levelNumber}: $${(incomeAmount / 100).toFixed(2)} → User ${ancestorId}`
        );
      } catch (err) {
        // Log but do NOT rethrow — one failure should not break the rest
        console.error(
          `❌ Level income distribution failed at L${levelNumber} for ancestor ${ancestorId}:`,
          err
        );
      }
    }

    // Move up the tree
    currentUserId = ancestorId;
    levelIndex++;
  }
}
