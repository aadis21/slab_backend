import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import Plan from '../models/Plan';
import Referral from '../models/Referral';
import PlanRequest from '../models/PlanRequest';
import WithdrawalRequest from '../models/WithdrawalRequest';
import Donation from '../models/Donation';
import WalletLedger from '../models/WalletLedger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/investslabs';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Plan.deleteMany({}),
      Referral.deleteMany({}),
      PlanRequest.deleteMany({}),
      WithdrawalRequest.deleteMany({}),
      Donation.deleteMany({}),
      WalletLedger.deleteMany({}),
    ]);
    console.log('🗑️  Cleared all collections');

    // ─── Seed Plans ─────────────────────────────────────────────────────────
    const plans = await Plan.insertMany([
      {
        name: 'Starter',
        priceUSD: 9900,               // $99.00 (in cents)
        minInvestmentUSD: 100000,     // $1,000.00 (in cents)
        annualReturnPercent: 8,
        durationDays: 30,
        isRecommended: false,
        isActive: true,
        color: '#10B981',             // Emerald green
        features: [
          'Basic portfolio tracking',
          'Monthly account statements',
          'Email support (48hr response)',
          'Access to 5 mutual fund categories',
        ],
      },
      {
        name: 'Growth',
        priceUSD: 24900,              // $249.00 (in cents)
        minInvestmentUSD: 250000,     // $2,500.00 (in cents)
        annualReturnPercent: 14,
        durationDays: 90,
        isRecommended: true,
        isActive: true,
        color: '#F59E0B',             // Amber/Gold
        features: [
          'Advanced analytics dashboard',
          'Priority support (4hr response)',
          'Quarterly advisor video call',
          'Auto-reinvestment option',
          'Access to 15 mutual fund categories',
          'Tax-saving ELSS funds included',
        ],
      },
      {
        name: 'Elite',
        priceUSD: 49900,              // $499.00 (in cents)
        minInvestmentUSD: 500000,     // $5,000.00 (in cents)
        annualReturnPercent: 20,
        durationDays: 365,
        isRecommended: false,
        isActive: true,
        color: '#8B5CF6',             // Purple
        features: [
          'Dedicated investment advisor',
          'Real-time market alerts via WhatsApp',
          'Exclusive pre-IPO opportunities',
          'Monthly tax optimization report',
          'Unlimited support (1hr response)',
          'Access to all fund categories + PMS',
          'Annual portfolio rebalancing session',
        ],
      },
    ]);
    console.log('✅ Seeded 3 plans');

    const [starterPlan, growthPlan] = plans;

    // ─── Seed Users ──────────────────────────────────────────────────────────
    // Admin user (Rahul)
    const rahul = await User.create({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@investslabs.com',
      password: 'Test@1234',
      role: 'admin',
      isVerified: true,
      wallet: {
        direct: 25000,   // $250.00 in cents
        level: 120000,   // $1,200.00 in cents
        reward: 0,
        topup: 50000,    // $500.00 in cents
      },
      referralCode: 'RAHUL001',
    });

    // Referee 1 (Priya) referred by Rahul
    const priya = await User.create({
      name: 'Priya Verma',
      phone: '9812345678',
      email: 'priya@gmail.com',
      password: 'Test@1234',
      role: 'user',
      isVerified: true,
      wallet: {
        direct: 25000,   // $250.00
        level: 120000,   // $1,200.00
        reward: 0,
        topup: 50000,    // $500.00
      },
      referralCode: 'PRIYA002',
      referredBy: rahul._id,
      activePlan: growthPlan._id,
      planActivatedAt: new Date(),
    });

    // Referee 2 (Amit) referred by Priya
    const amit = await User.create({
      name: 'Amit Gupta',
      phone: '9900112233',
      email: 'amit@gmail.com',
      password: 'Test@1234',
      role: 'user',
      isVerified: true,
      wallet: {
        direct: 25000,
        level: 120000,
        reward: 0,
        topup: 50000,
      },
      referralCode: 'AMIT003',
      referredBy: priya._id,
    });

    console.log('✅ Seeded 3 users with multi-wallet balances');

    // ─── Seed Referrals ──────────────────────────────────────────────────────
    await Referral.create({
      referrer: rahul._id,
      referee: priya._id,
      bonusAmount: 1000,
      bonusAwarded: true,
    });

    await Referral.create({
      referrer: priya._id,
      referee: amit._id,
      bonusAmount: 1000,
      bonusAwarded: false,
    });

    console.log('✅ Seeded referrals');

    // ─── Seed Wallet Ledger entries ──────────────────────────────────────────
    // Seed some representative ledger entries for Rahul so UI is not empty
    await WalletLedger.insertMany([
      {
        userId: rahul._id,
        walletType: 'level',
        txType: 'credit',
        amount: 24900,
        description: 'Level 1 income from plan purchase',
        relatedUserId: priya._id,
        planId: growthPlan._id,
        level: 1,
        balanceAfter: 24900,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: rahul._id,
        walletType: 'level',
        txType: 'credit',
        amount: 19920,
        description: 'Level 2 income from plan purchase',
        relatedUserId: amit._id,
        planId: growthPlan._id,
        level: 2,
        balanceAfter: 44820,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: rahul._id,
        walletType: 'direct',
        txType: 'credit',
        amount: 10000,
        description: 'Direct referral bonus from plan approval',
        relatedUserId: priya._id,
        planId: growthPlan._id,
        balanceAfter: 10000,
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        userId: rahul._id,
        walletType: 'topup',
        txType: 'credit',
        amount: 50000,
        description: 'Manual QR top-up approved (TxID: TXN-SEED-001)',
        balanceAfter: 50000,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      // Ledger entries for Priya
      {
        userId: priya._id,
        walletType: 'level',
        txType: 'credit',
        amount: 9900,
        description: 'Level 1 income from plan purchase',
        relatedUserId: amit._id,
        planId: starterPlan._id,
        level: 1,
        balanceAfter: 9900,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        userId: priya._id,
        walletType: 'topup',
        txType: 'credit',
        amount: 50000,
        description: 'Manual QR top-up approved (TxID: TXN-SEED-002)',
        balanceAfter: 50000,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ]);
    console.log('✅ Seeded wallet ledger entries');

    // ─── Seed Plan Requests ──────────────────────────────────────────────────
    await PlanRequest.create({
      user: amit._id,
      plan: starterPlan._id,
      status: 'pending',
    });

    await PlanRequest.create({
      user: priya._id,
      plan: growthPlan._id,
      status: 'approved',
      reviewedBy: rahul._id,
      reviewedAt: new Date(),
    });

    // ─── Seed Withdrawal Requests ──────────────────────────────────────────
    await WithdrawalRequest.create({
      user: priya._id,
      amountCents: 50000,
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      status: 'pending',
    });

    // ─── Seed Donations ──────────────────────────────────────────────────────
    await Donation.create({
      user: priya._id,
      donorName: 'Priya Verma',
      donorEmail: 'priya@gmail.com',
      amountCents: 15000,
      transactionId: 'TXN-DON-9988776655',
      status: 'pending',
    });

    console.log('\n🌱 Seed complete! Login credentials:');
    console.log('  Admin:  phone=9876543210 password=Test@1234');
    console.log('  User:   phone=9812345678 password=Test@1234');
    console.log('  User:   phone=9900112233 password=Test@1234');
    console.log('\n💰 Multi-wallet seed balances per user:');
    console.log('  Direct:  $250.00 | Level:  $1,200.00 | Reward: $0.00 | Topup: $500.00');
    console.log('  Total:   $1,950.00\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
