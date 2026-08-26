import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface ISalaryAllowances {
  hra?: number | null;
  medical_allowance?: number | null;
  transport_allowance?: number | null;
  food_allowance?: number | null;
  mobile_allowance?: number | null;
  travel_allowance?: number | null;
  other_allowances?: number | null;
}

export interface ISalaryDeductions {
  tax?: number | null;
  provident_fund?: number | null;
  loan_deduction?: number | null;
  advance_salary?: number | null;
  insurance_deduction?: number | null;
  other_deductions?: number | null;
}

export type SalaryPaymentStatus = "pending" | "processing" | "paid";

export interface ISalaryModel extends Document {
  employeeId?: mongoose.Types.ObjectId | null;
  basic_salary?: number | null;
  allowances?: ISalaryAllowances | null;
  deductions?: ISalaryDeductions | null;
  // The % the amounts in deductions.tax/deductions.provident_fund were
  // computed from (against gross/basic salary) — saved alongside the
  // computed amount so editing/payroll can read the rate directly instead
  // of reverse-deriving it.
  tax_percentage?: number | null;
  pf_percentage?: number | null;
  gross_salary?: number | null;
  net_salary?: number | null;
  bank_name?: string | null;
  branch_name?: string | null;
  branch_code?: string | null;
  account_no?: string | null;
  ifsc?: string | null;
  pf_number?: string | null;
  payment_status?: SalaryPaymentStatus | null;
  payment_date?: Date | null;
  effective_from?: Date | null;
  effective_to?: Date | null;
  salary_notes?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const allowancesSchema = new Schema<ISalaryAllowances>(
  {
    hra: { type: Number, default: 0 },
    medical_allowance: { type: Number, default: 0 },
    transport_allowance: { type: Number, default: 0 },
    food_allowance: { type: Number, default: 0 },
    mobile_allowance: { type: Number, default: 0 },
    travel_allowance: { type: Number, default: 0 },
    other_allowances: { type: Number, default: 0 },
  },
  { _id: false }
);

const deductionsSchema = new Schema<ISalaryDeductions>(
  {
    tax: { type: Number, default: 0 },
    provident_fund: { type: Number, default: 0 },
    loan_deduction: { type: Number, default: 0 },
    advance_salary: { type: Number, default: 0 },
    insurance_deduction: { type: Number, default: 0 },
    other_deductions: { type: Number, default: 0 },
  },
  { _id: false }
);

const salarySchema: Schema<ISalaryModel> = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    basic_salary: { type: Number, required: true },
    allowances: { type: allowancesSchema, default: () => ({}) },
    deductions: { type: deductionsSchema, default: () => ({}) },
    tax_percentage: { type: Number, default: 0 },
    pf_percentage: { type: Number, default: 0 },
    // gross_salary/net_salary are always recomputed server-side in the
    // service layer — never trust a client-supplied value for these.
    gross_salary: { type: Number, default: 0 },
    net_salary: { type: Number, default: 0 },
    bank_name: { type: String, required: false },
    branch_name: { type: String, required: false },
    branch_code: { type: String, required: false },
    account_no: { type: String, required: false },
    ifsc: { type: String, required: false },
    pf_number: { type: String, required: false },
    payment_status: { type: String, enum: ["pending", "processing", "paid"], default: "pending" },
    payment_date: { type: Date, default: null },
    effective_from: { type: Date, required: true },
    effective_to: { type: Date, default: null },
    salary_notes: { type: String, required: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "salary",
  }
);

salarySchema.index({ employeeId: 1, effective_from: -1 });

export const SalaryModel: Model<ISalaryModel> = model<ISalaryModel>("Salary", salarySchema);
