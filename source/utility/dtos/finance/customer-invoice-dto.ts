export interface customerInvoiceLineDto {
  description: string;
  amount: number;
  revenueAccountId: string;
  revenueAccountCode?: string | null;
  revenueAccountName?: string | null;
}

export interface customerInvoiceDto {
  id: string;
  customerName?: string | null;
  customerContact?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  lines: customerInvoiceLineDto[];
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
