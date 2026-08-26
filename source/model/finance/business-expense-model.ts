import mongoose, { Document, Schema, Model, model } from "mongoose";

// A lightweight, immediate-post entry for a business expense paid straight
// from Bank/Cash that doesn't need a formal Vendor Bill — distinct from the
// HR Employee Expenses module (expense-model.ts / expense-service.ts),
// which is reimbursement-driven and posts through its own markReimbursed
// flow. Created once, posted once, never edited afterward.
export interface IBusinessExpenseModel extends Document {
  date?: Date | null;
  category?: string | null;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  bankAccountId?: mongoose.Types.ObjectId | null;
  expenseAccountId?: mongoose.Types.ObjectId | null;
  journalEntryId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const businessExpenseSchema: Schema<IBusinessExpenseModel> = new Schema(
  {
    date: { type: Date, required: true },
    category: { type: String, required: true },
    description: { type: String, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "SAR" },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    expenseAccountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "business_expense",
  }
);

// Serves business-expense-service.ts's getAll list (tenant-scoped, sorted _id:-1).
businessExpenseSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const BusinessExpenseModel: Model<IBusinessExpenseModel> = model<IBusinessExpenseModel>(
  "BusinessExpense",
  businessExpenseSchema
);
