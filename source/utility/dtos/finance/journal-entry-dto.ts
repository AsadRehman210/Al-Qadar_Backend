export interface journalLineDto {
  accountId: string;
  accountCode?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
}

export interface journalEntryDto {
  id: string;
  journalNo?: string | null;
  date?: Date | null;
  memo?: string | null;
  status?: string | null;
  lines: journalLineDto[];
  totalDebit: number;
  totalCredit: number;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
