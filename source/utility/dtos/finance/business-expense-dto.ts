export interface businessExpenseDto {
  id: string;
  date?: Date | null;
  category?: string | null;
  description?: string | null;
  amount: number;
  currency?: string | null;
  bankAccountId?: string | null;
  bankAccountName?: string | null;
  expenseAccountId?: string | null;
  expenseAccountCode?: string | null;
  expenseAccountName?: string | null;
  journalEntryId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
