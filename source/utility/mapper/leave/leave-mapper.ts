import { leaveDto, leaveApprovalStepDto } from "../../dtos/leave/leave-dto";
import { ILeaveModel, ILeaveApprovalStep } from "../../../model/leave/leave-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const mapStep = (step?: ILeaveApprovalStep | null): leaveApprovalStepDto | null =>
  step
    ? {
        status: step.status || null,
        approvedBy: step.approvedBy ? String(step.approvedBy) : null,
        approvedOn: step.approvedOn || null,
        comments: step.comments || null,
      }
    : null;

const populatedDepartmentName = (employeeId: unknown): string | null => {
  const doc = employeeId as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  const dept = doc.departmentId as Record<string, unknown> | null;
  if (!dept || typeof dept !== "object") return null;
  return (dept.name as string) || null;
};

const populatedLeaveTypeName = (leaveTypeId: unknown): string | null => {
  const doc = leaveTypeId as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc.name as string) || null;
};

const mapDbToDto = (dbModel: ILeaveModel): leaveDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
  id: dbModel._id ? String(dbModel._id) : "",
  leaveNumber: dbModel.leaveNumber || null,
  employeeId: emp.id,
  employeeName: emp.name,
  employeeCode: emp.code,
  department: populatedDepartmentName(dbModel.employeeId),
  leaveTypeId: dbModel.leaveTypeId ? String((dbModel.leaveTypeId as any)?._id || dbModel.leaveTypeId) : null,
  leaveTypeName: populatedLeaveTypeName(dbModel.leaveTypeId),
  fromDate: dbModel.fromDate || null,
  toDate: dbModel.toDate || null,
  days: dbModel.days ?? null,
  halfDay: dbModel.halfDay || null,
  reason: dbModel.reason || null,
  handoverToEmployeeId: dbModel.handoverToEmployeeId ? String(dbModel.handoverToEmployeeId) : null,
  emergencyContact: dbModel.emergencyContact || null,
  attachments: dbModel.attachments || [],
  appliedVia: dbModel.appliedVia || null,
  status: dbModel.status || null,
  appliedAt: dbModel.appliedAt || null,
  managerApproval: mapStep(dbModel.managerApproval),
  hrApproval: mapStep(dbModel.hrApproval),
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ILeaveModel[]): leaveDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
