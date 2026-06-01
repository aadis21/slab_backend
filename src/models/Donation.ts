import mongoose, { Document, Schema } from 'mongoose';

export interface IDonation extends Document {
  user: mongoose.Types.ObjectId;
  donorName: string;
  donorEmail: string;
  amountCents: number; // Stored in cents, e.g., $10.00 = 1000
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    donorName: { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, trim: true, lowercase: true },
    amountCents: { type: Number, required: true, min: 0 },
    transactionId: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IDonation>('Donation', DonationSchema);
