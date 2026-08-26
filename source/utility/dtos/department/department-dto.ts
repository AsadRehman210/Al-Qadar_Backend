export interface departmentDto {
  id: string;
  name?: string | null;
  departmentCode?: string | null;
  description?: string | null;
  location?: string | null;
  hodEmployeeId?: string | null;
  hodName?: string | null;
  hodEmail?: string | null;
  hodPhone?: string | null;
  establishedDate?: Date | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
