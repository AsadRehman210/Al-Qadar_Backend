import { payrollRunDto, payrollLineDto } from "../../dtos/payroll/payroll-run-dto";
import { IPayrollRunModel, IPayrollLine } from "../../../model/payroll/payroll-run-model";

const mapLine = (line: IPayrollLine): payrollLineDto => ({
  employeeId: line.employeeId ? String(line.employeeId) : null,
  basic: line.basic ?? 0,
  hra: line.hra ?? 0,
  medical: line.medical ?? 0,
  transport: line.transport ?? 0,
  food: line.food ?? 0,
  mobile: line.mobile ?? 0,
  overtimeHours: line.overtimeHours ?? 0,
  overtimeRate: line.overtimeRate ?? 0,
  overtime: line.overtime ?? 0,
  bonus: line.bonus ?? 0,
  arrears: line.arrears ?? 0,
  grossEarnings: line.grossEarnings ?? 0,
  pfEmployee: line.pfEmployee ?? 0,
  pfEmployer: line.pfEmployer ?? 0,
  pfPercentage: line.pfPercentage ?? 0,
  pfEmployerMultiplier: line.pfEmployerMultiplier ?? 1,
  incomeTax: line.incomeTax ?? 0,
  insurance: line.insurance ?? 0,
  loanDeduction: line.loanDeduction ?? 0,
  advance: line.advance ?? 0,
  attendanceDeduction: line.attendanceDeduction ?? 0,
  otherDeductions: line.otherDeductions ?? 0,
  totalDeductions: line.totalDeductions ?? 0,
  netPay: line.netPay ?? 0,
  employerCost: line.employerCost ?? 0,
  paymentStatus: line.paymentStatus || "Pending",
  paymentDate: line.paymentDate || null,
  paymentRef: line.paymentRef || null,
});

const mapDbToDto = (dbModel: IPayrollRunModel): payrollRunDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  runNumber: dbModel.runNumber || null,
  month: dbModel.month || null,
  status: dbModel.status || null,
  employees: (dbModel.employees || []).map(mapLine),
  totalGross: dbModel.totalGross ?? 0,
  totalDeductions: dbModel.totalDeductions ?? 0,
  totalNet: dbModel.totalNet ?? 0,
  totalEmployerCost: dbModel.totalEmployerCost ?? 0,
  notes: dbModel.notes || null,
  approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
  approvedOn: dbModel.approvedOn || null,
  processedOn: dbModel.processedOn || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: IPayrollRunModel[]): payrollRunDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList, mapLine };
