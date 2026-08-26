import mongoose, { Document, Schema, Model, model } from "mongoose";

export type HolidayType = "Public" | "Company" | "Optional";

export interface IHolidayModel extends Document {
  name?: string | null;
  date?: Date | null;
  type?: HolidayType | null;
  recurring?: boolean | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const holidaySchema: Schema<IHolidayModel> = new Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ["Public", "Company", "Optional"], default: "Public" },
    recurring: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "holiday",
  }
);

// Serves holiday-service.ts's getAll list (tenant-scoped, sorted date:1).
holidaySchema.index({ adminId: 1, merchantId: 1, date: 1 });

export const HolidayModel: Model<IHolidayModel> = model<IHolidayModel>("Holiday", holidaySchema);
