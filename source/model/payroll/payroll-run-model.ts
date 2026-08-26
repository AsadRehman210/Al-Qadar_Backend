import mongoose, { Document, Schema, Model, model } from "mongoose";

export type PayrollRunStatus = "Draft" | "Pending Approval" | "Approved" | "Processing" | "Paid" | "Cancelled";

export interface IPayrollLine {
  employeeId?: mongoose.Types.ObjectId | null;
  basic?: number | null;
  hra?: number | null;
  medical?: number | null;
  transport?: number | null;
  food?: number | null;
  mobile?: number | null;
  overtimeHours?: number | null;
  overtimeRate?: number | null;
  overtime?: number | null;
  bonus?: number | null;
  arrears?: number | null;
  grossEarnings?: number | null;
  pfEmployee?: number | null;
  pfEmployer?: number | null;
  // The rate/multiplier actually used to compute the two figures above,
  // captured at compute time — so if the employee's Salary % or the PF
  // Policy multiplier changes later, this run still records what was
  // genuinely used for it (matches the pfEmployee/pfEmployer amounts,
  // never a value looked up after the fact).
  pfPercentage?: number | null;
  pfEmployerMultiplier?: number | null;
  incomeTax?: number | null;
  insurance?: number | null;
  loanDeduction?: number | null;
  advance?: number | null;
  attendanceDeduction?: number | null;
  otherDeductions?: number | null;
  totalDeductions?: number | null;
  netPay?: number | null;
  employerCost?: number | null;
  paymentStatus?: "Pending" | "Paid" | null;
  paymentDate?: Date | null;
  paymentRef?: string | null;
}

const payrollLineSchema = new Schema<IPayrollLine>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    mobile: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 },
    grossEarnings: { type: Number, default: 0 },
    pfEmployee: { type: Number, default: 0 },
    pfEmployer: { type: Number, default: 0 },
    pfPercentage: { type: Number, default: 0 },
    pfEmployerMultiplier: { type: Number, default: 1 },
    incomeTax: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    attendanceDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    employerCost: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    paymentDate: { type: Date, default: null },
    paymentRef: { type: String, default: null },
  },
  { _id: false }
);

export interface IPayrollRunModel extends Document {
  runNumber?: string | null;
  month?: string | null;
  status?: PayrollRunStatus | null;
  employees?: IPayrollLine[];
  totalGross?: number | null;
  totalDeductions?: number | null;
  totalNet?: number | null;
  totalEmployerCost?: number | null;
  notes?: string | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  processedOn?: Date | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const payrollRunSchema: Schema<IPayrollRunModel> = new Schema(
  {
    runNumber: { type: String, required: true },
    month: { type: String, required: true }, // "YYYY-MM"
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Processing", "Paid", "Cancelled"],
      default: "Draft",
    },
    employees: { type: [payrollLineSchema], default: [] },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    totalEmployerCost: { type: Number, default: 0 },
    notes: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    processedOn: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "payroll_run",
  }
);

payrollRunSchema.index({ adminId: 1, merchantId: 1, runNumber: 1 }, { unique: true });

// Serves payroll-run-service.ts's getAll list (tenant-scoped, sorted _id:-1)
// and its salary-history-style queries (tenant + status, sorted month:-1).
payrollRunSchema.index({ adminId: 1, merchantId: 1, status: 1, month: -1 });

export const PayrollRunModel: Model<IPayrollRunModel> = model<IPayrollRunModel>("PayrollRun", payrollRunSchema);
