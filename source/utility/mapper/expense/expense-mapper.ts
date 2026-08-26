import { expenseDto } from "../../dtos/expense/expense-dto";
import { IExpenseModel } from "../../../model/expense/expense-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const populatedDepartmentName = (employeeId: unknown): string | null => {
  const doc = employeeId as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  const dept = doc.departmentId as Record<string, unknown> | null;
  if (!dept || typeof dept !== "object") return null;
  return (dept.name as string) || null;
};

const mapDbToDto = (dbModel: IExpenseModel): expenseDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    expenseNumber: dbModel.expenseNumber || null,
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    department: populatedDepartmentName(dbModel.employeeId),
    expenseType: dbModel.expenseType || null,
    expenseDate: dbModel.expenseDate || null,
    amount: dbModel.amount ?? null,
    currency: dbModel.currency || null,
    paymentMethod: dbModel.paymentMethod || null,
    description: dbModel.description || null,
    receiptUrl: dbModel.receiptUrl || null,
    notes: dbModel.notes || null,
    appliedVia: dbModel.appliedVia || null,
    managerApproval: dbModel.managerApproval || null,
    approvalStatus: dbModel.approvalStatus || null,
    paymentStatus: dbModel.paymentStatus || null,
    approvalHistory: dbModel.approvalHistory || [],
    paymentHistory: dbModel.paymentHistory || [],
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IExpenseModel[]): expenseDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
