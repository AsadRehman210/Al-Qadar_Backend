export interface assignmentHistoryDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  assignedDate?: Date | null;
  returnDate?: Date | null;
  notes?: string | null;
  assignedBy?: string | null;
}

export interface maintenanceRecordDto {
  id: string;
  date?: Date | null;
  type?: string | null;
  description?: string | null;
  cost: number;
  vendor?: string | null;
  status?: string | null;
  nextMaintenanceDate?: Date | null;
}

export interface insuranceDto {
  policyNo?: string | null;
  provider?: string | null;
  startDate?: Date | null;
  expiryDate?: Date | null;
  premiumAmount: number;
  coverageAmount: number;
  notes?: string | null;
}

export interface disposalDto {
  date?: Date | null;
  method?: string | null;
  salePrice: number;
  reason?: string | null;
  approvedBy?: string | null;
  journalEntryId?: string | null;
}

export interface locationHistoryDto {
  id: string;
  location?: string | null;
  date?: Date | null;
  notes?: string | null;
  movedBy?: string | null;
}

export interface assetDocumentDto {
  id: string;
  name?: string | null;
  docType?: string | null;
  uploadedAt?: Date | null;
  uploadedBy?: string | null;
  url?: string | null;
}

export interface assetDto {
  id: string;
  assetTag?: string | null;
  name?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  purchaseDate?: Date | null;
  purchaseCost: number;
  warrantyUntil?: Date | null;
  currentValue: number;
  currency?: string | null;
  status?: string | null;
  notes?: string | null;
  depreciationMethod?: string | null;
  usefulLifeYears: number;
  salvageValue: number;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedDate?: Date | null;
  assignmentHistory: assignmentHistoryDto[];
  maintenanceHistory: maintenanceRecordDto[];
  insurance?: insuranceDto | null;
  disposal?: disposalDto | null;
  locationHistory: locationHistoryDto[];
  documents: assetDocumentDto[];
  acquisitionJournalEntryId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
