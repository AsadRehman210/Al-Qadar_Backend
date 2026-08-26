import { Document, Schema, Model, model } from "mongoose";

export interface IOtpModel extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  used: boolean;
  createdAt?: Date;
}

// One row per requested OTP — a fresh request always creates a new row
// rather than reusing/overwriting one, so a stale unused OTP from an earlier
// request can never be replayed after its own 1-minute window if a newer
// one has since been issued (resetPasswordWithOtp only ever accepts the
// most recent unused, unexpired row for that email).
const otpSchema: Schema<IOtpModel> = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "otp",
  }
);

// MongoDB TTL index — expired OTP rows are garbage-collected automatically
// a short while after expiresAt passes, instead of accumulating forever.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel: Model<IOtpModel> = model<IOtpModel>("Otp", otpSchema);
