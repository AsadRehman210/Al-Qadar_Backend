import mongoose, { Document, Schema, Model, model } from "mongoose";

// A lightweight, immediate-post entry for misc revenue that doesn't need a
// formal Customer Invoice — created once, posted once, never edited
// afterward (same rule Journal Entries and Payments follow).
export interface IIncomeEntryModel extends Document {
  date?: Date | null;
  source?: string | null;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  bankAccountId?: mongoose.Types.ObjectId | null;
  revenueAccountId?: mongoose.Types.ObjectId | null;
  journalEntryId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const incomeEntrySchema: Schema<IIncomeEntryModel> = new Schema(
  {
    date: { type: Date, required: true },
    source: { type: String, required: true },
    description: { type: String, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "SAR" },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    revenueAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "income_entry",
  }
);

// Serves income-entry-service.ts's getAll list (tenant-scoped, sorted _id:-1).
incomeEntrySchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const IncomeEntryModel: Model<IIncomeEntryModel> = model<IIncomeEntryModel>(
  "IncomeEntry",
  incomeEntrySchema
);
