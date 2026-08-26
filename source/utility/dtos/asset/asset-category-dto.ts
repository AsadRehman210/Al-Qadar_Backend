export interface assetCategoryDto {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
