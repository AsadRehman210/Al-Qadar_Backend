export interface vendorBillLineDto {
  description: string;
  amount: number;
  expenseAccountId: string;
  expenseAccountCode?: string | null;
  expenseAccountName?: string | null;
}

export interface vendorBillDto {
  id: string;
  vendorName?: string | null;
  vendorContact?: string | null;
  billNumber?: string | null;
  billDate?: Date | null;
  dueDate?: Date | null;
  lines: vendorBillLineDto[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidToDate: number;
  balanceDue: number;
  currency?: string | null;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
