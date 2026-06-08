import mongoose, { Document, Schema } from 'mongoose';

export type WalletType = 'direct' | 'level' | 'reward' | 'topup';
export type TxType = 'credit' | 'debit';

export interface IWalletLedger extends Document {
  userId: mongoose.Types.ObjectId;
  walletType: WalletType;
  txType: TxType;
  amount: number;           // in cents, always positive
  description: string;
  relatedUserId?: mongoose.Types.ObjectId;  // who triggered this tx (e.g. the new member)
  planId?: mongoose.Types.ObjectId;         // which plan triggered this tx
  level?: number;           // level number for level income entries (1–9)
  balanceAfter: number;     // snapshot of that specific wallet after this tx (in cents)
  createdAt: Date;
}

const WalletLedgerSchema = new Schema<IWalletLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    walletType: {
      type: String,
      enum: ['direct', 'level', 'reward', 'topup'],
      required: true,
    },
    txType: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    level: { type: Number, min: 1, max: 9 },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

// Compound index for efficient per-user + per-type ledger queries
WalletLedgerSchema.index({ userId: 1, walletType: 1, createdAt: -1 });
WalletLedgerSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IWalletLedger>('WalletLedger', WalletLedgerSchema);
