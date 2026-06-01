import mongoose, { Document, Schema } from 'mongoose';

export interface IReferral extends Document {
  referrer: mongoose.Types.ObjectId;
  referee: mongoose.Types.ObjectId;
  bonusAwarded: boolean;
  bonusAmount: number; // cents, e.g. $10 = 1000
  createdAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bonusAwarded: { type: Boolean, default: false },
    bonusAmount: { type: Number, default: 1000 }, // $10 in cents
  },
  { timestamps: true }
);

export default mongoose.model<IReferral>('Referral', ReferralSchema);
