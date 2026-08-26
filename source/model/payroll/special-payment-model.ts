import mongoose, { Document, Schema, Model, model } from "mongoose";

export type SpecialPaymentStatus = "Draft" | "Pending Approval" | "Approved" | "Paid" | "Cancelled";
export type SpecialPaymentTarget = "all" | "department" | "individual" | "custom";

export interface ISpecialPaymentLine {
  employeeId?: mongoose.Types.ObjectId | null;
  amount?: number | null;
  paymentStatus?: "Pending" | "Paid" | null;
}

const specialPaymentLineSchema = new Schema<ISpecialPaymentLine>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    amount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  },
  { _id: false }
);

export interface ISpecialPaymentModel extends Document {
  title?: string | null;
  typeId?: mongoose.Types.ObjectId | null;
  target?: SpecialPaymentTarget | null;
  departmentId?: mongoose.Types.ObjectId | null;
  employeeId?: mongoose.Types.ObjectId | null;
  customEmployeeIds?: mongoose.Types.ObjectId[];
  employees?: ISpecialPaymentLine[];
  totalAmount?: number | null;
  status?: SpecialPaymentStatus | null;
  notes?: string | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  approvedOn?: Date | null;
  paidOn?: Date | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const specialPaymentSchema: Schema<ISpecialPaymentModel> = new Schema(
  {
    title: { type: String, required: true },
    typeId: { type: Schema.Types.ObjectId, ref: "SpecialPaymentType", required: true },
    target: { type: String, enum: ["all", "department", "individual", "custom"], required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    customEmployeeIds: { type: [Schema.Types.ObjectId], default: [] },
    employees: { type: [specialPaymentLineSchema], default: [] },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Paid", "Cancelled"],
      default: "Draft",
    },
    notes: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    approvedOn: { type: Date, default: null },
    paidOn: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "special_payment",
  }
);

// Serves special-payment-service.ts's getAll list (tenant-scoped, sorted _id:-1).
specialPaymentSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const SpecialPaymentModel: Model<ISpecialPaymentModel> = model<ISpecialPaymentModel>(
  "SpecialPayment",
  specialPaymentSchema
);
