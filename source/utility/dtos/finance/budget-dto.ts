export interface budgetDto {
  id: string;
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  accountType?: string | null;
  period?: string | null;
  budgetAmount: number;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
