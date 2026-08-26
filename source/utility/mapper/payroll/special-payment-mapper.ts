import { specialPaymentDto, specialPaymentLineDto } from "../../dtos/payroll/special-payment-dto";
import { ISpecialPaymentModel, ISpecialPaymentLine } from "../../../model/payroll/special-payment-model";

const mapLine = (line: ISpecialPaymentLine): specialPaymentLineDto => ({
  employeeId: line.employeeId ? String(line.employeeId) : null,
  amount: line.amount ?? 0,
  paymentStatus: line.paymentStatus || "Pending",
});

const populatedName = (value: unknown, nameField: string): string | null => {
  const doc = value as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return null;
  return (doc[nameField] as string) || null;
};

const mapDbToDto = (dbModel: ISpecialPaymentModel): specialPaymentDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  title: dbModel.title || null,
  typeId: dbModel.typeId ? String((dbModel.typeId as any)?._id || dbModel.typeId) : null,
  typeName: populatedName(dbModel.typeId, "name"),
  target: dbModel.target || null,
  departmentId: dbModel.departmentId ? String((dbModel.departmentId as any)?._id || dbModel.departmentId) : null,
  departmentName: populatedName(dbModel.departmentId, "name"),
  employeeId: dbModel.employeeId ? String(dbModel.employeeId) : null,
  customEmployeeIds: (dbModel.customEmployeeIds || []).map((id) => String(id)),
  employees: (dbModel.employees || []).map(mapLine),
  totalAmount: dbModel.totalAmount ?? 0,
  status: dbModel.status || null,
  notes: dbModel.notes || null,
  approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
  approvedOn: dbModel.approvedOn || null,
  paidOn: dbModel.paidOn || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: ISpecialPaymentModel[]): specialPaymentDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
