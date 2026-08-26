import mongoose, { Document, Schema, Model, model } from "mongoose";

export interface ISupplierModel extends Document {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  // Optional, deliberately never unique — a fallback contact number, not a
  // second identity for the supplier. Mirrors Customer's emergencyPhone.
  emergencyPhone?: string | null;
  address?: string | null;
  country?: string | null;
  city?: string | null;
  supplierType?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  licenseNumber?: string | null;
  licenseExpiryDate?: Date | null;
  contactPersonName?: string | null;
  contactPersonPhone?: string | null;
  contactPersonEmail?: string | null;
  contactPersonDesignation?: string | null;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  branchCode?: string | null;
  swift?: string | null;
  openingBalance?: number | null;
  status?: string | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// currentBalance is deliberately NOT a field here — same derived-balance
// rule as Customer (openingBalance + Σbills − Σpayments, at read time).
const supplierSchema: Schema<ISupplierModel> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: null },
    // Required now — the supplier's real identity, replacing supplierCode.
    phone: { type: String, required: true },
    emergencyPhone: { type: String, default: null },
    address: { type: String, default: null },
    country: { type: String, default: null },
    city: { type: String, default: null },
    supplierType: { type: String, default: null },
    taxNumber: { type: String, default: null },
    registrationNumber: { type: String, default: null },
    licenseNumber: { type: String, default: null },
    licenseExpiryDate: { type: Date, default: null },
    contactPersonName: { type: String, default: null },
    contactPersonPhone: { type: String, default: null },
    contactPersonEmail: { type: String, default: null },
    contactPersonDesignation: { type: String, default: null },
    bankName: { type: String, default: null },
    accountTitle: { type: String, default: null },
    accountNumber: { type: String, default: null },
    iban: { type: String, default: null },
    branchCode: { type: String, default: null },
    swift: { type: String, default: null },
    openingBalance: { type: Number, default: 0 },
    status: { type: String, default: "Active" },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    // A plain field, not one of Mongoose's auto-managed timestamp paths —
    // deliberately absent at creation (only createdAt is stamped then) and
    // set explicitly by supplier-service.ts's update() on every real edit,
    // mirroring Customer's exact convention.
    updatedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "supplier",
  }
);

// Sparse so any legacy supplier without a phone doesn't collide with others
// on a shared null — every supplier created from now on always has a phone
// (enforced by the schema's own `required` above). Mirrors Customer's index.
supplierSchema.index({ adminId: 1, merchantId: 1, phone: 1 }, { unique: true, sparse: true });

// Serves supplier-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
supplierSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const SupplierModel: Model<ISupplierModel> = model<ISupplierModel>("Supplier", supplierSchema);
