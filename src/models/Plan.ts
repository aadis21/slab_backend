import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  priceUSD: number;         // cents, e.g. $49 = 4900
  minInvestmentUSD: number; // cents
  annualReturnPercent: number; // e.g. 14 for 14%
  durationDays: number;
  features: string[];
  isRecommended: boolean;
  isActive: boolean;
  color: string;
  createdAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, unique: true },
    priceUSD: { type: Number, required: true },
    minInvestmentUSD: { type: Number, required: true },
    annualReturnPercent: { type: Number, required: true },
    durationDays: { type: Number, required: true, default: 30 },
    features: [{ type: String }],
    isRecommended: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    color: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPlan>('Plan', PlanSchema);
