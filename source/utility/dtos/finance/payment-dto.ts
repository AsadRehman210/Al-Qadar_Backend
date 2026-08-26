export interface paymentDto {
  id: string;
  date?: Date | null;
  direction?: string | null;
  amount: number;
  method?: string | null;
  reference?: string | null;
  party?: string | null;
  bankAccountId?: string | null;
  bankAccountName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  billId?: string | null;
  billNumber?: string | null;
  contraAccountId?: string | null;
  contraAccountCode?: string | null;
  contraAccountName?: string | null;
  journalEntryId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
