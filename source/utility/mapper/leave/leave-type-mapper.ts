import { leaveTypeDto } from "../../dtos/leave/leave-type-dto";
import { ILeaveTypeModel } from "../../../model/leave/leave-type-model";

const mapDbToDto = (dbModel: ILeaveTypeModel): leaveTypeDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  name: dbModel.name || null,
  daysPerYear: dbModel.daysPerYear ?? null,
  carryForward: dbModel.carryForward ?? null,
  paid: dbModel.paid ?? null,
  requiresDocument: dbModel.requiresDocument ?? null,
  minNoticeDays: dbModel.minNoticeDays ?? null,
  maxDaysAtOnce: dbModel.maxDaysAtOnce ?? null,
  applicableGender: dbModel.applicableGender || null,
  status: dbModel.status || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: ILeaveTypeModel[]): leaveTypeDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
