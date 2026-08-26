import mongoose, { Document, Schema, Model, model } from "mongoose";
import { AccountRole, AccountStatus } from "../../utility/helper/constants/enum";

export interface IAccountModel extends Document {
  name?: string | null;
  email?: string | null;
  password?: string | null;
  phone?: string | null;
  role?: AccountRole | null;
  status?: AccountStatus | null;
  code?: string | null;
  companyName?: string | null;
  businessCategory?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  website?: string | null;
  // The single currency this tenant (Admin or Merchant) operates in — set
  // once at creation and treated as immutable everywhere else in the portal
  // (Job/Designation/Expense/etc. currency fields are locked to this value).
  currency?: string | null;
  // Optional tenant brand color (hex) — set only via Super Admin's Create
  // Admin form. null means "use the platform default" (#3643AB). A Merchant
  // never sets this directly; it inherits its parent Admin's value (see
  // getTenantThemeColor in account-service.ts).
  themeColor?: string | null;
  createdBy?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  failed_attempts?: number | null;
  lock_until?: Date | null;
  last_login?: Date | null;
  // Meaningful only for role: merchant — when their current payment/subscription
  // period ends. See utility/helper/payment-expiry.ts for the enforcement.
  portalExpiryDate?: Date | null;
  lastPaymentDate?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const accountSchema: Schema<IAccountModel> = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: Object.values(AccountRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.active,
    },
    code: {
      type: String,
      required: false,
    },
    companyName: {
      type: String,
      required: false,
    },
    businessCategory: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    taxNumber: {
      type: String,
      required: false,
    },
    website: {
      type: String,
      required: false,
    },
    currency: {
      type: String,
      default: "SAR",
    },
    themeColor: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    failed_attempts: {
      type: Number,
      default: 0,
    },
    lock_until: {
      type: Date,
      default: null,
    },
    last_login: {
      type: Date,
      default: null,
    },
    portalExpiryDate: {
      type: Date,
      default: null,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "account",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Defense in depth: there must only ever be exactly one Super Admin account.
// No route exists to create one via the API (it's seeded once), but this
// guard makes it impossible even if a future code path forgets to check.
accountSchema.pre("save", async function () {
  if (this.isNew && this.role === AccountRole.super_admin) {
    const existing = await AccountModel.findOne({ role: AccountRole.super_admin });
    if (existing) {
      throw new Error("A Super Admin account already exists.");
    }
  }
});

// Serves admin-service.ts's getAll (role-only, no adminId narrowing) and
// merchant-service.ts's getAll when unnarrowed (Super Admin, no ?adminId=) —
// both sorted _id:-1.
accountSchema.index({ role: 1, _id: -1 });
// Serves merchant-service.ts's getAll when narrowed to one Admin's own
// merchants (role:'merchant', adminId set), sorted _id:-1.
accountSchema.index({ role: 1, adminId: 1, _id: -1 });

export const AccountModel: Model<IAccountModel> = model<IAccountModel>(
  "Account",
  accountSchema
);
