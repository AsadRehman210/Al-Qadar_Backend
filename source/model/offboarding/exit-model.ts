import mongoose, { Document, Schema, Model, model } from "mongoose";

export type ExitType = "Resignation" | "Retirement" | "Termination" | "Absconding" | "Contract End";
export type ExitStatus = "Notice Period" | "Clearance" | "Settlement" | "Completed" | "Cancelled";
export type ClearanceSection = "assets" | "finance" | "it" | "manager";
export type ClearanceItemStatus = "Pending" | "Cleared";

export interface IClearanceItem {
  status?: ClearanceItemStatus | null;
  clearedBy?: mongoose.Types.ObjectId | null;
  clearedOn?: Date | null;
  notes?: string | null;
}

export interface IClearance {
  assets?: IClearanceItem | null;
  finance?: IClearanceItem | null;
  it?: IClearanceItem | null;
  manager?: IClearanceItem | null;
}

export interface ISettlement {
  basic?: number | null;
  dailyRate?: number | null;
  pendingSalaryDays?: number | null;
  pendingSalaryAmount?: number | null;
  encashableDays?: number | null;
  leaveEncashmentAmount?: number | null;
  loanOutstanding?: number | null;
  pfBalance?: number | null;
  grossSettlement?: number | null;
  netSettlement?: number | null;
  status?: string | null;
  processedOn?: Date | null;
}

export interface IExitInterview {
  reasonCategory?: string | null;
  wouldRehire?: boolean | null;
  comments?: string | null;
  submittedBy?: mongoose.Types.ObjectId | null;
  submittedOn?: Date | null;
}

export interface IExitModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  exitType?: ExitType | null;
  reason?: string | null;
  noticePeriodDays?: number | null;
  resignationDate?: Date | null;
  lastWorkingDay?: Date | null;
  status?: ExitStatus | null;
  clearance?: IClearance | null;
  settlement?: ISettlement | null;
  exitInterview?: IExitInterview | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const clearanceItemSchema = new Schema<IClearanceItem>(
  {
    status: { type: String, enum: ["Pending", "Cleared"], default: "Pending" },
    clearedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    clearedOn: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const clearanceSchema = new Schema<IClearance>(
  {
    assets: { type: clearanceItemSchema, default: () => ({}) },
    finance: { type: clearanceItemSchema, default: () => ({}) },
    it: { type: clearanceItemSchema, default: () => ({}) },
    manager: { type: clearanceItemSchema, default: () => ({}) },
  },
  { _id: false }
);

const settlementSchema = new Schema<ISettlement>(
  {
    basic: { type: Number, default: 0 },
    dailyRate: { type: Number, default: 0 },
    pendingSalaryDays: { type: Number, default: 0 },
    pendingSalaryAmount: { type: Number, default: 0 },
    encashableDays: { type: Number, default: 0 },
    leaveEncashmentAmount: { type: Number, default: 0 },
    loanOutstanding: { type: Number, default: 0 },
    pfBalance: { type: Number, default: 0 },
    grossSettlement: { type: Number, default: 0 },
    netSettlement: { type: Number, default: 0 },
    status: { type: String, default: null },
    processedOn: { type: Date, default: null },
  },
  { _id: false }
);

const exitInterviewSchema = new Schema<IExitInterview>(
  {
    reasonCategory: { type: String, default: null },
    wouldRehire: { type: Boolean, default: null },
    comments: { type: String, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    submittedOn: { type: Date, default: null },
  },
  { _id: false }
);

const exitSchema: Schema<IExitModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    exitType: {
      type: String,
      enum: ["Resignation", "Retirement", "Termination", "Absconding", "Contract End"],
      required: true,
    },
    reason: { type: String, default: null },
    noticePeriodDays: { type: Number, default: 0 },
    resignationDate: { type: Date, required: false },
    lastWorkingDay: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Notice Period", "Clearance", "Settlement", "Completed", "Cancelled"],
      default: "Notice Period",
    },
    clearance: { type: clearanceSchema, default: () => ({}) },
    settlement: { type: settlementSchema, default: null },
    exitInterview: { type: exitInterviewSchema, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "exit",
  }
);

// Serves offboarding-service.ts's getAll list (tenant-scoped, sorted _id:-1).
exitSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves offboarding-service.ts's getByEmployee (employeeId, sorted _id:-1).
exitSchema.index({ employeeId: 1, _id: -1 });

export const ExitModel: Model<IExitModel> = model<IExitModel>("Exit", exitSchema);
