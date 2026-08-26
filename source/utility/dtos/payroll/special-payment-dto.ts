export interface specialPaymentLineDto {
  employeeId?: string | null;
  amount?: number | null;
  paymentStatus?: string | null;
}

export interface specialPaymentDto {
  id: string;
  title?: string | null;
  typeId?: string | null;
  typeName?: string | null;
  target?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  employeeId?: string | null;
  customEmployeeIds?: string[];
  employees?: specialPaymentLineDto[];
  totalAmount?: number | null;
  status?: string | null;
  notes?: string | null;
  approvedBy?: string | null;
  approvedOn?: Date | null;
  paidOn?: Date | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
