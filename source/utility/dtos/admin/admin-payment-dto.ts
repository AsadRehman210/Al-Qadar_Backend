export interface adminPaymentDto {
  id: string;
  adminId?: string | null;
  amount?: number | null;
  method?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  reference?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
