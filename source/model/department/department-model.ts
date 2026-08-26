import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface IDepartmentModel extends Document {
  name?: string | null;
  departmentCode?: string | null;
  description?: string | null;
  location?: string | null;
  hodEmployeeId?: mongoose.Types.ObjectId | null;
  establishedDate?: Date | null;
  status?: "Active" | "Inactive" | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const departmentSchema: Schema<IDepartmentModel> = new Schema(
  {
    name: { type: String, required: true },
    departmentCode: { type: String, required: false },
    description: { type: String, required: false },
    location: { type: String, required: false },
    hodEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    establishedDate: { type: Date, required: false },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "department",
  }
);

departmentSchema.index(
  { adminId: 1, merchantId: 1, departmentCode: 1 },
  { unique: true, sparse: true }
);

// Serves department-service.ts's getAll list (tenant-scoped, sorted _id:-1).
departmentSchema.index({ adminId: 1, merchantId: 1, _id: -1 });

export const DepartmentModel: Model<IDepartmentModel> = model<IDepartmentModel>(
  "Department",
  departmentSchema
);
