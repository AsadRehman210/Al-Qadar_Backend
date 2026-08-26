import mongoose, { Document, Schema, Model, model } from "mongoose";

export type BankAccountType = "Bank" | "Cash";

export interface IBankAccountModel extends Document {
  name?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  type?: BankAccountType | null;
  currency?: string | null;
  // Every bank/cash account is backed 1:1 by its own Chart-of-Account entry —
  // all deposits/withdrawals post through the shared journal-service engine
  // against this account, so its balance is always derived from ledger_line,
  // never stored/duplicated here.
  chartAccountId?: mongoose.Types.ObjectId | null;
  openingBalance?: number | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const bankAccountSchema: Schema<IBankAccountModel> = new Schema(
  {
    name: { type: String, required: true },
    bankName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    type: { type: String, enum: ["Bank", "Cash"], required: true },
    currency: { type: String, default: "SAR" },
    chartAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    openingBalance: { type: Number, default: 0 },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "bank_account",
  }
);

// Serves bank-account-service.ts's getAll list (tenant-scoped, sorted _id:-1).
bankAccountSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const BankAccountModel: Model<IBankAccountModel> = model<IBankAccountModel>(
  "BankAccount",
  bankAccountSchema
);
