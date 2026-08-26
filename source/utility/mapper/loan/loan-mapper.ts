import { loanDto } from "../../dtos/loan/loan-dto";
import { ILoanModel } from "../../../model/loan/loan-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const mapDbToDto = (dbModel: ILoanModel): loanDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    loanNumber: dbModel.loanNumber || null,
    employeeId: emp.id,
    employeeName: emp.name,
    employeeCode: emp.code,
    loanType: dbModel.loanType || null,
    loanPurpose: dbModel.loanPurpose || null,
    loanAmount: dbModel.loanAmount ?? null,
    interestPercent: dbModel.interestPercent ?? null,
    numberOfInstallments: dbModel.numberOfInstallments ?? null,
    monthlyDeduction: dbModel.monthlyDeduction ?? null,
    appliedVia: dbModel.appliedVia || null,
    managerApproval: dbModel.managerApproval || null,
    status: dbModel.status || null,
    guarantor: dbModel.guarantor || null,
    emiSchedule: dbModel.emiSchedule || [],
    documents: dbModel.documents || [],
    approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
    approvalDate: dbModel.approvalDate || null,
    rejectedBy: dbModel.rejectedBy ? String(dbModel.rejectedBy) : null,
    rejectionReason: dbModel.rejectionReason || null,
    rejectedAt: dbModel.rejectedAt || null,
    preClosureAmount: dbModel.preClosureAmount ?? null,
    preClosureDate: dbModel.preClosureDate || null,
    notes: dbModel.notes || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ILoanModel[]): loanDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
