import { pfContributionDto } from "../../dtos/provident-fund/pf-contribution-dto";
import { IPFContributionModel } from "../../../model/provident-fund/pf-contribution-model";

const mapDbToDto = (dbModel: IPFContributionModel): pfContributionDto => ({
  id: dbModel._id ? String(dbModel._id) : "",
  employeeId: dbModel.employeeId ? String(dbModel.employeeId) : null,
  month: dbModel.month || null,
  basic: dbModel.basic ?? null,
  employeeContribution: dbModel.employeeContribution ?? null,
  employerContribution: dbModel.employerContribution ?? null,
  employeePfPercentage: dbModel.employeePfPercentage ?? null,
  employerMultiplier: dbModel.employerMultiplier ?? null,
  totalContribution: dbModel.totalContribution ?? null,
  balanceAfter: dbModel.balanceAfter ?? null,
  status: dbModel.status || null,
  adminId: dbModel.adminId ? String(dbModel.adminId) : null,
  merchantId: dbModel.merchantId ? String(dbModel.merchantId) : null,
  createdBy: dbModel.createdBy ? String(dbModel.createdBy) : null,
  createdAt: dbModel.createdAt || null,
  updatedAt: dbModel.updatedAt || null,
});

const mapDbListToDtoList = (dbModels: IPFContributionModel[]): pfContributionDto[] => dbModels.map(mapDbToDto);

export { mapDbToDto, mapDbListToDtoList };
