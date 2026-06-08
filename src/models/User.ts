import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IWallet {
  direct: number;   // Direct referral bonus wallet (cents)
  level: number;    // Level income wallet (cents)
  reward: number;   // Achievement rewards wallet (cents)
  topup: number;    // Manual QR top-ups wallet (cents)
}

export interface IUser extends Document {
  name: string;
  phone: string;
  email?: string;
  password: string;
  otp?: string;
  otpExpiry?: Date;
  isVerified: boolean;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  role: 'user' | 'admin';
  wallet: IWallet;
  totalWallet: number;    // virtual: sum of all wallet buckets
  isActive: boolean;
  activePlan?: mongoose.Types.ObjectId;
  planActivatedAt?: Date;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const WalletSchema = new Schema<IWallet>(
  {
    direct: { type: Number, default: 0, min: 0 },  // Direct referral bonus
    level:  { type: Number, default: 0, min: 0 },  // Level income
    reward: { type: Number, default: 0, min: 0 },  // Achievement rewards
    topup:  { type: Number, default: 0, min: 0 },  // Manual QR top-ups
  },
  { _id: false }  // embedded sub-document, no separate _id
);

const UserSchema = new Schema<IUser>(
  {
    name:     { type: String, required: true, trim: true },
    phone:    { type: String, required: true, unique: true, trim: true },
    email:    { type: String, trim: true, lowercase: true },
    password: { type: String, required: true },
    otp:      { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    referralCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex').toUpperCase(),
    },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wallet: { type: WalletSchema, default: () => ({ direct: 0, level: 0, reward: 0, topup: 0 }) },
    isActive: { type: Boolean, default: true },
    activePlan: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    planActivatedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: sum of all wallet buckets
UserSchema.virtual('totalWallet').get(function (this: IUser) {
  const w = this.wallet;
  return (w?.direct ?? 0) + (w?.level ?? 0) + (w?.reward ?? 0) + (w?.topup ?? 0);
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
