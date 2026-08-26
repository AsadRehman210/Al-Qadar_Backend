import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AppliedVia = "employee" | "hr";
export type ManagerApprovalStatus = "Pending" | "Approved" | "Rejected" | "Skipped";
export type ApprovalStatus = "Pending Manager" | "Pending HR" | "Approved" | "Rejected";
export type PaymentStatus = "Pending" | "Reimbursed" | "Partially Paid";
export type PaymentMethod = "Cash" | "Bank" | "Card" | "Online";

export interface IManagerApproval {
  status?: ManagerApprovalStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  comments?: string | null;
}

export interface IApprovalHistoryEntry {
  status?: string | null;
  date?: Date | null;
  by?: mongoose.Types.ObjectId | null;
  comments?: string | null;
}

export interface IPaymentHistoryEntry {
  date?: Date | null;
  amount?: number | null;
  method?: string | null;
  status?: string | null;
}

export interface IExpenseModel extends Document {
  expenseNumber?: string | null;
  employeeId?: mongoose.Types.ObjectId | null;
  expenseType?: string | null;
  expenseDate?: Date | null;
  amount?: number | null;
  currency?: string | null;
  paymentMethod?: PaymentMethod | null;
  description?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  appliedVia?: AppliedVia | null;
  managerApproval?: IManagerApproval | null;
  approvalStatus?: ApprovalStatus | null;
  paymentStatus?: PaymentStatus | null;
  approvalHistory?: IApprovalHistoryEntry[];
  paymentHistory?: IPaymentHistoryEntry[];
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const managerApprovalSchema = new Schema<IManagerApproval>(
  {
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Skipped"], default: "Pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    comments: { type: String, default: null },
  },
  { _id: false }
);

const approvalHistorySchema = new Schema<IApprovalHistoryEntry>(
  {
    status: { type: String, default: null },
    date: { type: Date, default: null },
    by: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    comments: { type: String, default: null },
  },
  { _id: false }
);

const paymentHistorySchema = new Schema<IPaymentHistoryEntry>(
  {
    date: { type: Date, default: null },
    amount: { type: Number, default: null },
    method: { type: String, default: null },
    status: { type: String, default: null },
  },
  { _id: false }
);

const expenseSchema: Schema<IExpenseModel> = new Schema(
  {
    expenseNumber: { type: String, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    expenseType: { type: String, required: true },
    expenseDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "SAR" },
    paymentMethod: { type: String, enum: ["Cash", "Bank", "Card", "Online"], default: "Bank" },
    description: { type: String, default: null },
    receiptUrl: { type: String, default: null },
    notes: { type: String, default: null },
    appliedVia: { type: String, enum: ["employee", "hr"], required: true },
    managerApproval: { type: managerApprovalSchema, default: () => ({}) },
    approvalStatus: {
      type: String,
      enum: ["Pending Manager", "Pending HR", "Approved", "Rejected"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Reimbursed", "Partially Paid"],
      default: "Pending",
    },
    approvalHistory: { type: [approvalHistorySchema], default: [] },
    paymentHistory: { type: [paymentHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "expense",
  }
);

expenseSchema.index({ adminId: 1, merchantId: 1, expenseNumber: 1 }, { unique: true });

export const ExpenseModel: Model<IExpenseModel> = model<IExpenseModel>("Expense", expenseSchema);
