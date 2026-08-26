export interface productDto {
  id: string;
  productName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  productType?: string | null;
  status?: string | null;
  totalStock?: number | null;
  variantCount?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
