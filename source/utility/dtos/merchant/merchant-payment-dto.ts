export interface merchantPaymentDto {
  id: string;
  merchantId?: string | null;
  amount?: number | null;
  method?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  adminId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
