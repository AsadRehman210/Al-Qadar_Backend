export interface customerDto {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  emergencyPhone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  customerType?: string | null;
  companyName?: string | null;
  customerSegment?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  openingBalance?: number | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  status?: string | null;
  currentBalance?: number | null;
  openingBalanceLocked?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
