import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface ICustomerModel extends Document {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  // Optional, deliberately never unique — a fallback contact number, not a
  // second identity for the customer.
  emergencyPhone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  customerType?: string | null;
  companyName?: string | null;
  // Displayed to the user as "Business Type" — kept as customerSegment
  // internally since it's the same Retail/Wholesale/Corporate classification
  // that existed before, just relabeled.
  customerSegment?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  openingBalance?: number | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// currentBalance is deliberately NOT a field here — always derived at read
// time as openingBalance + Σ(invoice.total) − Σ(payments), computed in the
// service layer. A stored balance would drift the moment any payment/CN posts.
const customerSchema: Schema<ICustomerModel> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: null },
    // Required and unique per tenant (see the index below) — the phone
    // number is now the customer's real identity, not the old customerCode.
    phone: { type: String, required: true },
    emergencyPhone: { type: String, default: null },
    address: { type: String, required: true },
    city: { type: String, default: null },
    country: { type: String, default: null },
    customerType: { type: String, default: "Individual" },
    companyName: { type: String, default: null },
    customerSegment: { type: String, default: "Retail" },
    taxNumber: { type: String, default: null },
    registrationNumber: { type: String, default: null },
    openingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    creditDays: { type: Number, default: 30 },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    // A plain field, not one of Mongoose's auto-managed timestamp paths —
    // deliberately absent at creation (only createdAt is stamped then) and
    // set explicitly by customer-service.ts's update() on every real edit,
    // so "never updated" and "updated once" stay visibly different in the data.
    updatedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "customer",
  }
);

// Sparse so the handful of legacy customers that predate this requirement
// (created before phone was mandatory) don't collide with each other on a
// shared null — every customer created from now on always has a phone
// (enforced by the schema's own `required` above), so this is effectively
// a plain unique index going forward.
customerSchema.index({ adminId: 1, merchantId: 1, phone: 1 }, { unique: true, sparse: true });

// Serves customer-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
customerSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const CustomerModel: Model<ICustomerModel> = model<ICustomerModel>("Customer", customerSchema);
