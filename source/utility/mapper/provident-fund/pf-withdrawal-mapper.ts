import { pfWithdrawalDto } from "../../dtos/provident-fund/pf-withdrawal-dto";
import { IPFWithdrawalModel } from "../../../model/provident-fund/pf-withdrawal-model";

const mapDbToDto = (dbModel: IPFWithdrawalModel): pfWithdrawalDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  employeeId: dbModel.employeeId ? String(dbModel.employeeId) : null,
  amount: dbModel.amount ?? null,
  reason: dbModel.reason || null,
  type: dbModel.type || null,
  status: dbModel.status || null,
  approvedBy: dbModel.approvedBy ? String(dbModel.approvedBy) : null,
  approvedOn: dbModel.approvedOn || null,
  paidOn: dbModel.paidOn || null,
  remarks: dbModel.remarks || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: IPFWithdrawalModel[]): pfWithdrawalDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
