import { holidayDto } from "../../dtos/holiday/holiday-dto";
import { IHolidayModel } from "../../../model/holiday/holiday-model";

const mapDbToDto = (dbModel: IHolidayModel): holidayDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    date: dbModel.date || null,
    type: dbModel.type || null,
    recurring: dbModel.recurring ?? null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IHolidayModel[]): holidayDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
