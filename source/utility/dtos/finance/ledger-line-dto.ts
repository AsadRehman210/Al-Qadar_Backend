export interface ledgerLineDto {
  id: string;
  date?: Date | null;
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
  balance?: number;
  ref?: string | null;
  source?: string | null;
  currency?: string | null;
  journalEntryId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdAt?: Date | null;
}
