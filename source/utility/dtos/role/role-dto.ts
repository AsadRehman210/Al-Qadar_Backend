export interface roleDto {
  id: string;
  role_name?: string | null;
  permissions: string[];
  status?: string | null;
  userCount?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
