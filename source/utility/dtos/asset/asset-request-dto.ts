export interface assetRequestDto {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  justification?: string | null;
  priority?: string | null;
  status?: string | null;
  requestedDate?: Date | null;
  decidedBy?: string | null;
  decidedDate?: Date | null;
  decisionNotes?: string | null;
  fulfilledAssetId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
