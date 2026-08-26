import { HolidayType } from "../../../model/holiday/holiday-model";

export interface holidayDto {
  id: string;
  name?: string | null;
  date?: Date | null;
  type?: HolidayType | null;
  recurring?: boolean | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
