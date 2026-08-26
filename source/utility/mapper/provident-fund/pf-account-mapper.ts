import { pfAccountDto } from "../../dtos/provident-fund/pf-account-dto";
import { IPFAccountModel } from "../../../model/provident-fund/pf-account-model";
import { populatedEmployeeFields } from "../../helper/list-query";

const mapDbToDto = (dbModel: IPFAccountModel): pfAccountDto => {
  const emp = populatedEmployeeFields(dbModel.employeeId);
  return {
  id: dbModel._id ? String(dbModel._id) : "",
  employeeId: emp.id,
  employeeName: emp.name,
  employeeCode: emp.code,
  pfAccountNo: dbModel.pfAccountNo || null,
  currentBalance: dbModel.currentBalance ?? null,
  totalEmployeeContrib: dbModel.totalEmployeeContrib ?? null,
  totalEmployerContrib: dbModel.totalEmployerContrib ?? null,
  totalWithdrawn: dbModel.totalWithdrawn ?? null,
  status: dbModel.status || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
  };
};

const mapDbListToDtoList = (dbModels: IPFAccountModel[]): pfAccountDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
