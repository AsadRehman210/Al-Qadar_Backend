export interface specialPaymentTypeDto {
  id: string;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  amountMode?: string | null;
  amountValue?: number | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
