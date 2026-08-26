export interface warehouseDto {
  id: string;
  code?: string | null;
  name?: string | null;
  location?: string | null;
  manager?: string | null;
  capacity?: number | null;
  unit?: string | null;
  description?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
