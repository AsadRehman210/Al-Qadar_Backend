import { AnnouncementCategory } from "../../../model/announcement/announcement-model";

export interface announcementDto {
  id: string;
  title?: string | null;
  body?: string | null;
  category?: AnnouncementCategory | null;
  pinned?: boolean | null;
  adminId?: string | null;
  merchantId?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}
