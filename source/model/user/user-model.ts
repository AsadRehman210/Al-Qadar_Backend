import mongoose, { Document, Schema, Model, model } from 'mongoose';

export interface IUserModel extends Document {
  user_name?: string | null;
  email?: string | null
  phone?: string | null;
  cnic?: string | null;
  password?: string | null;
  code?: string | null;
  code_generation_time?: Date | null;
  is_verified?: number | null;
  token?: string | null;
  last_email_sent_at?: Date | null;
  failed_attempts?: number | null;
  lock_until?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  action_type?: number | null;
  // Tenant scope, same as every other business collection (see tenant-scope.ts) —
  // this flow isn't wired up to any frontend yet, but records must be
  // partitioned per Admin/Merchant from day one like the rest of the app.
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
}

const userSchema: Schema<IUserModel> = new Schema({
    user_name: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: false,
    },
    cnic: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },
    code: {
      type: String,
      required: false,
    },
    code_generation_time: {
      type: Date,
      required: false,
    },
    is_verified: {
      type: Number,
      required: false,
      default:false
    },
    token: {
      type: String,
      required: false,
    },
    last_email_sent_at: {
      type: Date,
      required: false,
    },
    failed_attempts: {
      type: Number,
      default: 0,
    },
    lock_until: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      required: false,
    },
    updatedAt: {
      type: Date,
      required: false,
    },
    action_type: {
      type: Number,
      required: false,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  {
    timestamps: true, 
    collection: 'user',
    toJSON: { virtuals: true },  
    toObject: { virtuals: true } ,
  }
);

// Serves user-service.ts's getAll list (tenant-scoped, action_type != delete, sorted _id:-1).
userSchema.index({ adminId: 1, merchantId: 1, action_type: 1, _id: -1 });

export const userModel: Model<IUserModel> = model<IUserModel>(
  "User",
  userSchema
);
