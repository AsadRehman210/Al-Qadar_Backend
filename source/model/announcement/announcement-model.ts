import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AnnouncementCategory = "General" | "Policy" | "Event" | "Urgent";

export interface IAnnouncementModel extends Document {
  title?: string | null;
  body?: string | null;
  category?: AnnouncementCategory | null;
  pinned?: boolean | null;
  isDeleted?: boolean | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const announcementSchema: Schema<IAnnouncementModel> = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, enum: ["General", "Policy", "Event", "Urgent"], default: "General" },
    pinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "announcement",
  }
);

// Serves announcement-service.ts's getAll list (tenant-scoped, sorted pinned:-1,createdAt:-1).
announcementSchema.index({ adminId: 1, merchantId: 1, pinned: -1, createdAt: -1 });

export const AnnouncementModel: Model<IAnnouncementModel> = model<IAnnouncementModel>(
  "Announcement",
  announcementSchema
);
