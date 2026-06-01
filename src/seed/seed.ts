import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import Plan from '../models/Plan';
import Referral from '../models/Referral';
import PlanRequest from '../models/PlanRequest';
import WithdrawalRequest from '../models/WithdrawalRequest';
import Donation from '../models/Donation';

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

    const [starterPlan, growthPlan, elitePlan] = plans;

    // ─── Seed Users ──────────────────────────────────────────────────────────
    // Admin user (Rahul)
    const rahul = await User.create({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@investslabs.com',
      password: 'Test@1234', // auto hashed
      role: 'admin',
      isVerified: true,
      walletBalance: 1000000, // $10,000.00 in cents
      referralCode: 'RAHUL001',
    });

    // Referee 1 (Priya) referred by Rahul
    const priya = await User.create({
      name: 'Priya Verma',
      phone: '9812345678',
      email: 'priya@gmail.com',
      password: 'Test@1234', // auto hashed
      role: 'user',
      isVerified: true,
      walletBalance: 250000, // $2,500.00 in cents
      referralCode: 'PRIYA002',
      referredBy: rahul._id,
      activePlan: growthPlan._id,
      planActivatedAt: new Date(),
    });

    // Referee 2 (Amit) referred by Priya (makes Level 2 for Rahul)
    const amit = await User.create({
      name: 'Amit Gupta',
      phone: '9900112233',
      email: 'amit@gmail.com',
      password: 'Test@1234', // auto hashed
      role: 'user',
      isVerified: true,
      walletBalance: 50000, // $500.00 in cents
      referralCode: 'AMIT003',
      referredBy: priya._id,
    });

    console.log('✅ Seeded 3 users');

    // ─── Seed Referrals ──────────────────────────────────────────────────────
    // Priya referred by Rahul (Level 1)
    await Referral.create({
      referrer: rahul._id,
      referee: priya._id,
      level: 1,
      bonusAmount: 1000, // $10.00 in cents
      bonusAwarded: true,
    });

    // Amit referred by Priya (Level 1 to Priya, Level 2 to Rahul)
    await Referral.create({
      referrer: priya._id,
      referee: amit._id,
      level: 1,
      bonusAmount: 1000, // $10.00 in cents
      bonusAwarded: false,
    });

    await Referral.create({
      referrer: rahul._id,
      referee: amit._id,
      level: 2,
      bonusAmount: 500, // $5.00 in cents
      bonusAwarded: false,
    });

    console.log('✅ Seeded referrals');

    // ─── Seed a few Plan Requests ────────────────────────────────────────────
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

    // ─── Seed a few Withdrawal Requests ──────────────────────────────────────
    await WithdrawalRequest.create({
      user: priya._id,
      amountCents: 50000, // $500.00
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      status: 'pending',
    });

    // ─── Seed a few Donations ────────────────────────────────────────────────
    await Donation.create({
      user: priya._id,
      donorName: 'Priya Verma',
      donorEmail: 'priya@gmail.com',
      amountCents: 15000, // $150.00
      transactionId: 'TXN-DON-9988776655',
      status: 'pending',
    });

    console.log('\n🌱 Seed complete! Login credentials:');
    console.log('  Admin:  phone=9876543210 password=Test@1234');
    console.log('  User:   phone=9812345678 password=Test@1234');
    console.log('  User:   phone=9900112233 password=Test@1234\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
