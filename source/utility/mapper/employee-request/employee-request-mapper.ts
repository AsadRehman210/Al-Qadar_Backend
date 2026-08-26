import { employeeRequestDto } from "../../dtos/employee-request/employee-request-dto";
import { IEmployeeRequestModel } from "../../../model/employee-request/employee-request-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const populatedDepartmentName = (employeeId: unknown): string | null => {
  const doc = employeeId as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  const dept = doc.departmentId as Record<string, unknown> | null;
  if (!dept || typeof dept !== "object") return null;
  return (dept.name as string) || null;
};

const populatedManagerName = (managerId: unknown): string | null => {
  const doc = managerId as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  if (!("first_name" in doc)) return null;
  const name = `${doc.first_name || ""} ${doc.last_name || ""}`.toString().trim();
  return name || null;
};

const mapDbToDto = (dbModel: IEmployeeRequestModel): employeeRequestDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    requestNumber: dbModel.requestNumber || null,
    type: dbModel.type || null,
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    department: populatedDepartmentName(dbModel.employeeId),
    managerId: dbModel.managerId ? String((dbModel.managerId as any)?._id || dbModel.managerId) : null,
    managerName: populatedManagerName(dbModel.managerId),
    details: dbModel.details || {},
    summary: dbModel.summary || null,
    appliedVia: dbModel.appliedVia || null,
    status: dbModel.status || null,
    managerApproval: dbModel.managerApproval || null,
    hrApproval: dbModel.hrApproval || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IEmployeeRequestModel[]): employeeRequestDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
