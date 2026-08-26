export interface assetAuditResultDto {
  assetId: string;
  assetName?: string | null;
  assetTag?: string | null;
  status?: string | null;
  notes?: string | null;
  checkedAt?: Date | null;
}

export interface assetAuditDto {
  id: string;
  startedAt?: Date | null;
  startedBy?: string | null;
  status?: string | null;
  completedAt?: Date | null;
  results: assetAuditResultDto[];
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
