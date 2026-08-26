import { salaryDto } from "../../dtos/salary/salary-dto";
import { ISalaryModel } from "../../../model/salary/salary-model";

const mapDbToDto = (dbModel: ISalaryModel): salaryDto => {
  return {
    id: dbModel._id ? String(dbModel._id) : "",
    employeeId: dbModel.employeeId ? String(dbModel.employeeId) : null,
    basic_salary: dbModel.basic_salary ?? null,
    allowances: dbModel.allowances || null,
    deductions: dbModel.deductions || null,
    tax_percentage: dbModel.tax_percentage ?? null,
    pf_percentage: dbModel.pf_percentage ?? null,
    gross_salary: dbModel.gross_salary ?? null,
    net_salary: dbModel.net_salary ?? null,
    bank_name: dbModel.bank_name || null,
    branch_name: dbModel.branch_name || null,
    branch_code: dbModel.branch_code || null,
    account_no: dbModel.account_no || null,
    ifsc: dbModel.ifsc || null,
    pf_number: dbModel.pf_number || null,
    payment_status: dbModel.payment_status || null,
    payment_date: dbModel.payment_date || null,
    effective_from: dbModel.effective_from || null,
    effective_to: dbModel.effective_to || null,
    salary_notes: dbModel.salary_notes || null,
    adminId: dbModel.adminId ? String(dbModel.adminId) : null,
    merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
    createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
    createdAt: dbModel.createdAt || null,
    updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: ISalaryModel[]): salaryDto[] => {
  return dbModels.map(mapDbToDto);
};

export { mapDbToDto, mapDbListToDtoList };
