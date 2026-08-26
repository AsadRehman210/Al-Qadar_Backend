import { exitDto } from "../../dtos/offboarding/exit-dto";
import { IExitModel } from "../../../model/offboarding/exit-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const populatedName = (value: unknown, nameField: string): string | null => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc[nameField] as string) || null;
};

const mapDbToDto = (dbModel: IExitModel): exitDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  const empDoc = dbModel.employeeId as Record<string, unknown> | null;
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    department: empDoc && typeof empDoc === "object" ? populatedName(empDoc.departmentId, "name") : null,
    designation: empDoc && typeof empDoc === "object" ? populatedName(empDoc.designationId, "title") : null,
    exitType: dbModel.exitType || null,
    reason: dbModel.reason || null,
    noticePeriodDays: dbModel.noticePeriodDays ?? null,
    resignationDate: dbModel.resignationDate || null,
    lastWorkingDay: dbModel.lastWorkingDay || null,
    status: dbModel.status || null,
    clearance: dbModel.clearance || null,
    settlement: dbModel.settlement || null,
    exitInterview: dbModel.exitInterview || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IExitModel[]): exitDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
