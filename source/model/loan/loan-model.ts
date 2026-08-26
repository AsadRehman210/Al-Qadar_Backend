import mongoose, { Document, Schema, Model, model } from "mongoose";

export type LoanType = "Advance Salary" | "EMI Loan";
export type LoanPurpose = "House" | "Vehicle" | "Personal" | "Education" | "Medical";
export type AppliedVia = "employee" | "hr";
export type ManagerApprovalStatus = "Pending" | "Approved" | "Rejected" | "Skipped";
export type LoanStatus =
  | "Pending Manager"
  | "Pending HR"
  | "Pending"
  | "Approved"
  | "Ongoing"
  | "Completed"
  | "Rejected";

export interface IManagerApproval {
  status?: ManagerApprovalStatus | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  comments?: string | null;
}

export interface IGuarantor {
  name?: string | null;
  contact?: string | null;
  address?: string | null;
}

export interface IEmiInstallment {
  installmentNo: number;
  dueDate?: Date | null;
  emiAmount: number;
  principal?: number | null;
  interest?: number | null;
  paid?: boolean | null;
  paidDate?: Date | null;
  balance?: number | null;
}

export interface ILoanDocument {
  name?: string | null;
  type?: string | null;
  uploadedAt?: Date | null;
  uploadedBy?: string | null;
  size?: number | null;
}

export interface ILoanModel extends Document {
  loanNumber?: string | null;
  employeeId?: mongoose.Types.ObjectId | null;
  loanType?: LoanType | null;
  loanPurpose?: LoanPurpose | null;
  loanAmount?: number | null;
  interestPercent?: number | null;
  numberOfInstallments?: number | null;
  monthlyDeduction?: number | null;
  appliedVia?: AppliedVia | null;
  managerApproval?: IManagerApproval | null;
  status?: LoanStatus | null;
  guarantor?: IGuarantor | null;
  emiSchedule?: IEmiInstallment[];
  documents?: ILoanDocument[];
  approvedBy?: mongoose.Types.ObjectId | null;
  approvalDate?: Date | null;
  rejectedBy?: mongoose.Types.ObjectId | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  preClosureAmount?: number | null;
  preClosureDate?: Date | null;
  notes?: string | null;
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

const guarantorSchema = new Schema<IGuarantor>(
  {
    name: { type: String, default: null },
    contact: { type: String, default: null },
    address: { type: String, default: null },
  },
  { _id: false }
);

const emiInstallmentSchema = new Schema<IEmiInstallment>(
  {
    installmentNo: { type: Number, required: true },
    dueDate: { type: Date, required: false },
    emiAmount: { type: Number, required: true },
    principal: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paidDate: { type: Date, default: null },
    balance: { type: Number, default: 0 },
  },
  { _id: false }
);

const loanDocumentSchema = new Schema<ILoanDocument>(
  {
    name: { type: String, default: null },
    type: { type: String, default: null },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: String, default: null },
    size: { type: Number, default: null },
  },
  { _id: false }
);

const loanSchema: Schema<ILoanModel> = new Schema(
  {
    loanNumber: { type: String, required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    loanType: { type: String, enum: ["Advance Salary", "EMI Loan"], required: true },
    loanPurpose: {
      type: String,
      enum: ["House", "Vehicle", "Personal", "Education", "Medical"],
      required: false,
    },
    loanAmount: { type: Number, required: true },
    interestPercent: { type: Number, default: 0 },
    numberOfInstallments: { type: Number, required: true },
    monthlyDeduction: { type: Number, default: 0 },
    appliedVia: { type: String, enum: ["employee", "hr"], required: true },
    managerApproval: { type: managerApprovalSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["Pending Manager", "Pending HR", "Pending", "Approved", "Ongoing", "Completed", "Rejected"],
      required: true,
    },
    guarantor: { type: guarantorSchema, default: null },
    emiSchedule: { type: [emiInstallmentSchema], default: [] },
    documents: { type: [loanDocumentSchema], default: [] },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvalDate: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    rejectionReason: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    preClosureAmount: { type: Number, default: null },
    preClosureDate: { type: Date, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "loan",
  }
);

loanSchema.index({ adminId: 1, merchantId: 1, loanNumber: 1 }, { unique: true });

// Serves loan-service.ts's getAll list (tenant-scoped, sorted _id:-1).
loanSchema.index({ adminId: 1, merchantId: 1, _id: -1 });
// Serves loan-service.ts's getByEmployee (employeeId, sorted _id:-1).
loanSchema.index({ employeeId: 1, _id: -1 });

export const LoanModel: Model<ILoanModel> = model<ILoanModel>("Loan", loanSchema);
