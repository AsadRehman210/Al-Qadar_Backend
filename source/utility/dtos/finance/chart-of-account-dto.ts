export interface chartOfAccountDto {
  id: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  subType?: string | null;
  parentId?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
