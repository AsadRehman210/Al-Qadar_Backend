export interface bankAccountDto {
  id: string;
  name?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  type?: string | null;
  currency?: string | null;
  chartAccountId?: string | null;
  chartAccountCode?: string | null;
  openingBalance: number;
  currentBalance: number;
  status?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
