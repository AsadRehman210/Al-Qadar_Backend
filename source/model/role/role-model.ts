import mongoose, { Document, Schema, Model, model } from "mongoose";

// A Role is a named permission set owned by one tenant (Admin / Merchant /
// Super Admin). Sub-users (see user-model.ts) are assigned exactly one Role;
// the Account owner needs none (they are the implicit "default user" with
// every permission). Tenant-partitioned identically to every other business
// collection — see tenant-scope.ts.
export interface IRoleModel extends Document {
  role_name?: string | null;
  description?: string | null;
  permissions?: string[];
  status?: "active" | "inactive" | null;
  action_type?: number | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const roleSchema: Schema<IRoleModel> = new Schema(
  {
    role_name: { type: String, required: true },
    description: { type: String, required: false, default: null },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    action_type: { type: Number, required: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "role",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Serves role-service.ts's tenant-scoped list (action_type != delete, _id:-1).
roleSchema.index({ adminId: 1, merchantId: 1, action_type: 1, _id: -1 });

export const roleModel: Model<IRoleModel> = model<IRoleModel>("Role", roleSchema);
