import mongoose, { Document, Schema, Model, model } from "mongoose";

export type AssetStatus = "In use" | "In storage" | "Maintenance" | "Disposed";
export type DepreciationMethod = "straight_line" | "declining";

export interface IAssignmentHistoryEntry {
  employeeId?: mongoose.Types.ObjectId | null;
  assignedDate?: Date | null;
  returnDate?: Date | null;
  notes?: string | null;
  assignedBy?: mongoose.Types.ObjectId | null;
}

export interface IMaintenanceRecord {
  date?: Date | null;
  type?: string | null;
  description?: string | null;
  cost?: number | null;
  vendor?: string | null;
  status?: string | null;
  nextMaintenanceDate?: Date | null;
}

export interface IInsurance {
  policyNo?: string | null;
  provider?: string | null;
  startDate?: Date | null;
  expiryDate?: Date | null;
  premiumAmount?: number | null;
  coverageAmount?: number | null;
  notes?: string | null;
}

export interface IDisposal {
  date?: Date | null;
  method?: string | null;
  salePrice?: number | null;
  reason?: string | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  journalEntryId?: mongoose.Types.ObjectId | null;
}

export interface ILocationHistoryEntry {
  location?: string | null;
  date?: Date | null;
  notes?: string | null;
  movedBy?: mongoose.Types.ObjectId | null;
}

export interface IAssetDocument {
  name?: string | null;
  docType?: string | null;
  uploadedAt?: Date | null;
  uploadedBy?: mongoose.Types.ObjectId | null;
  url?: string | null;
}

export interface IAssetModel extends Document {
  assetTag?: string | null;
  name?: string | null;
  categoryId: mongoose.Types.ObjectId;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate?: Date | null;
  purchaseCost?: number | null;
  warrantyUntil?: Date | null;
  currentValue?: number | null;
  currency?: string | null;
  status?: AssetStatus | null;
  notes?: string | null;
  depreciationMethod?: DepreciationMethod | null;
  usefulLifeYears?: number | null;
  salvageValue?: number | null;
  assignedToId?: mongoose.Types.ObjectId | null;
  assignedDate?: Date | null;
  assignmentHistory: IAssignmentHistoryEntry[];
  maintenanceHistory: IMaintenanceRecord[];
  insurance?: IInsurance | null;
  disposal?: IDisposal | null;
  locationHistory: ILocationHistoryEntry[];
  documents: IAssetDocument[];
  acquisitionJournalEntryId?: mongoose.Types.ObjectId | null;
  adminId?: mongoose.Types.ObjectId | null;
  merchantId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const assignmentHistorySchema = new Schema<IAssignmentHistoryEntry>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    assignedDate: { type: Date, default: null },
    returnDate: { type: Date, default: null },
    notes: { type: String, default: null },
    assignedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { _id: true }
);

const maintenanceRecordSchema = new Schema<IMaintenanceRecord>(
  {
    date: { type: Date, default: null },
    type: { type: String, default: null },
    description: { type: String, default: null },
    cost: { type: Number, default: 0 },
    vendor: { type: String, default: null },
    status: { type: String, default: "Completed" },
    nextMaintenanceDate: { type: Date, default: null },
  },
  { _id: true }
);

const insuranceSchema = new Schema<IInsurance>(
  {
    policyNo: { type: String, default: null },
    provider: { type: String, default: null },
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    premiumAmount: { type: Number, default: 0 },
    coverageAmount: { type: Number, default: 0 },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const disposalSchema = new Schema<IDisposal>(
  {
    date: { type: Date, default: null },
    method: { type: String, default: null },
    salePrice: { type: Number, default: 0 },
    reason: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  },
  { _id: false }
);

const locationHistorySchema = new Schema<ILocationHistoryEntry>(
  {
    location: { type: String, default: null },
    date: { type: Date, default: null },
    notes: { type: String, default: null },
    movedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { _id: true }
);

const assetDocumentSchema = new Schema<IAssetDocument>(
  {
    name: { type: String, default: null },
    docType: { type: String, default: null },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    url: { type: String, default: null },
  },
  { _id: true }
);

const assetSchema: Schema<IAssetModel> = new Schema(
  {
    assetTag: { type: String, required: true },
    name: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "AssetCategory", required: true },
    serialNumber: { type: String, default: null },
    location: { type: String, default: null },
    purchaseDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: 0 },
    warrantyUntil: { type: Date, default: null },
    currentValue: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    status: { type: String, enum: ["In use", "In storage", "Maintenance", "Disposed"], default: "In storage" },
    notes: { type: String, default: null },
    depreciationMethod: { type: String, enum: ["straight_line", "declining"], default: "straight_line" },
    usefulLifeYears: { type: Number, default: 5 },
    salvageValue: { type: Number, default: 0 },
    assignedToId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    assignedDate: { type: Date, default: null },
    assignmentHistory: { type: [assignmentHistorySchema], default: [] },
    maintenanceHistory: { type: [maintenanceRecordSchema], default: [] },
    insurance: { type: insuranceSchema, default: null },
    disposal: { type: disposalSchema, default: null },
    locationHistory: { type: [locationHistorySchema], default: [] },
    documents: { type: [assetDocumentSchema], default: [] },
    acquisitionJournalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    adminId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    merchantId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", default: null },
  },
  {
    timestamps: true,
    collection: "asset",
  }
);

// Serves asset-service.ts's getAll list (tenant-scoped, sorted createdAt:-1).
assetSchema.index({ adminId: 1, merchantId: 1, createdAt: -1 });

export const AssetModel: Model<IAssetModel> = model<IAssetModel>("Asset", assetSchema);
