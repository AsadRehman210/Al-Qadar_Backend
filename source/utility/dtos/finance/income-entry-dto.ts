export interface incomeEntryDto {
  id: string;
  date?: Date | null;
  source?: string | null;
  description?: string | null;
  amount: number;
  currency?: string | null;
  bankAccountId?: string | null;
  bankAccountName?: string | null;
  revenueAccountId?: string | null;
  revenueAccountCode?: string | null;
  revenueAccountName?: string | null;
  journalEntryId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
