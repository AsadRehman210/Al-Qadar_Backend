import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IDesignationModel extends Document {
  title?: string | null;
  code?: string | null;
  shortName?: string | null;
  departmentId?: mongoose.Types.ObjectId | null;
  level?: string | null;
  grade?: string | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  overtimeRate?: number | null;
  currency?: string | null;
  status?: "Active" | "Inactive" | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const designationSchema: Schema<IDesignationModel> = new Schema(
  {
    title: { type: String, required: true },
    code: { type: String, required: false },
    shortName: { type: String, required: false },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    level: {
      type: String,
      enum: ["C-Level", "Director", "Manager", "Supervisor", "Staff", "Intern"],
      required: false,
    },
    grade: { type: String, required: false },
    minSalary: { type: Number, required: false },
    maxSalary: { type: Number, required: false },
    overtimeRate: { type: Number, required: false },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "designation",
  }
);

designationSchema.index({ adminId: 1, merchantId: 1, code: 1 }, { unique: true, sparse: true });

// Serves designation-service.ts's getAll list (tenant-scoped, sorted _id:-1).
designationSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const DesignationModel: Model<IDesignationModel> = model<IDesignationModel>(
  "Designation",
  designationSchema
);
