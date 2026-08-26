export interface bankStatementLineDto {
  id: string;
  bankAccountId?: string | null;
  date?: Date | null;
  description?: string | null;
  amount: number;
  reference?: string | null;
  matched: boolean;
  matchedLedgerLineId?: string | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
