import { attendancePolicyDto } from "../../dtos/attendance/attendance-policy-dto";
import { IAttendancePolicyModel } from "../../../model/attendance/attendance-policy-model";

const mapDbToDto = (dbModel: IAttendancePolicyModel): attendancePolicyDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    name: dbModel.name || null,
    implementedDate: dbModel.implementedDate || null,
    endDate: dbModel.endDate || null,
    salaryCalculationDays: dbModel.salaryCalculationDays ?? null,
    notes: dbModel.notes || null,
    rules: dbModel.rules || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IAttendancePolicyModel[]): attendancePolicyDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
