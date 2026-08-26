import { announcementDto } from "../../dtos/announcement/announcement-dto";
import { IAnnouncementModel } from "../../../model/announcement/announcement-model";

const mapDbToDto = (dbModel: IAnnouncementModel): announcementDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    title: dbModel.title || null,
    body: dbModel.body || null,
    category: dbModel.category || null,
    pinned: dbModel.pinned ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAnnouncementModel[]): announcementDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
